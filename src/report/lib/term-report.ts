// @ts-nocheck
import { supabase } from "@/integrations/supabase/client";
import { fetchClassSubjectTemplates } from "@/report/lib/class-subjects";
import { isMissingSchemaColumnError } from "@/report/lib/supabase-errors";
import { applyTermDatesToForm, fetchTermReportDates } from "@/report/lib/terms";
import { EXPORTABLE_STATUSES, type ReportCardStatus } from "@/report/lib/report-card-status";
import { getComputedSubjectPositionsForStudent, getStudentClassPosition } from "@/report/lib/ranking";
import type { GradingFormat } from "@/report/lib/grading";
import { formatRankLabel } from "@/report/lib/shepherd-grading";
import {
  DEFAULT_SUBJECTS,
  clearReportPositions,
  lookupBySubjectName,
  mergeReportSubjects,
  recalcSubject,
  subjectCanonicalKey,
  totalFromSubjects,
  type ReportFormData,
  type SubjectRow,
} from "@/report/lib/shepherd-grading";

/** Safe list columns (no optional delivery migration columns). */
export const TERM_REPORT_ADMIN_LIST_SELECT =
  "id, student_id, student_name, class_name, class_id, term_id, term_label, academic_year, status, total_score, class_position, subjects, submitted_at, saved_at, updated_at, teacher_id";

export const TERM_REPORT_HISTORY_LIST_SELECT =
  "id, student_name, class_name, class_id, term_id, term_label, academic_year, status, total_score, class_position, subjects, submitted_at, saved_at, updated_at";

export const TERM_REPORT_ARCHIVE_LIST_SELECT =
  "id, student_id, student_name, class_name, term_id, term_label, academic_year, status, updated_at";

const TERM_REPORT_SELECT_BASE =
  "id, school_id, student_id, term_id, class_id, teacher_id, status, student_name, class_name, roll_number, class_position, class_student_total_manual, term_label, academic_year, attendance_made, attendance_total, conduct, interest, club, attitude, teacher_remark, school_closes, reopening_date, next_term, teacher_sign_date, head_sign_date, parent_sign_date, admin_comment, rejection_reason, subjects, total_score, version, saved_at, submitted_at, created_at, updated_at";

const TERM_REPORT_DELIVERY_COLS =
  ", published_at, published_by, sent_to_parents_at, sent_to_parents_by";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseResult = { data: any; error: { code?: string; message?: string } | null };

async function selectTermReportColumns(
  run: (columns: string) => PromiseLike<SupabaseResult>,
): Promise<SupabaseResult> {
  let result = await run(TERM_REPORT_SELECT_BASE + TERM_REPORT_DELIVERY_COLS);
  if (isMissingSchemaColumnError(result.error)) {
    result = await run(
      TERM_REPORT_SELECT_BASE.replace(", class_student_total_manual", "") + TERM_REPORT_DELIVERY_COLS,
    );
  }
  if (isMissingSchemaColumnError(result.error)) {
    result = await run(TERM_REPORT_SELECT_BASE.replace(", class_student_total_manual", ""));
  }
  return result;
}

export type TermReportRow = {
  id: string;
  school_id: string;
  student_id: string;
  term_id: string | null;
  class_id: string | null;
  teacher_id: string | null;
  status: ReportCardStatus;
  student_name: string;
  class_name: string | null;
  roll_number: number | null;
  class_position: string | null;
  class_student_total_manual: number | null;
  term_label: string | null;
  academic_year: string | null;
  attendance_made: string | null;
  attendance_total: string | null;
  conduct: string | null;
  interest: string | null;
  club: string | null;
  attitude: string | null;
  teacher_remark: string | null;
  school_closes: string | null;
  reopening_date: string | null;
  next_term: string | null;
  teacher_sign_date: string | null;
  head_sign_date: string | null;
  parent_sign_date: string | null;
  admin_comment: string | null;
  rejection_reason: string | null;
  subjects: SubjectRow[];
  total_score: number | null;
  version: number;
  saved_at: string | null;
  submitted_at: string | null;
  published_at: string | null;
  published_by: string | null;
  sent_to_parents_at: string | null;
  sent_to_parents_by: string | null;
  created_at: string;
  updated_at: string;
};

