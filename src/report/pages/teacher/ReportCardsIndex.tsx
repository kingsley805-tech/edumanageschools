import { Link, useSearchParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/report/hooks/use-auth";
import { useCurrentTerm, useSchool } from "@/report/hooks/use-school-data";
import { useTermReportCard } from "@/report/hooks/use-term-report-card";
import { PageHeader } from "@/report/portal/page-header";
import { ActiveTermBanner } from "@/report/portal/active-term-banner";
import {
  DashboardChartCard,
  DashboardStatCard,
  DashboardStatGrid,
} from "@/components/metronic/DashboardStatCard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ShepherdReportCard } from "@/report/components/shepherd-report-card";
import { OverallClassReport } from "@/report/components/overall-class-report";
import { fetchOverallClassReport } from "@/report/lib/overall-class-report";
import {
  canSubmitClassReport,
  isPendingAdminAction,
  statusBadgeVariant,
  statusLabel,
  teacherReportEditByDefault,
} from "@/report/lib/report-card-status";
import { useGeneratePositions } from "@/report/hooks/use-generate-positions";
import { GeneratePositionsCard } from "@/report/portal/generate-positions-card";
import {
  BookOpen,
  FileText,
  History,
  Loader2,
  Pencil,
  RefreshCw,
  Send,
  Trophy,
  Users,
} from "lucide-react";
import { useReportSignatures } from "@/report/hooks/use-report-signatures";
import { TeacherBulkReportActions } from "@/report/components/teacher-bulk-report-actions";
import { fetchTeacherAssignedClasses } from "@/report/lib/teacher-assignments";
import { academicYearFromTerm } from "@/report/lib/terms";
import {
  fetchTermClassReport,
  upsertTermClassReport,
} from "@/report/lib/term-class-report";
import { notifyAdminsClassReportSubmitted } from "@/report/lib/report-card-notify";
import { toast } from "sonner";
import { withReportLayout } from "@/report/withReportLayout";

type ReportMode = "class" | "student";

function TeacherReportCards() {
  const { user, profile } = useAuth();
  const { data: term } = useCurrentTerm();
  const { data: school } = useSchool();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [classId, setClassId] = useState(searchParams.get("classId") || "");
  const [studentId, setStudentId] = useState(searchParams.get("studentId") || "");
  const [reportMode, setReportMode] = useState<ReportMode>(
    searchParams.get("mode") === "student" || searchParams.get("studentId")
      ? "student"
      : "class",
  );
  const [submitOpen, setSubmitOpen] = useState(false);
  const [classSubmitOpen, setClassSubmitOpen] = useState(false);
  const [positionsRevealed, setPositionsRevealed] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    const cid = searchParams.get("classId");
    const sid = searchParams.get("studentId");
    const mode = searchParams.get("mode");
    if (cid) setClassId(cid);
    if (sid) setStudentId(sid);
    if (mode === "class" || mode === "student") setReportMode(mode);
    else if (sid) setReportMode("student");
  }, [searchParams]);

  const syncParams = (next: {
    classId?: string;
    studentId?: string;
    mode?: ReportMode;
  }) => {
    const params = new URLSearchParams(searchParams);
    const cid = next.classId ?? classId;
    const sid = next.studentId !== undefined ? next.studentId : studentId;
    const mode = next.mode ?? reportMode;
    if (cid) params.set("classId", cid);
    else params.delete("classId");
    if (sid) params.set("studentId", sid);
    else params.delete("studentId");
    params.set("mode", mode);
    setSearchParams(params, { replace: true });
  };

  useEffect(() => {
    setPositionsRevealed(false);
    setIsEditing(false);
  }, [classId, term?.id]);

  useEffect(() => {
    setIsEditing(false);
    setPositionsRevealed(false);
  }, [studentId]);

  const { data: classes, isLoading: classesLoading } = useQuery({
    queryKey: ["teacher-classes-report", user?.id],
    enabled: !!user?.id,
    queryFn: () => fetchTeacherAssignedClasses(user!.id),
  });

  useEffect(() => {
    if (!classes?.length || classId) return;
    setClassId(classes[0].id);
  }, [classes, classId]);

  const { data: students } = useQuery({
    queryKey: ["class-students-report", classId],
    enabled: !!classId,
    queryFn: async () => {
      const { data } = await supabase
        .from("students")
        .select("id, full_name, admission_number")
        .eq("class_id", classId)
        .order("full_name");
      return data ?? [];
    },
  });

  const schoolId = profile?.school_id ?? "";
  const selectedClassName = classes?.find((c) => c.id === classId)?.name;

  const {
    data: overallReport,
    isLoading: overallLoading,
    refetch: refetchOverall,
  } = useQuery({
    queryKey: [
      "overall-class-report",
      classId,
      term?.id,
      selectedClassName,
      term?.name,
      term?.session,
    ],
    enabled: !!classId && !!term?.id && reportMode === "class",
    queryFn: () =>
      fetchOverallClassReport({
        classId,
        termId: term!.id,
        className: selectedClassName,
        termLabel: term!.name,
        academicYear: academicYearFromTerm(term!),
      }),
  });

  const { data: classReportRecord, refetch: refetchClassRecord } = useQuery({
    queryKey: ["term-class-report", classId, term?.id],
    enabled: !!classId && !!term?.id && reportMode === "class",
    queryFn: () => fetchTermClassReport(classId, term!.id),
  });

  const submitClassReport = useMutation({
    mutationFn: async () => {
      if (!overallReport || !schoolId || !user?.id || !term?.id) {
        throw new Error("Missing class report context");
      }
      return upsertTermClassReport({
        schoolId,
        classId,
        termId: term.id,
        teacherId: user.id,
        changedBy: user.id,
        status: "pending_review",
        snapshot: overallReport,
        note: "Submitted for admin review",
        existing: classReportRecord ?? null,
      });
    },
    onSuccess: async (row) => {
      await notifyAdminsClassReportSubmitted({
        schoolId,
        className: row.class_name ?? selectedClassName ?? "Class",
        termLabel: row.term_label ?? term?.name,
        reportId: row.id,
        teacherName: profile?.full_name ?? undefined,
      });
      await refetchClassRecord();
      qc.invalidateQueries({ queryKey: ["term-class-reports-history"] });
      qc.invalidateQueries({ queryKey: ["admin-term-class-reports"] });
      toast.success("Class report sent to admin for review");
    },
    onError: (e: Error) => toast.error(e.message || "Failed to submit class report"),
  });

  const editor = useTermReportCard({
    studentId,
    classId,
    termId: term?.id ?? "",
    schoolId,
    teacherId: user?.id ?? "",
    teacherName: profile?.full_name ?? undefined,
    enabled: reportMode === "student" && !!studentId && !!schoolId && !!term?.id,
    showPositions: positionsRevealed,
  });

  useEffect(() => {
    if (reportMode !== "student" || !studentId || editor.loading) return;
    if (teacherReportEditByDefault(editor.status) || !editor.reportId) {
      setIsEditing(true);
    }
  }, [reportMode, studentId, editor.status, editor.reportId, editor.loading]);

  const {
    generate: generatePositions,
    progress: scoringProgress,
    progressLoading,
    isGenerating,
    progressPct,
  } = useGeneratePositions({
    classId: classId || undefined,
    termId: term?.id,
    onSuccess: async () => {
      setPositionsRevealed(true);
      if (reportMode === "student" && studentId) {
        await editor.load({ showPositions: true });
      }
      await refetchOverall();
    },
  });

  const editable = isEditing;

  const startEditing = () => {
    setIsEditing(true);
    setPositionsRevealed(true);
    if (studentId) void editor.load({ showPositions: true });
  };

  const openStudentReport = (sid: string) => {
    setStudentId(sid);
    setReportMode("student");
    syncParams({ studentId: sid, mode: "student" });
  };

  const switchMode = (mode: ReportMode) => {
    setReportMode(mode);
    syncParams({ mode });
    if (mode === "class") void refetchOverall();
  };

  const { teacherSignatureUrl, headSignatureUrl } = useReportSignatures({
    schoolId,
    teacherId: user?.id,
    enabled: reportMode === "student" && !!editor.form && !!schoolId,
  });

  const cardsReady = useMemo(
    () => overallReport?.students.filter((s) => s.hasReport).length ?? 0,
    [overallReport],
  );
  const studentCount = students?.length ?? 0;
  const statusTone =
    classReportRecord?.status === "approved" || classReportRecord?.status === "published"
      ? "emerald"
      : classReportRecord?.status === "rejected"
        ? "rose"
        : isPendingAdminAction(classReportRecord?.status ?? "")
          ? "amber"
          : "slate";

  const statusHint = useMemo(() => {
    if (reportMode === "class") {
      if (classReportRecord?.status === "rejected" && classReportRecord.rejection_reason) {
        return `Returned by admin: ${classReportRecord.rejection_reason}`;
      }
      if (isPendingAdminAction(classReportRecord?.status ?? "")) {
        return "Waiting for admin approval. Print & download unlock after approval.";
      }
      if (classReportRecord?.status === "approved" || classReportRecord?.status === "published") {
        return "Approved — you can print or download this class report.";
      }
      return "Fill student cards first, then send the class report for admin review.";
    }
    if (!studentId) return "Select a student to open their report card.";
    if (!isEditing && editor.reportId) {
      return `Status: ${statusLabel(editor.status)}. Click Edit to make changes.`;
    }
    if (isPendingAdminAction(editor.status)) {
      return "Pending admin review — you can still edit and save.";
    }
    return null;
  }, [
    reportMode,
    classReportRecord,
    studentId,
    isEditing,
    editor.reportId,
    editor.status,
  ]);

  return (
    <>
      <PageHeader
        title="Report cards"
        description="Prepare student cards or the class performance report for this term."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/teacher/report-cards/class-history">
                <Users className="mr-1.5 h-3.5 w-3.5" />
                Class history
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/teacher/report-cards/history">
                <History className="mr-1.5 h-3.5 w-3.5" />
                Student history
              </Link>
            </Button>
          </div>
        }
      />

      <div className="min-w-0 space-y-5 p-4 md:p-6">
        <ActiveTermBanner />

        <DashboardStatGrid>
          <DashboardStatCard
            label="Class"
            value={selectedClassName || "—"}
            description={term?.name ? `${term.name}` : "Select a class"}
            icon={BookOpen}
            tone="primary"
          />
          <DashboardStatCard
            label="Students"
            value={studentCount}
            description={
              reportMode === "class"
                ? `${cardsReady} with report cards`
                : "In selected class"
            }
            icon={Users}
            tone="sky"
          />
          <DashboardStatCard
            label={reportMode === "class" ? "Class report" : "Student report"}
            value={
              reportMode === "class"
                ? classReportRecord
                  ? statusLabel(classReportRecord.status)
                  : "Not sent"
                : studentId
                  ? statusLabel(editor.status)
                  : "—"
            }
            description={
              reportMode === "class"
                ? "Overall performance sheet"
                : editor.form?.studentName || "Pick a student"
            }
            icon={FileText}
            tone={reportMode === "class" ? statusTone : "violet"}
          />
        </DashboardStatGrid>

        {/* Toolbar */}
        <DashboardChartCard
          title="Workspace"
          description="Choose report type, then select class (and student)."
          action={
            <div className="flex flex-wrap gap-2">
              {classId && term && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isGenerating || progressLoading}
                  onClick={() => generatePositions.mutate({})}
                >
                  {isGenerating ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trophy className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Generate positions
                </Button>
              )}
              {reportMode === "class" && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!classId || overallLoading}
                  onClick={() => {
                    void refetchOverall();
                    void refetchClassRecord();
                  }}
                >
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                  Refresh
                </Button>
              )}
            </div>
          }
        >
          <Tabs
            value={reportMode}
            onValueChange={(v) => switchMode(v as ReportMode)}
            className="no-print"
          >
            <TabsList className="mb-5">
              <TabsTrigger value="class" className="gap-1.5">
                <Users className="h-3.5 w-3.5" />
                Class report
              </TabsTrigger>
              <TabsTrigger value="student" className="gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                Student card
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="no-print grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Class</Label>
              <Select
                value={classId}
                onValueChange={(v) => {
                  setClassId(v);
                  setStudentId("");
                  syncParams({ classId: v, studentId: "", mode: reportMode });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent>
                  {classes?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!classesLoading && classes && classes.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No classes assigned. Ask your admin to assign you.
                </p>
              )}
            </div>

            {reportMode === "student" && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Student</Label>
                <Select
                  value={studentId}
                  onValueChange={(v) => {
                    setStudentId(v);
                    syncParams({ studentId: v, mode: "student" });
                  }}
                  disabled={!classId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select student" />
                  </SelectTrigger>
                  <SelectContent>
                    {students?.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex flex-col justify-end gap-2 sm:col-span-2 lg:col-span-2">
              <div className="flex flex-wrap items-center gap-2">
                {reportMode === "student" && studentId && (
                  <Badge variant={statusBadgeVariant(editor.status)}>
                    {statusLabel(editor.status)}
                  </Badge>
                )}
                {reportMode === "class" && classReportRecord && (
                  <Badge variant={statusBadgeVariant(classReportRecord.status)}>
                    {statusLabel(classReportRecord.status)}
                  </Badge>
                )}

                {reportMode === "student" && studentId && editor.reportId && !isEditing && (
                  <Button size="sm" onClick={startEditing} disabled={editor.loading}>
                    <Pencil className="mr-1.5 h-3.5 w-3.5" />
                    Edit
                  </Button>
                )}
                {reportMode === "student" && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        editor.load({ showPositions: positionsRevealed || isEditing })
                      }
                      disabled={!studentId || editor.loading}
                    >
                      <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                      Reload
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => void editor.saveDraft()}
                      disabled={!editor.form || editor.saving || !editable}
                    >
                      {editor.saving ? (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      ) : null}
                      Save
                    </Button>
                    {editable &&
                      (editor.status === "draft" || editor.status === "rejected") && (
                        <Button
                          size="sm"
                          onClick={() => setSubmitOpen(true)}
                          disabled={editor.saving}
                        >
                          <Send className="mr-1.5 h-3.5 w-3.5" />
                          Send for review
                        </Button>
                      )}
                  </>
                )}

                {reportMode === "class" && canSubmitClassReport(classReportRecord?.status) && (
                  <Button
                    size="sm"
                    disabled={
                      !overallReport ||
                      overallLoading ||
                      submitClassReport.isPending ||
                      cardsReady === 0
                    }
                    onClick={() => setClassSubmitOpen(true)}
                  >
                    {submitClassReport.isPending ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Send className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Send for review
                  </Button>
                )}
              </div>
            </div>
          </div>

          {statusHint && (
            <p className="no-print mt-4 text-xs text-muted-foreground border-t border-border pt-3">
              {statusHint}
            </p>
          )}
        </DashboardChartCard>

        {/* Positions progress — compact, only when class selected */}
        {classId && term && (
          <GeneratePositionsCard
            className={selectedClassName}
            classId={classId}
            termId={term.id}
            progress={scoringProgress}
            progressPct={progressPct}
            progressLoading={progressLoading}
            isGenerating={isGenerating}
            onGenerate={() => generatePositions.mutate({})}
            compact
          />
        )}

        {/* Bulk print/PDF for submitted student cards — only in student mode */}
        {reportMode === "student" && classId && term && user?.id && schoolId && (
          <TeacherBulkReportActions
            classId={classId}
            termId={term.id}
            teacherId={user.id}
            schoolId={schoolId}
            className={selectedClassName}
            termLabel={term.name}
            students={students}
            onSelectStudent={openStudentReport}
          />
        )}

        {/* Preview */}
        {reportMode === "class" ? (
          <OverallClassReport
            data={overallReport}
            loading={overallLoading}
            schoolName={school?.name ?? school?.school_name}
            status={classReportRecord?.status}
            onSelectStudent={openStudentReport}
          />
        ) : editor.loading ? (
          <Skeleton className="mx-auto h-[720px] w-full max-w-[860px]" />
        ) : !editor.form ? (
          <div className="kt-card no-print">
            <div className="flex flex-col items-center px-6 py-16 text-center text-muted-foreground">
              <FileText className="mb-3 h-10 w-10 opacity-40" />
              <p className="text-sm font-medium text-foreground">No student selected</p>
              <p className="mt-1 text-xs">Choose a class and student above to open their report card.</p>
            </div>
          </div>
        ) : (
          <div className="min-w-0 w-full max-w-full overflow-x-auto">
            <ShepherdReportCard
              data={editor.form}
              academicYear={editor.form.academicYear}
              editable={editable}
              onChange={editor.setForm}
              onSave={() => void editor.saveDraft()}
              saving={editor.saving}
              autosavePending={editor.autosavePending}
              status={editor.status}
              lastSaved={editor.lastSaved}
              toolbarTitle={`Report — ${editor.form.studentName}`}
              schoolId={schoolId || undefined}
              teacherSignatureUrl={teacherSignatureUrl}
              headSignatureUrl={headSignatureUrl}
            />
          </div>
        )}
      </div>

      <AlertDialog open={submitOpen} onOpenChange={setSubmitOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send student report for review?</AlertDialogTitle>
            <AlertDialogDescription>
              Admins will be notified. You can still edit later. Print/PDF unlock after submission.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                await editor.submitForReview();
                setSubmitOpen(false);
              }}
            >
              Send for review
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={classSubmitOpen} onOpenChange={setClassSubmitOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send class report for review?</AlertDialogTitle>
            <AlertDialogDescription>
              A snapshot of class scores and positions will go to admins. Print and download
              (Excel, PDF, Word) unlock only after approval.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={submitClassReport.isPending}
              onClick={async () => {
                await submitClassReport.mutateAsync();
                setClassSubmitOpen(false);
              }}
            >
              Send for review
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default withReportLayout("teacher", TeacherReportCards);
