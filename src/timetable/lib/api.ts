import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_PERIODS, type ScheduleEntry, type TimetablePeriod, type TimetableSettings } from "@/timetable/lib/types";

const SCHEDULE_SELECT = `
  id, class_id, subject_id, teacher_id, day_of_week, start_time, end_time, room,
  school_id, term_id, academic_year_id, period_id, status,
  classes ( name ), subjects ( name, code ),
  teachers ( id, profiles ( full_name ) )
`;

export async function fetchSchoolId(userId: string): Promise<string | null> {
  const { data } = await supabase.from("profiles").select("school_id").eq("id", userId).maybeSingle();
  return data?.school_id ?? null;
}

export async function fetchTimetableSettings(schoolId: string): Promise<TimetableSettings | null> {
  const { data, error } = await supabase.from("timetable_settings").select("*").eq("school_id", schoolId).maybeSingle();
  if (error && error.code !== "PGRST116") throw error;
  return data as TimetableSettings | null;
}

export async function upsertTimetableSettings(
  schoolId: string,
  patch: Partial<Omit<TimetableSettings, "id" | "school_id">>,
) {
  const { data, error } = await supabase
    .from("timetable_settings")
    .upsert({ school_id: schoolId, ...patch }, { onConflict: "school_id" })
    .select()
    .single();
  if (error) throw error;
  return data as TimetableSettings;
}

export async function fetchPeriods(schoolId: string): Promise<TimetablePeriod[]> {
  const { data, error } = await supabase
    .from("timetable_periods")
    .select("*")
    .eq("school_id", schoolId)
    .order("sort_order");
  if (error) throw error;
  return (data ?? []) as TimetablePeriod[];
}

export async function seedDefaultPeriods(schoolId: string): Promise<TimetablePeriod[]> {
  const rows = DEFAULT_PERIODS.map((p) => ({ ...p, school_id: schoolId }));
  const { data, error } = await supabase.from("timetable_periods").insert(rows).select();
  if (error) throw error;
  return (data ?? []) as TimetablePeriod[];
}

export async function fetchSchedules(filters: {
  schoolId?: string;
  classId?: string;
  teacherId?: string;
  termId?: string;
  status?: string;
  publishedOnly?: boolean;
}): Promise<ScheduleEntry[]> {
  let q = supabase.from("schedules").select(SCHEDULE_SELECT).order("day_of_week").order("start_time");

  if (filters.classId) q = q.eq("class_id", filters.classId);
  if (filters.teacherId) q = q.eq("teacher_id", filters.teacherId);
  if (filters.termId && filters.termId !== "all") q = q.eq("term_id", filters.termId);
  if (filters.status && filters.status !== "all") q = q.eq("status", filters.status);
  if (filters.publishedOnly) q = q.eq("status", "published");
  if (filters.schoolId && !filters.classId && !filters.teacherId) {
    const { data: cls } = await supabase.from("classes").select("id").eq("school_id", filters.schoolId);
    const ids = (cls ?? []).map((c) => c.id);
    if (ids.length) q = q.in("class_id", ids);
    else return [];
  }

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as ScheduleEntry[];
}

export async function upsertScheduleEntry(input: {
  id?: string;
  schoolId: string;
  classId: string;
  subjectId: string;
  teacherId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room?: string;
  termId?: string | null;
  academicYearId?: string | null;
  periodId?: string | null;
  status?: "draft" | "published";
}) {
  const row = {
    class_id: input.classId,
    subject_id: input.subjectId,
    teacher_id: input.teacherId,
    day_of_week: input.dayOfWeek,
    start_time: input.startTime.length === 5 ? `${input.startTime}:00` : input.startTime,
    end_time: input.endTime.length === 5 ? `${input.endTime}:00` : input.endTime,
    room: input.room ?? null,
    school_id: input.schoolId,
    term_id: input.termId ?? null,
    academic_year_id: input.academicYearId ?? null,
    period_id: input.periodId ?? null,
    status: input.status ?? "draft",
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { error } = await supabase.from("schedules").update(row).eq("id", input.id);
    if (error) throw error;
    return input.id;
  }
  const { data, error } = await supabase.from("schedules").insert(row).select("id").single();
  if (error) throw error;
  return data.id as string;
}

export async function deleteScheduleEntry(id: string) {
  const { error } = await supabase.from("schedules").delete().eq("id", id);
  if (error) throw error;
}