export function rowToForm(
  row: TermReportRow,
  format: GradingFormat = "letter",
  subjectTemplates: SubjectRow[] = DEFAULT_SUBJECTS,
): ReportFormData {
  const templates = subjectTemplates.length ? subjectTemplates : DEFAULT_SUBJECTS;
  return {
    studentName: row.student_name,
    className: row.class_name ?? "",
    rollNo: row.roll_number ?? "",
    totalStudentsInClassManual:
      row.class_student_total_manual != null ? String(row.class_student_total_manual) : "",
    totalStudentsInClassAuto: null,
    position: row.class_position ?? "",
    term: row.term_label ?? "",
    academicYear: row.academic_year ?? "",
    attendanceMade: row.attendance_made ?? "",
    attendanceTotal: row.attendance_total ?? "",
    conduct: row.conduct ?? "Good",
    interest: row.interest ?? "High",
    club: row.club ?? "—",
    attitude: row.attitude ?? "Positive",
    teacherRemark: row.teacher_remark ?? "",
    schoolCloses: row.school_closes ?? "",
    reopeningDate: row.reopening_date ?? "",
    nextTerm: row.next_term ?? "Third Term",
    teacherSignDate: row.teacher_sign_date ?? "",
    headSignDate: row.head_sign_date ?? "",
    parentSignDate: row.parent_sign_date ?? "",
    subjects: mergeReportSubjects(
      (row.subjects?.length ? row.subjects : []).map((s) => recalcSubject(s, format)),
      undefined,
      format,
      templates,
    ),
  };
}

/** Merge saved report fields with school term close / reopening dates when blank. */
export async function rowToFormWithTermDates(
  row: TermReportRow,
  format: GradingFormat = "letter",
): Promise<ReportFormData> {
  const templates = row.class_id
    ? await fetchClassSubjectTemplates(row.class_id)
    : DEFAULT_SUBJECTS;
  const templatesOrDefault = templates.length ? templates : DEFAULT_SUBJECTS;
  const form = rowToForm(row, format, templatesOrDefault);
  const withCount = await enrichFormWithClassReportCount(form, row.class_id, row.term_id);
  if (!row.term_id) return withCount;
  const dates = await fetchTermReportDates(row.school_id, row.term_id);
  return applyTermDatesToForm(withCount, dates);
}

export function formToPayload(
  form: ReportFormData,
  meta: {
    schoolId: string;
    studentId: string;
    termId: string | null;
    classId: string | null;
    teacherId: string;
    status: ReportCardStatus;
    adminComment?: string | null;
    rejectionReason?: string | null;
  },
) {
  const total = totalFromSubjects(form.subjects);
  return {
    school_id: meta.schoolId,
    student_id: meta.studentId,
    term_id: meta.termId,
    class_id: meta.classId,
    teacher_id: meta.teacherId,
    status: meta.status,
    student_name: form.studentName,
    class_name: form.className,
    roll_number: Number(form.rollNo) || null,
    class_position: form.position,
    class_student_total_manual: (() => {
      const manual = String(form.totalStudentsInClassManual ?? "").trim();
      if (!manual) return null;
      const n = Number(manual);
      return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
    })(),
    term_label: form.term,
    academic_year: form.academicYear,
    attendance_made: form.attendanceMade,
    attendance_total: form.attendanceTotal,
    conduct: form.conduct,
    interest: form.interest,
    club: form.club,
    attitude: form.attitude,
    teacher_remark: form.teacherRemark,
    school_closes: form.schoolCloses,
    reopening_date: form.reopeningDate,
    next_term: form.nextTerm,
    teacher_sign_date: form.teacherSignDate,
    head_sign_date: form.headSignDate,
    parent_sign_date: form.parentSignDate,
    admin_comment: meta.adminComment ?? undefined,
    rejection_reason: meta.rejectionReason ?? undefined,
    subjects: form.subjects,
    total_score: total,
    saved_at: meta.status !== "draft" ? new Date().toISOString() : null,
  };
}

export type ReportVersionRow = {
  id: string;
  report_id: string;
  version: number;
  status: ReportCardStatus;
  form_snapshot: ReportFormData;
  changed_by: string | null;
  change_note: string | null;
  created_at: string;
  changer_name?: string;
};

