import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_ATTENDANCE_STATUSES,
  type AttendanceStatusType,
  type ClassRegister,
  type ClassRegisterStatus,
  type RegisterDashboardStats,
  type RegisterStudentEntry,
  type RegisterWithEntries,
} from "@/register/lib/types";

const REGISTER_SELECT = `
  id, school_id, class_id, subject_id, teacher_id, term_id, academic_year_id, session_label,
  register_date, period_label, day_of_week, lesson_summary, lesson_objectives, teaching_methods,
  homework, participation_summary, teacher_signature, status, submitted_at, reviewed_at,
  reviewed_by, reviewer_name, admin_feedback, locked, created_at, updated_at,
  classes ( name ), subjects ( name ), teachers ( id, profiles ( full_name ) )
`;

function isSchemaError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const msg = (error.message ?? "").toLowerCase();
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    error.code === "42703" ||
    error.code === "PGRST204" ||
    msg.includes("does not exist") ||
    msg.includes("schema cache")
  );
}

function toError(error: { message?: string } | null, fallback: string): Error {
  return new Error(error?.message?.trim() || fallback);
}

export async function fetchSchoolId(userId: string): Promise<string | null> {
  const { data } = await supabase.from("profiles").select("school_id").eq("id", userId).maybeSingle();
  return data?.school_id ?? null;
}

export async function fetchTeacherId(userId: string): Promise<string | null> {
  const { data } = await supabase.from("teachers").select("id").eq("user_id", userId).maybeSingle();
  return data?.id ?? null;
}

export async function seedAttendanceStatusTypes(schoolId: string): Promise<AttendanceStatusType[]> {
  const rows = DEFAULT_ATTENDANCE_STATUSES.map((s) => ({ ...s, school_id: schoolId }));
  const { data, error } = await supabase.from("attendance_status_types").insert(rows).select();
  if (error) {
    if (isSchemaError(error)) return DEFAULT_ATTENDANCE_STATUSES.map((s, i) => ({ ...s, id: `local-${i}`, school_id: schoolId }));
    throw error;
  }
  return (data ?? []) as AttendanceStatusType[];
}

export async function fetchAttendanceStatusTypes(schoolId: string): Promise<AttendanceStatusType[]> {
  const { data, error } = await supabase
    .from("attendance_status_types")
    .select("*")
    .eq("school_id", schoolId)
    .eq("is_active", true)
    .order("sort_order");
  if (error) {
    if (isSchemaError(error)) return DEFAULT_ATTENDANCE_STATUSES.map((s, i) => ({ ...s, id: `local-${i}`, school_id: schoolId }));
    throw error;
  }
  if (!data?.length) return seedAttendanceStatusTypes(schoolId);
  return data as AttendanceStatusType[];
}

export async function fetchTerms(schoolId: string) {
  const { data, error } = await supabase
    .from("terms")
    .select("id, name, session, is_current, academic_year_id")
    .eq("school_id", schoolId)
    .order("name");
  if (error) {
    if (isSchemaError(error)) return [];
    throw error;
  }
  return data ?? [];
}

export async function fetchClasses(schoolId: string) {
  const { data, error } = await supabase.from("classes").select("id, name").eq("school_id", schoolId).order("name");
  if (error) throw error;
  return data ?? [];
}

export async function fetchSubjects(schoolId: string) {
  const { data, error } = await supabase.from("subjects").select("id, name").eq("school_id", schoolId).order("name");
  if (error) throw error;
  return data ?? [];
}

export async function fetchTeacherAssignments(teacherId: string) {
  const { data, error } = await supabase
    .from("class_subjects")
    .select("class_id, subject_id, classes(id, name), subjects(id, name)")
    .eq("teacher_id", teacherId);
  if (error) throw error;
  return data ?? [];
}

