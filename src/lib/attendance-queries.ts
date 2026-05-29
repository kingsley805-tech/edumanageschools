import { supabase } from "@/integrations/supabase/client";
import { studentDisplayName } from "@/register/lib/api";
import { fetchAttendanceSummary } from "@/register/lib/attendance";

export type UnifiedAttendanceRow = {
  id: string;
  date: string;
  status: string;
  studentId: string;
  classId: string;
  studentName: string;
  admissionNo: string;
  className: string;
  subjectName?: string;
  source: "register" | "legacy";
};

type StudentJoin = {
  admission_no?: string | null;
  admission_number?: string | null;
  full_name?: string | null;
  school_id?: string;
  profiles?: { full_name?: string | null } | { full_name?: string | null }[] | null;
};

function normalizeStatus(status: string): string {
  return status?.toLowerCase() ?? "absent";
}

function rowFromRegister(r: {
  id: string;
  attendance_date: string;
  attendance_status: string;
  student_id: string;
  class_id: string;
  students: StudentJoin | null;
  classes: { name?: string } | null;
  subjects?: { name?: string } | null;
}): UnifiedAttendanceRow {
  const student = r.students ?? {};
  return {
    id: r.id,
    date: r.attendance_date,
    status: normalizeStatus(r.attendance_status),
    studentId: r.student_id,
    classId: r.class_id,
    studentName: studentDisplayName(student),
    admissionNo: student.admission_no ?? student.admission_number ?? "—",
    className: r.classes?.name ?? "—",
    subjectName: r.subjects?.name,
    source: "register",
  };
}

function rowFromLegacy(r: {
  id: string;
  date: string;
  status: string;
  student_id: string;
  class_id: string;
  students: StudentJoin | null;
  classes: { name?: string } | null;
}): UnifiedAttendanceRow {
  const student = r.students ?? {};
  return {
    id: r.id,
    date: r.date,
    status: normalizeStatus(r.status),
    studentId: r.student_id,
    classId: r.class_id,
    studentName: studentDisplayName(student),
    admissionNo: student.admission_no ?? student.admission_number ?? "—",
    className: r.classes?.name ?? "—",
    source: "legacy",
  };
}

export async function saveTeacherClassAttendance(
  classId: string,
  date: string,
  records: { student_id: string; status: string }[],
): Promise<void> {
  const { error } = await supabase.rpc("save_teacher_class_attendance", {
    p_class_id: classId,
    p_date: date,
    p_records: records,
  });
  if (error) throw error;
}

export async function fetchSchoolAttendanceList(
  schoolId: string,
  opts: { classId?: string; limit?: number } = {},
): Promise<UnifiedAttendanceRow[]> {
  const limit = opts.limit ?? 100;
  const studentSelect =
    "admission_no, admission_number, full_name, school_id, profiles:profile_id(full_name)";

  let registerQuery = supabase
    .from("attendance_records")
    .select(
      `id, attendance_date, attendance_status, student_id, class_id,
       students!inner(${studentSelect}), classes(name), subjects(name)`,
    )
    .eq("school_id", schoolId)
    .order("attendance_date", { ascending: false })
    .limit(limit);

  let legacyQuery = supabase
    .from("attendance")
    .select(
      `id, date, status, student_id, class_id,
       students!inner(${studentSelect}), classes(name)`,
    )
    .eq("students.school_id", schoolId)
    .order("date", { ascending: false })
    .limit(limit);

  if (opts.classId) {
    registerQuery = registerQuery.eq("class_id", opts.classId);
    legacyQuery = legacyQuery.eq("class_id", opts.classId);
  }

  const [registerRes, legacyRes] = await Promise.all([registerQuery, legacyQuery]);
  if (registerRes.error && legacyRes.error) throw registerRes.error;

  const registerRows = (registerRes.data ?? []).map((r) => rowFromRegister(r as never));
  const registerKeys = new Set(registerRows.map((r) => `${r.studentId}-${r.date}`));

  const legacyRows = (legacyRes.data ?? [])
    .filter((r) => !registerKeys.has(`${r.student_id}-${r.date}`))
    .map((r) => rowFromLegacy(r as never));

  return [...registerRows, ...legacyRows]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit);
}