export async function fetchReportVersions(reportId: string): Promise<ReportVersionRow[]> {
  const { data, error } = await supabase
    .from("term_report_card_versions")
    .select(
      "id, report_id, version, status, form_snapshot, changed_by, change_note, created_at",
    )
    .eq("report_id", reportId)
    .order("version", { ascending: false });
  if (error) throw error;

  const rows = data ?? [];
  const changerIds = Array.from(
    new Set(rows.map((r) => r.changed_by).filter((v): v is string => !!v)),
  );
  const nameMap = new Map<string, string>();
  if (changerIds.length) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", changerIds);
    (profs ?? []).forEach((p) => nameMap.set(p.id, p.full_name));
  }

  return rows.map((row) => {
    const snap = row.form_snapshot as unknown as ReportFormData;
    return {
      id: row.id,
      report_id: row.report_id,
      version: row.version,
      status: row.status as ReportCardStatus,
      form_snapshot: {
        ...snap,
        subjects: (snap.subjects ?? DEFAULT_SUBJECTS).map((s) => recalcSubject(s)),
      },
      changed_by: row.changed_by,
      change_note: row.change_note,
      created_at: row.created_at,
      changer_name: row.changed_by ? nameMap.get(row.changed_by) : undefined,
    };
  });
}

export async function saveReportVersion(
  reportId: string,
  version: number,
  status: ReportCardStatus,
  form: ReportFormData,
  changedBy: string,
  note?: string,
) {
  const { error } = await supabase.from("term_report_card_versions").insert({
    report_id: reportId,
    version,
    status,
    form_snapshot: form as never,
    changed_by: changedBy,
    change_note: note,
  });
  if (error) throw error;
}

export type LoadResultsOpts = {
  /** When false, scores/grades load but positions stay empty until Generate Positions. */
  includePositions?: boolean;
  /** When false, keep scores already saved on the report card instead of overwriting from results. */
  preferResultsScores?: boolean;
  classId?: string | null;
  gradingFormat?: GradingFormat;
  /** Admin-assigned subjects for the class; defaults to rows already on the form. */
  subjectTemplates?: SubjectRow[];
};

