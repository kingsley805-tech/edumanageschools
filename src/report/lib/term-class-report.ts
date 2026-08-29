import { supabase } from "@/integrations/supabase/client";
import type { OverallClassReportData } from "@/report/lib/overall-class-report";
import type { ReportCardStatus } from "@/report/lib/report-card-status";

export type TermClassReportRow = {
  id: string;
  school_id: string;
  class_id: string;
  term_id: string;
  teacher_id: string | null;
  status: ReportCardStatus;
  class_name: string | null;
  term_label: string | null;
  academic_year: string | null;
  student_count: number;
  subject_count: number;
  snapshot: OverallClassReportData;
  admin_comment: string | null;
  rejection_reason: string | null;
  version: number;
  saved_at: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
};

const SELECT_COLS =
  "id, school_id, class_id, term_id, teacher_id, status, class_name, term_label, academic_year, student_count, subject_count, snapshot, admin_comment, rejection_reason, version, saved_at, submitted_at, reviewed_at, approved_at, created_at, updated_at";

function parseRow(data: Record<string, unknown>): TermClassReportRow {
  const snapshot = (data.snapshot ?? {}) as OverallClassReportData;
  return {
    ...(data as Omit<TermClassReportRow, "snapshot" | "status">),
    status: data.status as ReportCardStatus,
    snapshot,
  };
}

export async function fetchTermClassReport(
  classId: string,
  termId: string,
): Promise<TermClassReportRow | null> {
  const { data, error } = await supabase
    .from("term_class_reports" as never)
    .select(SELECT_COLS)
    .eq("class_id", classId)
    .eq("term_id", termId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return parseRow(data as Record<string, unknown>);
}

export async function fetchTermClassReportById(id: string): Promise<TermClassReportRow> {
  const { data, error } = await supabase
    .from("term_class_reports" as never)
    .select(SELECT_COLS)
    .eq("id", id)
    .single();
  if (error) throw error;
  return parseRow(data as Record<string, unknown>);
}

export async function fetchTeacherTermClassReports(
  classIds: string[],
): Promise<TermClassReportRow[]> {
  if (!classIds.length) return [];
  const { data, error } = await supabase
    .from("term_class_reports" as never)
    .select(SELECT_COLS)
    .in("class_id", classIds)
    .neq("status", "draft")
    .order("academic_year", { ascending: false })
    .order("term_label", { ascending: false })
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => parseRow(row as Record<string, unknown>));
}

export async function fetchAdminTermClassReports(
  schoolId: string,
): Promise<TermClassReportRow[]> {
  const { data, error } = await supabase
    .from("term_class_reports" as never)
    .select(SELECT_COLS)
    .eq("school_id", schoolId)
    .neq("status", "draft")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => parseRow(row as Record<string, unknown>));
}

async function saveVersion(opts: {
  reportId: string;
  version: number;
  status: ReportCardStatus;
  snapshot: OverallClassReportData;
  changedBy: string;
  note?: string;
}) {
  const { error } = await supabase.from("term_class_report_versions" as never).insert({
    report_id: opts.reportId,
    version: opts.version,
    status: opts.status,
    snapshot: opts.snapshot,
    changed_by: opts.changedBy,
    note: opts.note ?? null,
  } as never);
  if (error) console.error("term_class_report_versions insert failed:", error);
}

export async function upsertTermClassReport(opts: {
  schoolId: string;
  classId: string;
  termId: string;
  /** Class teacher — never overwrite with an admin actor id. */
  teacherId: string | null;
  /** Who performed this write (for version history). */
  changedBy: string;
  status: ReportCardStatus;
  snapshot: OverallClassReportData;
  adminComment?: string | null;
  rejectionReason?: string | null;
  note?: string;
  skipVersion?: boolean;
  existing?: TermClassReportRow | null;
}): Promise<TermClassReportRow> {
  const now = new Date().toISOString();
  const existing =
    opts.existing ?? (await fetchTermClassReport(opts.classId, opts.termId));
  const nextVersion = opts.skipVersion
    ? (existing?.version ?? 1)
    : (existing?.version ?? 0) + 1;

  const payload: Record<string, unknown> = {
    school_id: opts.schoolId,
    class_id: opts.classId,
    term_id: opts.termId,
    teacher_id: opts.teacherId ?? existing?.teacher_id ?? null,
    status: opts.status,
    class_name: opts.snapshot.className,
    term_label: opts.snapshot.termLabel,
    academic_year: opts.snapshot.academicYear,
    student_count: opts.snapshot.students.length,
    subject_count: opts.snapshot.subjects.length,
    snapshot: opts.snapshot,
    version: nextVersion,
    saved_at: now,
    updated_at: now,
  };

  if (opts.adminComment !== undefined) payload.admin_comment = opts.adminComment;
  if (opts.rejectionReason !== undefined) {
    payload.rejection_reason = opts.rejectionReason;
  }

  if (opts.status === "pending_review" || opts.status === "saved") {
    payload.submitted_at = now;
  }
  if (opts.status === "reviewed") payload.reviewed_at = now;
  if (opts.status === "approved" || opts.status === "published") {
    payload.approved_at = now;
  }

  const { data, error } = await supabase
    .from("term_class_reports" as never)
    .upsert(payload as never, {
      onConflict: "school_id,class_id,term_id",
      ignoreDuplicates: false,
    })
    .select(SELECT_COLS)
    .single();
  if (error) throw error;

  const parsed = parseRow(data as Record<string, unknown>);
  if (!opts.skipVersion) {
    await saveVersion({
      reportId: parsed.id,
      version: nextVersion,
      status: opts.status,
      snapshot: opts.snapshot,
      changedBy: opts.changedBy,
      note: opts.note,
    });
  }
  return parsed;
}

export async function updateTermClassReportStatus(opts: {
  report: TermClassReportRow;
  status: ReportCardStatus;
  actorId: string;
  adminComment?: string | null;
  rejectionReason?: string | null;
  note?: string;
}): Promise<TermClassReportRow> {
  return upsertTermClassReport({
    schoolId: opts.report.school_id,
    classId: opts.report.class_id,
    termId: opts.report.term_id,
    // Preserve the original teacher — never write the admin actor into teacher_id.
    teacherId: opts.report.teacher_id,
    changedBy: opts.actorId,
    status: opts.status,
    snapshot: opts.report.snapshot,
    adminComment: opts.adminComment,
    rejectionReason: opts.rejectionReason,
    note: opts.note,
    existing: opts.report,
  });
}
