import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { ReportCardStatus } from "@/report/lib/report-card-status";
import { notifyAdminsReportSubmitted, notifyTeacherReportReviewed } from "@/report/lib/report-card-notify";
import { useGradingFormat } from "@/report/hooks/use-school-data";
import { fetchClassSubjectTemplates } from "@/report/lib/class-subjects";
import { type ReportFormData, mergeReportSubjects } from "@/report/lib/shepherd-grading";
import { applyTermDatesToForm, fetchTermReportDates } from "@/report/lib/terms";
import {
  fetchTermReport,
  enrichFormWithClassReportCount,
  formToPayload,
  loadResultsIntoForm,
  rowToForm,
  saveReportVersion,
  type TermReportRow,
} from "@/report/lib/term-report";
import { persistTermReportCard } from "@/report/lib/term-report-persist";
import {
  isNetworkError,
  requestBackgroundSync,
} from "@/report/lib/pwa-stub/background-sync";
import { enqueueOfflineJob } from "@/report/lib/pwa-stub/offline-queue";
import { clearReportPositions } from "@/report/lib/shepherd-grading";

function hasSavedPositions(row: TermReportRow | null) {
  if (!row) return false;
  const isFilled = (value: unknown) => {
    const text = String(value ?? "").trim();
    return !!text && text !== "—" && /\d/.test(text);
  };
  return isFilled(row.class_position) || row.subjects.some((subject) => isFilled(subject.position));
}

type UseTermReportCardOpts = {
  studentId: string;
  classId: string;
  termId: string;
  schoolId: string;
  teacherId: string;
  teacherName?: string;
  enabled: boolean;
  /** When false, positions stay empty until teacher clicks Generate Positions. */
  showPositions?: boolean;
};

