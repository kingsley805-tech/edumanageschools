import { supabase } from "@/integrations/supabase/client";
import type { ReportFormData } from "@/report/lib/shepherd-grading";

export type AttendanceSummary = {
  id: string;
  school_id: string;
  student_id: string;
  term_id: string | null;
  total_days: number;
  present_count: number;
  absent_count: number;
  late_count: number;
  excused_count: number;
  sick_count: number;
  attendance_percentage: number;
};

export type StudentAttendanceRow = {
  id: string;
  attendance_date: string;
  attendance_status: string;
  time_in: string | null;
  remark: string | null;
  subjects?: { name: string } | null;
};

export type MonthlyAttendancePoint = {
  month: string;
  present: number;
  absent: number;
  late: number;
  rate: number;
};

const STATUS_PRIORITY: Record<string, number> = {
  present: 1,
  late: 2,
  excused: 3,
  absent: 4,
  sick: 5,
  suspended: 6,
};

function statusPriority(status: string): number {
  return STATUS_PRIORITY[status.toLowerCase()] ?? 99;
}

function mergeDayStatus(existing: string | undefined, next: string): string {
  if (!existing) return next;
  return statusPriority(existing) <= statusPriority(next) ? existing : next;
}

export async function syncRegisterAttendance(registerId: string) {
  const { error } = await supabase.rpc("sync_register_to_attendance", {
    p_register_id: registerId,
  });
  if (error) {
    const msg = (error.message ?? "").toLowerCase();
    if (error.code === "42883" || msg.includes("sync_register_to_attendance")) return;
    throw error;
  }
}

export async function fetchAttendanceSummary(
  studentId: string,
  termId?: string | null,
): Promise<AttendanceSummary | null> {
  let q = supabase.from("attendance_summaries").select("*").eq("student_id", studentId);
  if (termId) q = q.eq("term_id", termId);
  else q = q.is("term_id", null);

  const { data, error } = await q.maybeSingle();
  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") return null;
    throw error;
  }
  return data as AttendanceSummary | null;
}

/** Aggregate term attendance for all students in a class (from precomputed summaries). */
export async function fetchClassAttendanceSummary(
  classId: string,
  termId?: string | null,
): Promise<AttendanceSummary | null> {
  const { data: students, error: studentsErr } = await supabase
    .from("students")
    .select("id")
    .eq("class_id", classId);
  if (studentsErr) throw studentsErr;
  const ids = (students ?? []).map((s) => s.id);
  if (!ids.length) return null;

  let q = supabase.from("attendance_summaries").select("*").in("student_id", ids);
  if (termId) q = q.eq("term_id", termId);
  else q = q.is("term_id", null);

  const { data, error } = await q;
  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") return null;
    throw error;
  }
  const rows = (data ?? []) as AttendanceSummary[];
  if (!rows.length) return null;

  const totalDays = rows.reduce((a, r) => a + r.total_days, 0);
  const present = rows.reduce((a, r) => a + r.present_count, 0);
  const absent = rows.reduce((a, r) => a + r.absent_count, 0);
  const late = rows.reduce((a, r) => a + r.late_count, 0);
  const excused = rows.reduce((a, r) => a + r.excused_count, 0);
  const sick = rows.reduce((a, r) => a + r.sick_count, 0);
  const pct = totalDays > 0 ? Math.round((present / totalDays) * 10000) / 100 : 0;

  return {
    id: "",
    school_id: rows[0].school_id,
    student_id: "",
    term_id: termId ?? null,
    total_days: totalDays,
    present_count: present,
    absent_count: absent,
    late_count: late,
    excused_count: excused,
    sick_count: sick,
    attendance_percentage: pct,
  };
}

async function fetchTermDateBounds(termId?: string | null): Promise<{ start: string; end: string } | null> {
  if (!termId) return null;
  const { data } = await supabase
    .from("terms")
    .select("start_date, end_date")
    .eq("id", termId)
    .maybeSingle();
  if (!data?.start_date || !data?.end_date) return null;
  return { start: data.start_date, end: data.end_date };
}