export async function listRegisters(filters: {
  schoolId: string;
  classId?: string;
  subjectId?: string;
  teacherId?: string;
  status?: ClassRegisterStatus | "all";
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  limit?: number;
}): Promise<ClassRegister[]> {
  let q = supabase.from("class_registers").select(REGISTER_SELECT).eq("school_id", filters.schoolId);

  if (filters.classId) q = q.eq("class_id", filters.classId);
  if (filters.subjectId) q = q.eq("subject_id", filters.subjectId);
  if (filters.teacherId) q = q.eq("teacher_id", filters.teacherId);
  if (filters.status && filters.status !== "all") q = q.eq("status", filters.status);
  if (filters.dateFrom) q = q.gte("register_date", filters.dateFrom);
  if (filters.dateTo) q = q.lte("register_date", filters.dateTo);

  q = q.order("register_date", { ascending: false }).order("updated_at", { ascending: false });
  if (filters.limit) q = q.limit(filters.limit);

  const { data, error } = await q;
  if (error) {
    if (isSchemaError(error)) return [];
    throw error;
  }

  let rows = (data ?? []) as ClassRegister[];
  if (filters.search?.trim()) {
    const s = filters.search.toLowerCase();
    rows = rows.filter(
      (r) =>
        r.classes?.name?.toLowerCase().includes(s) ||
        r.subjects?.name?.toLowerCase().includes(s) ||
        r.teachers?.profiles?.full_name?.toLowerCase().includes(s),
    );
  }
  return rows;
}

export async function getRegister(registerId: string): Promise<RegisterWithEntries | null> {
  const { data: reg, error } = await supabase.from("class_registers").select(REGISTER_SELECT).eq("id", registerId).maybeSingle();
  if (error) {
    if (isSchemaError(error)) return null;
    throw error;
  }
  if (!reg) return null;

  const { data: entries, error: entErr } = await supabase
    .from("register_student_entries")
    .select("*, students(id, admission_no, profiles(full_name))")
    .eq("register_id", registerId)
    .order("created_at");
  if (entErr) throw entErr;

  return { ...(reg as ClassRegister), entries: (entries ?? []) as RegisterStudentEntry[] };
}

export async function fetchClassStudents(classId: string) {
  const { data, error } = await supabase
    .from("students")
    .select("id, admission_no, profiles(full_name)")
    .eq("class_id", classId)
    .order("admission_no");
  if (error) throw error;
  return data ?? [];
}

export async function createRegister(input: {
  schoolId: string;
  classId: string;
  subjectId: string;
  teacherId: string;
  termId?: string | null;
  academicYearId?: string | null;
  sessionLabel?: string;
  registerDate: string;
  periodLabel: string;
  createdBy?: string;
}): Promise<string> {
  const day = new Date(input.registerDate).getDay();
  const { data, error } = await supabase
    .from("class_registers")
    .insert({
      school_id: input.schoolId,
      class_id: input.classId,
      subject_id: input.subjectId,
      teacher_id: input.teacherId,
      term_id: input.termId ?? null,
      academic_year_id: input.academicYearId ?? null,
      session_label: input.sessionLabel ?? null,
      register_date: input.registerDate,
      period_label: input.periodLabel,
      day_of_week: day,
      status: "draft",
      created_by: input.createdBy ?? null,
    })
    .select("id")
    .single();
  if (error) throw toError(error, "Could not create register");
  return data.id as string;
}

export async function saveRegisterHeader(
  registerId: string,
  patch: Partial<{
    lesson_summary: string;
    lesson_objectives: string;
    teaching_methods: string;
    homework: string;
    participation_summary: string;
    teacher_signature: string;
  }>,
) {
  const { error } = await supabase
    .from("class_registers")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", registerId);
  if (error) throw toError(error, "Could not save register");
}

export async function saveRegisterEntries(
  registerId: string,
  entries: {
    student_id: string;
    attendance_status: string;
    time_in?: string | null;
    participation?: string | null;
    remarks?: string | null;
    behavior_remark?: string | null;
  }[],
) {
  for (const row of entries) {
    const { error } = await supabase.from("register_student_entries").upsert(
      {
        register_id: registerId,
        student_id: row.student_id,
        attendance_status: row.attendance_status,
        time_in: row.time_in || null,
        participation: row.participation || null,
        remarks: row.remarks || null,
        behavior_remark: row.behavior_remark || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "register_id,student_id" },
    );
    if (error) throw toError(error, "Could not save attendance");
  }
}