export function useTermReportCard(opts: UseTermReportCardOpts) {
  const qc = useQueryClient();
  const gradingFormat = useGradingFormat();
  const [form, setForm] = useState<ReportFormData | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const [status, setStatus] = useState<ReportCardStatus>("draft");
  const [version, setVersion] = useState(1);
  const [loading, setLoading] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [autosaveScheduled, setAutosaveScheduled] = useState(false);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const formRef = useRef<ReportFormData | null>(null);
  formRef.current = form;

  const load = useCallback(async (override?: { showPositions?: boolean }) => {
    if (!opts.enabled || !opts.studentId) return;
    setLoading(true);
    try {
      const { data: st } = await supabase
        .from("students")
        .select("*")
        .eq("id", opts.studentId)
        .single();
      if (!st) return;

      const { data: classRow } =
        st.class_id || opts.classId
          ? await supabase
              .from("classes")
              .select("name")
              .eq("id", st.class_id || opts.classId)
              .maybeSingle()
          : { data: null };

      const { data: term } = opts.termId
        ? await supabase.from("terms").select("name, session").eq("id", opts.termId).single()
        : { data: null };
      const termDates = opts.termId
        ? await fetchTermReportDates(opts.schoolId, opts.termId)
        : { schoolCloses: "", reopeningDate: "", nextTerm: "" };
      const existing = await fetchTermReport(opts.studentId, opts.termId || null);

      const effectiveClassId = st.class_id || opts.classId;
      const subjectTemplates = effectiveClassId
        ? await fetchClassSubjectTemplates(effectiveClassId)
        : [];

      let base: ReportFormData;
      if (existing) {
        base = applyTermDatesToForm(rowToForm(existing, gradingFormat, subjectTemplates), termDates);
        setReportId(existing.id);
        setStatus(existing.status);
        setVersion(existing.version ?? 1);
        base.subjects = mergeReportSubjects(
          base.subjects,
          undefined,
          gradingFormat,
          subjectTemplates,
        );
      } else {
        base = applyTermDatesToForm(
          {
          studentName: (st as { full_name?: string }).full_name ?? (st as { profiles?: { full_name?: string } }).profiles?.full_name ?? "Student",
          className: classRow?.name ?? "",
          rollNo: ((st as { admission_number?: string }).admission_number ?? (st as { admission_no?: string }).admission_no ?? "").replace(/\D/g, "").slice(-2) || "",
          totalStudentsInClassManual: "",
          totalStudentsInClassAuto: null,
          position: "",
          term: term?.name ?? "",
          academicYear: term ? `${term.session} Academic Year` : "",
          attendanceMade: "",
          attendanceTotal: "",
          conduct: "Good",
          interest: "High",
          club: "—",
          attitude: "Positive",
          teacherRemark: "",
          schoolCloses: "",
          reopeningDate: "",
          nextTerm: "Third Term",
          teacherSignDate: "",
          headSignDate: "",
          parentSignDate: "",
          subjects: subjectTemplates,
          },
          termDates,
        );
        setReportId(null);
        setStatus("draft");
        setVersion(1);
      }

      if (effectiveClassId && subjectTemplates.length === 0) {
        toast.message("No subjects assigned to this class yet. Ask your admin to assign subjects under Classes & Subjects.");
      }

      const showPositions =
        (override?.showPositions ?? opts.showPositions !== false) || hasSavedPositions(existing);
      const filled = opts.termId
        ? await loadResultsIntoForm(opts.studentId, opts.termId, base, {
            classId: effectiveClassId,
            includePositions: showPositions,
            preferResultsScores: !existing,
            gradingFormat,
            subjectTemplates,
          })
        : showPositions
          ? base
          : clearReportPositions(base);
      const withClassCount = await enrichFormWithClassReportCount(
        filled,
        effectiveClassId,
        opts.termId || null,
      );
      setForm(withClassCount);
    } finally {
      setLoading(false);
    }
  }, [gradingFormat, opts.classId, opts.enabled, opts.showPositions, opts.schoolId, opts.studentId, opts.termId]);

  useEffect(() => {
    load();
  }, [load]);

  const persist = useMutation({
    mutationFn: async (params: {
      nextStatus: ReportCardStatus;
      note?: string;
      adminComment?: string;
      rejectionReason?: string;
      skipVersion?: boolean;
    }) => {
      const f = formRef.current;
      if (!f) throw new Error("No form data");
      if (!opts.schoolId || !opts.teacherId) {
        throw new Error("Missing school or teacher context. Please sign in again.");
      }

      const result = await persistTermReportCard({
        form: f,
        schoolId: opts.schoolId,
        studentId: opts.studentId,
        termId: opts.termId || null,
        classId: opts.classId || null,
        teacherId: opts.teacherId,
        showPositions: opts.showPositions,
        reportId,
        version,
        nextStatus: params.nextStatus,
        adminComment: params.adminComment,
        rejectionReason: params.rejectionReason,
        note: params.note,
        skipVersion: params.skipVersion,
      });

      setReportId(result.id);
      setVersion(result.version);
      setStatus(result.status);
      setLastSaved(new Date());
      return result.id;
    },
    onSuccess: async (newId) => {
      qc.invalidateQueries({ queryKey: ["term-reports-history"] });
      qc.invalidateQueries({ queryKey: ["admin-term-reports"] });
      qc.invalidateQueries({ queryKey: ["report-versions", newId ?? reportId] });
      if (opts.classId && opts.termId && formRef.current) {
        const { fetchClassTermReportCount } = await import("@/report/lib/term-report");
        const auto = await fetchClassTermReportCount(opts.classId, opts.termId);
        setForm((prev) => (prev ? { ...prev, totalStudentsInClassAuto: auto } : prev));
      }
    },
    onError: async (e: Error, params) => {
      const f = formRef.current;
      if (
        isNetworkError(e) &&
        f &&
        opts.schoolId &&
        opts.teacherId &&
        opts.studentId
      ) {
        await enqueueOfflineJob({
          type: "term-report-persist",
          data: {
            form: f,
            schoolId: opts.schoolId,
            studentId: opts.studentId,
            termId: opts.termId || null,
            classId: opts.classId || null,
            teacherId: opts.teacherId,
            showPositions: opts.showPositions,
            reportId,
            version,
            nextStatus: params.nextStatus,
            adminComment: params.adminComment,
            rejectionReason: params.rejectionReason,
            note: params.note,
            skipVersion: params.skipVersion,
          },
        });
        await requestBackgroundSync();
        setLastSaved(new Date());
        toast.info("Saved offline — will sync when you're back online.");
        return;
      }
      toast.error(e.message);
    },
  });

  const scheduleAutosave = useCallback(() => {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    setAutosaveScheduled(true);
    autosaveTimer.current = setTimeout(() => {
      autosaveTimer.current = null;
      const keepStatus = status === "draft" && !reportId ? "draft" : status;
      persist.mutate(
        { nextStatus: keepStatus, note: "Auto-saved", skipVersion: true },
        {
          onSettled: () => setAutosaveScheduled(false),
        },
      );
    }, 800);
  }, [reportId, status, persist]);

  const onFormChange = useCallback(
    (next: ReportFormData) => {
      setForm(next);
      scheduleAutosave();
    },
    [scheduleAutosave],
  );

  const saveDraft = async () => {
    try {
      const keepStatus = status === "draft" && !reportId ? "draft" : status;
      await persist.mutateAsync({ nextStatus: keepStatus, note: "Manual save" });
      toast.success("Progress saved");
    } catch {
      /* toast shown by persist.onError */
    }
  };

  const submitForReview = async () => {
    const id = await persist.mutateAsync({
      nextStatus: "pending_review",
      note: "Submitted for admin review",
    });
    await notifyAdminsReportSubmitted({
      schoolId: opts.schoolId,
      studentName: formRef.current?.studentName ?? "Student",
      className: formRef.current?.className ?? "",
      reportId: id,
      teacherName: opts.teacherName,
    });
    toast.success("Sent to admin for review");
  };

  return {
    form,
    setForm: onFormChange,
    reportId,
    status,
    version,
    loading,
    lastSaved,
    saving: persist.isPending,
    autosavePending: persist.isPending || autosaveScheduled,
    load,
    saveDraft,
    submitForReview,
    persist,
  };
}

