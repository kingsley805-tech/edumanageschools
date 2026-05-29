import { supabase } from "@/integrations/supabase/client";

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
    return { attendanceMade: "", attendanceTotal: "", position: "" };
  }
  return {
    attendanceMade: String(summary.present_count),
    attendanceTotal: String(summary.total_days),
    attendancePercent: summary.attendance_percentage,
  };
}