export async function loadResultsIntoForm(
  studentId: string,
  termId: string,
  base: ReportFormData,
  opts?: LoadResultsOpts | string | null,
): Promise<ReportFormData> {
  const options: LoadResultsOpts =
    typeof opts === "string" || opts === null || opts === undefined
      ? { classId: opts ?? undefined, includePositions: true }
      : opts;
  const includePositions = options.includePositions !== false;
  const preferResultsScores = options.preferResultsScores !== false;
  const format = options.gradingFormat ?? "letter";
  const templates =
    options.subjectTemplates?.length
      ? options.subjectTemplates
      : base.subjects.length
        ? base.subjects
        : DEFAULT_SUBJECTS;

  const [{ data: results }, { data: reportRow }] = await Promise.all([
    supabase
      .from("results")
      .select("ca_score, exam_score, position, grade, remark, subjects(name)")
      .eq("student_id", studentId)
      .eq("term_id", termId),
    includePositions
      ? supabase
          .from("term_report_cards")
          .select("class_position")
          .eq("student_id", studentId)
          .eq("term_id", termId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const byName = new Map<
    string,
    { ca: number; exam: number; position?: number | null; grade?: string | null; remark?: string | null }
  >();
  for (const r of results ?? []) {
    const name = (r.subjects as { name: string })?.name;
    if (!name) continue;
    byName.set(subjectCanonicalKey(name), {
      ca: (Number(r.ca_score) / 40) * 50,
      exam: (Number(r.exam_score) / 60) * 50,
      position: r.position,
      grade: r.grade,
      remark: r.remark,
    });
  }

  const hasSavedScores = (s: SubjectRow) =>
    s.total > 0 || s.classScore > 0 || s.examScore > 0;

  const subjectsWithScores = mergeReportSubjects(base.subjects, undefined, format, templates).map((s) => {
    const found = lookupBySubjectName(byName, s.name);
    if (!found) return s;
    if (!preferResultsScores && hasSavedScores(s)) {
      return recalcSubject(
        {
          ...s,
          position:
            includePositions && found.position != null
              ? formatRankLabel(found.position)
              : includePositions
                ? "—"
                : s.position,
        },
        format,
      );
    }
    return recalcSubject(
      {
        ...s,
        classScore: Math.round(found.ca * 100) / 100,
        examScore: Math.round(found.exam * 100) / 100,
        position:
          includePositions && found.position != null
            ? formatRankLabel(found.position)
            : includePositions
              ? "—"
              : s.position,
      },
      format,
    );
  });

  let subjects = subjectsWithScores;
  let classPosition = base.position;

  if (includePositions) {
    let positionsFromResults = new Map<string, number>();
    if (options.classId) {
      positionsFromResults = await getComputedSubjectPositionsForStudent(
        options.classId,
        termId,
        studentId,
      );
    }
    if (positionsFromResults.size === 0) {
      for (const [canonical, scores] of byName) {
        if (scores.position != null) positionsFromResults.set(canonical, scores.position);
      }
    }
    subjects = mergeReportSubjects(
      subjectsWithScores,
      positionsFromResults.size > 0 ? positionsFromResults : undefined,
      format,
      templates,
    );
    classPosition =
      (options.classId
        ? await getStudentClassPosition(studentId, options.classId, termId)
        : null) ??
      reportRow?.class_position ??
      (base.position && base.position !== "—" ? base.position : "");
  } else {
    subjects = mergeReportSubjects(subjectsWithScores, undefined, format, templates);
  }

  const merged = {
    ...base,
    subjects,
    position: includePositions ? formatRankLabel(classPosition || base.position) : base.position,
  };
  return includePositions ? merged : clearReportPositions(merged);
}

/** Keep stored positions in DB when saving a form that hides positions in the UI. */
export function mergeStoredPositionsForSave(
  form: ReportFormData,
  stored: TermReportRow | null,
): ReportFormData {
  if (!stored) return form;
  const posByKey = new Map(
    (stored.subjects ?? []).map((s) => [subjectCanonicalKey(s.name), s.position]),
  );
  return {
    ...form,
    position: stored.class_position ?? form.position,
    subjects: form.subjects.map((s) => {
      const kept = posByKey.get(subjectCanonicalKey(s.name));
      return kept && kept !== "—" ? { ...s, position: kept } : s;
    }),
  };
}

export async function fetchTermReport(studentId: string, termId: string | null) {
  const { data, error } = await selectTermReportColumns((columns) => {
    let q = supabase.from("term_report_cards").select(columns).eq("student_id", studentId);
    q = termId ? q.eq("term_id", termId) : q.is("term_id", null);
    return q.maybeSingle();
  });
  if (error) throw error;
  if (!data) return null;
  return parseRow(data as Record<string, unknown>);
}

export async function fetchTermReportById(id: string) {
  const { data, error } = await selectTermReportColumns((columns) =>
    supabase.from("term_report_cards").select(columns).eq("id", id).single(),
  );
  if (error) throw error;
  return parseRow(data as Record<string, unknown>);
}

/** Number of term report card rows created for a class in a given term. */
export async function fetchClassTermReportCount(
  classId: string,
  termId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("term_report_cards")
    .select("id", { count: "exact", head: true })
    .eq("class_id", classId)
    .eq("term_id", termId);
  if (error) throw error;
  return count ?? 0;
}

/** Attach auto-calculated class size from report count (does not change manual override). */
export async function enrichFormWithClassReportCount(
  form: ReportFormData,
  classId: string | null | undefined,
  termId: string | null | undefined,
): Promise<ReportFormData> {
  if (!classId || !termId) {
    return { ...form, totalStudentsInClassAuto: null };
  }
  const auto = await fetchClassTermReportCount(classId, termId);
  return { ...form, totalStudentsInClassAuto: auto };
}

export type ClassTermExportReport = {
  id: string;
  studentId: string;
  studentName: string;
  status: ReportCardStatus;
  form: ReportFormData;
};

/** All submitted+ report cards for a class and term that teachers may print or export. */
export async function fetchClassTermExportableReports(
  opts: {
    classId: string;
    termId: string;
    teacherId: string;
  },
  format: GradingFormat = "letter",
): Promise<ClassTermExportReport[]> {
  const { data, error } = await selectTermReportColumns((columns) =>
    supabase
      .from("term_report_cards")
      .select(columns)
      .eq("class_id", opts.classId)
      .eq("term_id", opts.termId)
      .eq("teacher_id", opts.teacherId)
      .in("status", [...EXPORTABLE_STATUSES])
      .order("student_name"),
  );
  if (error) throw error;

  const rows = (data ?? []).map((row: Record<string, unknown>) => parseRow(row));
  const items: ClassTermExportReport[] = [];
  for (const row of rows) {
    items.push({
      id: row.id,
      studentId: row.student_id,
      studentName: row.student_name,
      status: row.status,
      form: await rowToFormWithTermDates(row, format),
    });
  }
  return items;
}

function parseRow(data: Record<string, unknown>): TermReportRow {
  return {
    ...(data as TermReportRow),
    class_student_total_manual:
      (data.class_student_total_manual as number | null | undefined) ?? null,
    subjects: (data.subjects as SubjectRow[]) ?? [],
    published_at: (data.published_at as string | null | undefined) ?? null,
    published_by: (data.published_by as string | null | undefined) ?? null,
    sent_to_parents_at: (data.sent_to_parents_at as string | null | undefined) ?? null,
    sent_to_parents_by: (data.sent_to_parents_by as string | null | undefined) ?? null,
  };
}

const FAMILY_STATUSES = ["published", "approved"] as const;

export async function fetchPublishedTermReports(studentId: string) {
  const { data, error } = await selectTermReportColumns((columns) =>
    supabase
      .from("term_report_cards")
      .select(columns)
      .eq("student_id", studentId)
      .in("status", [...FAMILY_STATUSES])
      .order("academic_year", { ascending: false })
      .order("term_label", { ascending: false })
      .order("saved_at", { ascending: false }),
  );
  if (error) throw error;
  return (data ?? []).map((row: Record<string, unknown>) => parseRow(row));
}

export async function fetchPublishedReportsForParent(parentId: string) {
  const { data: links, error: linkErr } = await supabase
    .from("parent_students")
    .select("student_id, students(full_name)")
    .eq("parent_id", parentId);
  if (linkErr) throw linkErr;

  const studentIds = (links ?? []).map((l) => l.student_id);
  if (!studentIds.length) return [];

  const nameById = new Map(
    (links ?? []).map((l) => [
      l.student_id,
      (l.students as { full_name: string } | null)?.full_name ?? "Student",
    ]),
  );

  const { data, error } = await selectTermReportColumns((columns) =>
    supabase
      .from("term_report_cards")
      .select(columns)
      .in("student_id", studentIds)
      .in("status", [...FAMILY_STATUSES])
      .order("saved_at", { ascending: false }),
  );
  if (error) throw error;

  return (data ?? []).map((row: Record<string, unknown>) => ({
    ...parseRow(row),
    studentDisplayName: nameById.get(row.student_id as string) ?? (row.student_name as string),
  })) as (TermReportRow & { studentDisplayName: string })[];
}

export async function fetchPublishedTermReport(studentId: string, reportId?: string) {
  if (reportId) {
    const { data, error } = await selectTermReportColumns((columns) =>
      supabase
        .from("term_report_cards")
        .select(columns)
        .eq("id", reportId)
        .eq("student_id", studentId)
        .in("status", [...FAMILY_STATUSES])
        .maybeSingle(),
    );
    if (error) throw error;
    if (!data) return null;
    return parseRow(data as Record<string, unknown>);
  }

  const { data: student } = await supabase
    .from("students")
    .select("school_id")
    .eq("id", studentId)
    .single();
  if (!student) return null;

  const { data: term } = await supabase
    .from("terms")
    .select("id")
    .eq("school_id", student.school_id)
    .eq("is_current", true)
    .maybeSingle();

  const { data, error } = await selectTermReportColumns((columns) => {
    let q = supabase
      .from("term_report_cards")
      .select(columns)
      .eq("student_id", studentId)
      .in("status", [...FAMILY_STATUSES]);
    if (term?.id) q = q.eq("term_id", term.id);
    return q.order("saved_at", { ascending: false }).limit(1).maybeSingle();
  });
  if (error) throw error;
  if (!data) return null;
  return parseRow(data as Record<string, unknown>);
}

/** Save teacher edits to an existing report (e.g. from history view). */
export async function saveTeacherReportEdits(
  report: TermReportRow,
  form: ReportFormData,
  teacherId: string,
  note = "Teacher saved edits",
  skipVersion = false,
) {
  const nextVersion = skipVersion ? (report.version ?? 1) : (report.version ?? 1) + 1;
  const payload = {
    ...formToPayload(form, {
      schoolId: report.school_id,
      studentId: report.student_id,
      termId: report.term_id,
      classId: report.class_id,
      teacherId,
      status: report.status as ReportCardStatus,
    }),
    saved_at: new Date().toISOString(),
    version: nextVersion,
  };
  const { error } = await supabase
    .from("term_report_cards")
    .update(payload as never)
    .eq("id", report.id);
  if (error) throw error;
  if (!skipVersion) {
    try {
      await saveReportVersion(
        report.id,
        nextVersion,
        report.status as ReportCardStatus,
        form,
        teacherId,
        note,
      );
    } catch {
      /* version history optional */
    }
  }
}