export async function submitRegister(registerId: string, schoolId: string) {
  const { error } = await supabase
    .from("class_registers")
    .update({
      status: "submitted",
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", registerId);
  if (error) throw toError(error, "Could not submit register");

  await logRegisterStatus(registerId, schoolId, "draft", "submitted");
}

export async function reviewRegister(registerId: string, action: "approve" | "reject", comment?: string) {
  const { error } = await supabase.rpc("review_class_register", {
    p_register_id: registerId,
    p_action: action,
    p_comment: comment ?? null,
  });
  if (error) {
    const { data: session } = await supabase.auth.getSession();
    const uid = session.session?.user?.id;
    let name = "Admin";
    if (uid) {
      const { data: p } = await supabase.from("profiles").select("full_name").eq("id", uid).maybeSingle();
      name = p?.full_name ?? name;
    }
    const status = action === "approve" ? "approved" : "rejected";
    const { error: updErr } = await supabase
      .from("class_registers")
      .update({
        status,
        reviewed_at: new Date().toISOString(),
        reviewed_by: uid,
        reviewer_name: name,
        admin_feedback: comment ?? null,
        locked: action === "approve",
        updated_at: new Date().toISOString(),
      })
      .eq("id", registerId);
    if (updErr) throw toError(updErr, `Could not ${action} register`);
  }
}

async function logRegisterStatus(
  registerId: string,
  schoolId: string,
  from: ClassRegisterStatus,
  to: ClassRegisterStatus,
) {
  const { data: session } = await supabase.auth.getSession();
  const uid = session.session?.user?.id;
  let name = "User";
  if (uid) {
    const { data: p } = await supabase.from("profiles").select("full_name").eq("id", uid).maybeSingle();
    name = p?.full_name ?? name;
  }
  await supabase.from("register_status_logs").insert({
    register_id: registerId,
    school_id: schoolId,
    from_status: from,
    to_status: to,
    actor_user_id: uid,
    actor_name: name,
  });
}

export async function fetchRegisterDashboardStats(schoolId: string, date?: string): Promise<RegisterDashboardStats> {
  const today = date ?? new Date().toISOString().slice(0, 10);
  const classes = await fetchClasses(schoolId);
  const totalClasses = classes.length;

  const todayRegisters = await listRegisters({ schoolId, dateFrom: today, dateTo: today });
  const submitted = todayRegisters.filter((r) => r.status !== "draft").length;
  const pending = todayRegisters.filter((r) => r.status === "submitted").length;

  const registerIds = todayRegisters.map((r) => r.id);
  let presentToday = 0;
  let absentToday = 0;
  let lateToday = 0;

  if (registerIds.length) {
    const { data: lines } = await supabase
      .from("register_student_entries")
      .select("attendance_status")
      .in("register_id", registerIds);
    for (const line of lines ?? []) {
      const s = (line.attendance_status as string)?.toLowerCase();
      if (s === "present") presentToday++;
      else if (s === "absent") absentToday++;
      else if (s === "late") lateToday++;
    }
  }

  const totalMarked = presentToday + absentToday + lateToday;
  const attendanceTodayPercent = totalMarked ? Math.round((presentToday / totalMarked) * 100) : 0;

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yStr = yesterday.toISOString().slice(0, 10);
  const yRegisters = await listRegisters({ schoolId, dateFrom: yStr, dateTo: yStr });
  let yPresent = 0;
  let yTotal = 0;
  const yIds = yRegisters.map((r) => r.id);
  if (yIds.length) {
    const { data: yLines } = await supabase
      .from("register_student_entries")
      .select("attendance_status")
      .in("register_id", yIds);
    for (const line of yLines ?? []) {
      yTotal++;
      if ((line.attendance_status as string)?.toLowerCase() === "present") yPresent++;
    }
  }
  const yPercent = yTotal ? Math.round((yPresent / yTotal) * 100) : attendanceTodayPercent;
  const attendanceTrend = attendanceTodayPercent - yPercent;

  const expectedPerClass = 4;
  const registersExpected = Math.max(totalClasses * expectedPerClass, todayRegisters.length, 1);

  return {
    totalClasses,
    registersSubmitted: submitted,
    registersExpected,
    pendingApproval: pending,
    attendanceTodayPercent,
    attendanceTrend,
    absentToday,
    presentToday,
    lateToday,
  };
}

export async function syncLegacyAttendance(register: RegisterWithEntries) {
  const date = register.register_date;
  const classId = register.class_id;
  await supabase.from("attendance").delete().eq("class_id", classId).eq("date", date);
  const rows = register.entries.map((e) => ({
    student_id: e.student_id,
    class_id: classId,
    date,
    status: mapStatusToLegacy(e.attendance_status),
    recorded_at: new Date().toISOString(),
  }));
  if (rows.length) await supabase.from("attendance").insert(rows);
}

function mapStatusToLegacy(status: string): string {
  const s = status.toLowerCase();
  if (["present", "excused", "sick", "suspended"].includes(s)) return s === "present" ? "present" : "absent";
  if (s === "late") return "late";
  return "absent";
}