/** Monthly present/absent trend for a student within a term (deduped by school day). */
export async function fetchMonthlyAttendanceTrend(
  studentId: string,
  termId?: string | null,
): Promise<MonthlyAttendancePoint[]> {
  const bounds = await fetchTermDateBounds(termId);
  const byDate = new Map<string, string>();

  let registerQuery = supabase
    .from("attendance_records")
    .select("attendance_date, attendance_status")
    .eq("student_id", studentId)
    .order("attendance_date", { ascending: true });

  if (termId) registerQuery = registerQuery.eq("term_id", termId);
  if (bounds) {
    registerQuery = registerQuery
      .gte("attendance_date", bounds.start)
      .lte("attendance_date", bounds.end);
  }

  const { data: registerRows } = await registerQuery;
  for (const row of registerRows ?? []) {
    const date = row.attendance_date;
    const status = (row.attendance_status ?? "absent").toLowerCase();
    byDate.set(date, mergeDayStatus(byDate.get(date), status));
  }

  let legacyQuery = supabase
    .from("attendance")
    .select("date, status")
    .eq("student_id", studentId)
    .order("date", { ascending: true });

  if (bounds) {
    legacyQuery = legacyQuery.gte("date", bounds.start).lte("date", bounds.end);
  }

  const { data: legacyRows } = await legacyQuery;
  for (const row of legacyRows ?? []) {
    if (byDate.has(row.date)) continue;
    byDate.set(row.date, (row.status ?? "absent").toLowerCase());
  }

  const byMonth = new Map<string, { present: number; absent: number; late: number; total: number }>();
  for (const [date, status] of byDate) {
    const month = date.slice(0, 7);
    const bucket = byMonth.get(month) ?? { present: 0, absent: 0, late: 0, total: 0 };
    bucket.total += 1;
    if (status === "present") bucket.present += 1;
    else if (status === "late") bucket.late += 1;
    else bucket.absent += 1;
    byMonth.set(month, bucket);
  }

  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, stats]) => {
      const label = new Date(`${month}-01`).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
      return {
        month: label,
        present: stats.present,
        absent: stats.absent,
        late: stats.late,
        rate: stats.total ? Math.round((stats.present / stats.total) * 100) : 0,
      };
    });
}

export async function fetchStudentAttendanceRecords(
  studentId: string,
  limit = 30,
): Promise<StudentAttendanceRow[]> {
  const { data, error } = await supabase
    .from("attendance_records")
    .select("id, attendance_date, attendance_status, time_in, remark, subjects(name)")
    .eq("student_id", studentId)
    .order("attendance_date", { ascending: false })
    .limit(limit);

  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") return [];
    throw error;
  }
  return (data ?? []) as StudentAttendanceRow[];
}

export function formatAttendanceForReportCard(summary: AttendanceSummary | null) {
  if (!summary || !summary.total_days) {
    return {
      attendanceMade: "",
      attendanceTotal: "",
      attendanceAbsent: "",
      attendanceLate: "",
      attendanceExcused: "",
      attendancePercent: "",
    };
  }
  return {
    attendanceMade: String(summary.present_count),
    attendanceTotal: String(summary.total_days),
    attendanceAbsent: String(summary.absent_count),
    attendanceLate: String(summary.late_count),
    attendanceExcused: String(summary.excused_count),
    attendancePercent: summary.attendance_percentage.toFixed(2),
  };
}

/** Apply live attendance summary to report form (preserves manual overrides when set). */
export function applyAttendanceSummaryToForm(
  form: ReportFormData,
  summary: AttendanceSummary | null,
): ReportFormData {
  if (!summary || summary.total_days <= 0) return form;
  const formatted = formatAttendanceForReportCard(summary);
  const patch: Partial<ReportFormData> = {};

  if (!String(form.attendanceMade ?? "").trim()) patch.attendanceMade = formatted.attendanceMade;
  if (!String(form.attendanceTotal ?? "").trim()) patch.attendanceTotal = formatted.attendanceTotal;
  if (!String(form.attendanceAbsent ?? "").trim()) patch.attendanceAbsent = formatted.attendanceAbsent;
  if (!String(form.attendanceLate ?? "").trim()) patch.attendanceLate = formatted.attendanceLate;
  if (!String(form.attendanceExcused ?? "").trim()) patch.attendanceExcused = formatted.attendanceExcused;
  if (!String(form.attendancePercent ?? "").trim()) patch.attendancePercent = formatted.attendancePercent;

  return { ...form, ...patch };
}

export async function enrichFormWithAttendanceSummary(
  form: ReportFormData,
  studentId: string,
  termId?: string | null,
): Promise<ReportFormData> {
  const summary = await fetchAttendanceSummary(studentId, termId);
  return applyAttendanceSummaryToForm(form, summary);
}