export function useAdminReportActions(report: TermReportRow | undefined, adminId: string) {
  const qc = useQueryClient();

  const updateStatus = useMutation({
    mutationFn: async (params: {
      status: ReportCardStatus;
      form?: ReportFormData;
      adminComment?: string;
      rejectionReason?: string;
      note: string;
    }) => {
      if (!report) throw new Error("No report");
      const payload: Record<string, unknown> = {
        status: params.status,
        admin_comment: params.adminComment ?? report.admin_comment,
        rejection_reason: params.rejectionReason ?? null,
        version: (report.version ?? 1) + 1,
      };
      if (params.form) {
        Object.assign(
          payload,
          formToPayload(params.form, {
            schoolId: report.school_id,
            studentId: report.student_id,
            termId: report.term_id,
            classId: report.class_id,
            teacherId: report.teacher_id!,
            status: params.status,
            adminComment: params.adminComment,
            rejectionReason: params.rejectionReason,
          }),
        );
      }
      const { error } = await supabase
        .from("term_report_cards")
        .update(payload as never)
        .eq("id", report.id);
      if (error) throw error;
      if (params.form) {
        await saveReportVersion(
          report.id,
          (report.version ?? 1) + 1,
          params.status,
          params.form,
          adminId,
          params.note,
        );
      }
      if (report.teacher_id && ["reviewed", "approved", "rejected"].includes(params.status)) {
        await notifyTeacherReportReviewed({
          teacherId: report.teacher_id,
          studentName: report.student_name,
          status: params.status as "reviewed" | "approved" | "rejected",
          reportId: report.id,
          note: params.rejectionReason ?? params.adminComment ?? undefined,
        });
      }
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["term-report"] });
      qc.invalidateQueries({ queryKey: ["admin-term-reports"] });
      if (report?.id) qc.invalidateQueries({ queryKey: ["report-versions", report.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { updateStatus };
}