export async function fetchStudentDailyAttendance(
  studentId: string,
  limit = 30,
): Promise<{ id: string; date: string; status: string; recordedAt?: string; subjectName?: string }[]> {
  const [registerRes, legacyRes] = await Promise.all([
    supabase
      .from("attendance_records")
      .select("id, attendance_date, attendance_status, subjects(name)")
      .eq("student_id", studentId)
      .order("attendance_date", { ascending: false })
      .limit(limit),
    supabase
      .from("attendance")
      .select("id, date, status, recorded_at")
      .eq("student_id", studentId)
      .order("date", { ascending: false })
      .limit(limit),
  ]);

  if (registerRes.error && legacyRes.error) throw registerRes.error;

  const byDate = new Map<string, { id: string; date: string; status: string; recordedAt?: string; subjectName?: string }>();

  for (const row of legacyRes.data ?? []) {
    byDate.set(row.date, {
      id: row.id,
      date: row.date,
      status: normalizeStatus(row.status),
      recordedAt: row.recorded_at ?? undefined,
    });
  }

  for (const row of registerRes.data ?? []) {
    const date = row.attendance_date;
    const existing = byDate.get(date);
    const status = normalizeStatus(row.attendance_status);
    const mergedStatus =
      existing?.status === "present" || status === "present"
        ? "present"
        : existing?.status === "late" || status === "late"
          ? "late"
          : status;
    byDate.set(date, {
      id: row.id,
      date,
      status: mergedStatus,
      subjectName: (row.subjects as { name?: string } | null)?.name,
    });
  }

  return [...byDate.values()]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit);
}

export async function fetchStudentAttendanceRate(
  studentId: string,
  termId?: string | null,
): Promise<{ rate: number; present: number; total: number }> {
  const summary = await fetchAttendanceSummary(studentId, termId);
  if (summary && summary.total_days > 0) {
    return {
      rate: summary.attendance_percentage,
      present: summary.present_count,
      total: summary.total_days,
    };
  }

  const daily = await fetchStudentDailyAttendance(studentId, 120);
  const total = daily.length;
  const present = daily.filter((d) => d.status === "present").length;
  return {
    rate: total ? Math.round((present / total) * 100) : 0,
    present,
    total,
  };
}

export async function fetchSchoolAttendanceStats(schoolId: string): Promise<{
  total: number;
  present: number;
  absent: number;
  late: number;
  rate: number;
}> {
  const { data: registerRows, error: registerErr } = await supabase
    .from("attendance_records")
    .select("attendance_status")
    .eq("school_id", schoolId);

  if (!registerErr && registerRows && registerRows.length > 0) {
    const total = registerRows.length;
    const present = registerRows.filter((r) => normalizeStatus(r.attendance_status) === "present").length;
    const absent = registerRows.filter((r) => normalizeStatus(r.attendance_status) === "absent").length;
    const late = registerRows.filter((r) => normalizeStatus(r.attendance_status) === "late").length;
    return {
      total,
      present,
      absent,
      late,
      rate: total ? Math.round((present / total) * 1000) / 10 : 0,
    };
  }

  const { data: legacyRows, error: legacyErr } = await supabase
    .from("attendance")
    .select("status, students!inner(school_id)")
    .eq("students.school_id", schoolId);

  if (legacyErr) throw legacyErr;

  const total = legacyRows?.length ?? 0;
  const present = legacyRows?.filter((r) => normalizeStatus(r.status) === "present").length ?? 0;
  const absent = legacyRows?.filter((r) => normalizeStatus(r.status) === "absent").length ?? 0;
  const late = legacyRows?.filter((r) => normalizeStatus(r.status) === "late").length ?? 0;

  return {
    total,
    present,
    absent,
    late,
    rate: total ? Math.round((present / total) * 1000) / 10 : 0,
  };
}

export async function fetchSchoolAttendanceTrend(
  schoolId: string,
  days = 7,
): Promise<{ date: string; present: number; absent: number }[]> {
  const dates = Array.from({ length: days }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    return d.toISOString().split("T")[0];
  });

  return Promise.all(
    dates.map(async (date) => {
      const { data: registerRows } = await supabase
        .from("attendance_records")
        .select("attendance_status")
        .eq("school_id", schoolId)
        .eq("attendance_date", date);

      const rows =
        registerRows && registerRows.length > 0
          ? registerRows
          : (
              await supabase
                .from("attendance")
                .select("status, students!inner(school_id)")
                .eq("students.school_id", schoolId)
                .eq("date", date)
            ).data ?? [];

      const present = rows.filter((r) =>
        normalizeStatus("attendance_status" in r ? r.attendance_status : r.status) === "present",
      ).length;
      const absent = rows.filter((r) =>
        normalizeStatus("attendance_status" in r ? r.attendance_status : r.status) === "absent",
      ).length;

      return {
        date: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        present,
        absent,
      };
    }),
  );
}