export async function publishClassTimetable(classId: string, schoolId: string) {
  const { data: entries } = await supabase.from("schedules").select("*").eq("class_id", classId);
  const version = (entries?.length ?? 0) > 0 ? Math.max(1, await nextVersion(classId)) : 1;
  const { data: session } = await supabase.auth.getSession();
  const uid = session.session?.user?.id;
  let name = "Admin";
  if (uid) {
    const { data: p } = await supabase.from("profiles").select("full_name").eq("id", uid).maybeSingle();
    name = p?.full_name ?? name;
  }

  await supabase.from("timetable_versions").insert({
    school_id: schoolId,
    class_id: classId,
    version_number: version,
    snapshot: entries ?? [],
    change_summary: "Published timetable",
    created_by: uid,
    created_by_name: name,
  });

  const { error } = await supabase
    .from("schedules")
    .update({ status: "published", updated_at: new Date().toISOString() })
    .eq("class_id", classId);
  if (error) throw error;

  await notifyTimetablePublished(classId, schoolId);
}

async function nextVersion(classId: string): Promise<number> {
  const { data } = await supabase
    .from("timetable_versions")
    .select("version_number")
    .eq("class_id", classId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.version_number ?? 0) + 1;
}

async function notifyTimetablePublished(classId: string, schoolId: string) {
  const { data: cls } = await supabase.from("classes").select("name").eq("id", classId).maybeSingle();
  const className = cls?.name ?? "your class";

  const { data: students } = await supabase.from("students").select("user_id").eq("class_id", classId);
  const { data: teachers } = await supabase
    .from("schedules")
    .select("teacher_id, teachers(user_id)")
    .eq("class_id", classId);

  const userIds = new Set<string>();
  for (const s of students ?? []) {
    if (s.user_id) userIds.add(s.user_id);
  }
  for (const t of teachers ?? []) {
    const uid = (t.teachers as { user_id?: string })?.user_id;
    if (uid) userIds.add(uid);
  }

  const rows = [...userIds].map((user_id) => ({
    user_id,
    title: "Timetable published",
    body: `The timetable for ${className} has been published.`,
    data: { type: "timetable_published", link: "/student/timetable", classId },
  }));
  if (rows.length) await supabase.from("notifications").insert(rows);
}

export async function fetchSubjectAllocations(schoolId: string, classId?: string) {
  let q = supabase
    .from("subject_weekly_allocations")
    .select("*, subjects(name)")
    .eq("school_id", schoolId);
  if (classId) q = q.eq("class_id", classId);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function fetchTimetableStats(schoolId: string) {
  const { data: schoolClasses } = await supabase.from("classes").select("id").eq("school_id", schoolId);
  const classIds = (schoolClasses ?? []).map((c) => c.id);

  const [classesRes, teachersRes, schedulesRes] = await Promise.all([
    supabase.from("classes").select("id", { count: "exact", head: true }).eq("school_id", schoolId),
    supabase.from("teachers").select("id", { count: "exact", head: true }).eq("school_id", schoolId),
    classIds.length
      ? supabase.from("schedules").select("id, status, teacher_id, class_id").in("class_id", classIds)
      : Promise.resolve({ data: [] as { id: string; status: string; teacher_id: string | null; class_id: string }[] }),
  ]);

  const schedules = schedulesRes.data ?? [];
  const classIds = new Set(schedules.map((s) => s.class_id));
  const assignedTeachers = new Set(schedules.map((s) => s.teacher_id).filter(Boolean));

  return {
    totalClasses: classesRes.count ?? 0,
    totalTeachers: teachersRes.count ?? 0,
    teachersAssigned: assignedTeachers.size,
    activeTimetables: classIds.size,
    drafts: schedules.filter((s) => s.status === "draft").length,
    published: schedules.filter((s) => s.status === "published").length,
  };
}

export async function fetchTerms(schoolId: string) {
  const { data, error } = await supabase
    .from("terms")
    .select("id, name, session, is_current, academic_year_id")
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchClasses(schoolId: string) {
  const { data, error } = await supabase.from("classes").select("id, name").eq("school_id", schoolId).order("name");
  if (error) throw error;
  return data ?? [];
}

export async function fetchSubjects(schoolId: string) {
  const { data, error } = await supabase.from("subjects").select("id, name, code").eq("school_id", schoolId).order("name");
  if (error) throw error;
  return data ?? [];
}

export async function fetchTeachers(schoolId: string) {
  const { data, error } = await supabase
    .from("teachers")
    .select("id, profiles(full_name)")
    .eq("school_id", schoolId);
  if (error) throw error;
  return data ?? [];
}
