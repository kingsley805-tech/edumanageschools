// @ts-nocheck
import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_PERIODS,
  type ClassSubjectOption,
  type ScheduleEntry,
  type TimetablePeriod,
  type TimetableSettings,
} from "@/timetable/lib/types";
import { dedupeSubjectOptions, readSubjectName } from "@/timetable/lib/subjectLabel";
import { toTimeInputValue } from "@/timetable/lib/timeUtils";

const SCHEDULE_SELECT_FULL = `
  id, class_id, subject_id, teacher_id, day_of_week, start_time, end_time, room,
  school_id, term_id, academic_year_id, period_id, status,
  classes ( name ), subjects ( name, code ),
  teachers ( id, profiles ( full_name ) )
`;

const SCHEDULE_SELECT_BASE = `
  id, class_id, subject_id, teacher_id, day_of_week, start_time, end_time, room,
  classes ( name ), subjects ( name, code ),
  teachers ( id, profiles ( full_name ) )
`;

function profileName(profiles: { full_name?: string } | { full_name?: string }[] | null | undefined): string {
  if (!profiles) return "Teacher";
  if (Array.isArray(profiles)) return profiles[0]?.full_name ?? "Teacher";
  return profiles.full_name ?? "Teacher";
}

function isMissingColumnError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const msg = (error.message ?? "").toLowerCase();
  return error.code === "42703" || error.code === "PGRST204" || msg.includes("column") || msg.includes("schema cache");
}

function isUuid(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function toError(error: { message?: string } | null | undefined, fallback: string): Error {
  return new Error(error?.message?.trim() || fallback);
}

function isSchemaError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const msg = (error.message ?? "").toLowerCase();
  return (
    isMissingColumnError(error) ||
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    msg.includes("does not exist") ||
    msg.includes("could not find the table")
  );
}

export async function fetchSchoolId(userId: string): Promise<string | null> {
  const { data: profile } = await supabase.from("profiles").select("school_id").eq("id", userId).maybeSingle();
  if (profile?.school_id) return profile.school_id;

  const { data: session } = await supabase.auth.getSession();
  const metaSchool = session.session?.user?.user_metadata?.school_id as string | undefined;
  if (metaSchool) return metaSchool;

  return null;
}

export async function fetchTimetableSettings(schoolId: string): Promise<TimetableSettings | null> {
  const { data, error } = await supabase.from("timetable_settings").select("*").eq("school_id", schoolId).maybeSingle();
  if (error) {
    if (error.code === "PGRST116" || isSchemaError(error)) return null;
    throw error;
  }
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
  if (error) {
    if (isSchemaError(error)) return [];
    throw error;
  }
  return (data ?? []) as TimetablePeriod[];
}

export function isPersistedPeriodId(periodId: string): boolean {
  return isUuid(periodId);
}

function normalizeDbTime(time: string): string {
  return time.length === 5 ? `${time}:00` : time;
}

export async function updateTimetablePeriod(
  periodId: string,
  patch: Partial<Pick<TimetablePeriod, "name" | "start_time" | "end_time" | "sort_order">>,
): Promise<TimetablePeriod | null> {
  if (!isPersistedPeriodId(periodId)) return null;
  const row: Record<string, string | number> = {};
  if (patch.name != null) row.name = patch.name;
  if (patch.start_time != null) row.start_time = normalizeDbTime(patch.start_time);
  if (patch.end_time != null) row.end_time = normalizeDbTime(patch.end_time);
  if (patch.sort_order != null) row.sort_order = patch.sort_order;
  if (Object.keys(row).length === 0) return null;

  const { data, error } = await supabase
    .from("timetable_periods")
    .update(row)
    .eq("id", periodId)
    .select()
    .single();
  if (error) {
    if (isSchemaError(error)) return null;
    throw error;
  }
  return data as TimetablePeriod;
}

export async function seedDefaultPeriods(schoolId: string): Promise<TimetablePeriod[]> {
  const rows = DEFAULT_PERIODS.map((p) => ({ ...p, school_id: schoolId }));
  const { data, error } = await supabase.from("timetable_periods").insert(rows).select();
  if (error) {
    if (isSchemaError(error)) return DEFAULT_PERIODS.map((p, i) => ({ ...p, id: `local-${i}`, school_id: schoolId })) as TimetablePeriod[];
    throw error;
  }
  return (data ?? []) as TimetablePeriod[];
}

/** In-memory periods when DB table is not migrated yet */
export function localDefaultPeriods(schoolId: string): TimetablePeriod[] {
  return DEFAULT_PERIODS.map((p, i) => ({
    ...p,
    id: `default-period-${i}`,
    school_id: schoolId,
  })) as TimetablePeriod[];
}

export async function fetchClassSubjectOptions(classId: string, schoolId: string): Promise<ClassSubjectOption[]> {
  const { data, error } = await supabase
    .from("class_subjects")
    .select("subject_id, teacher_id, subjects(id, name), teachers(id, profiles(full_name))")
    .eq("class_id", classId);

  if (error) throw error;

  const mapped = dedupeSubjectOptions(
    (data ?? [])
      .filter((row) => row.subject_id)
      .map((row) => ({
        subjectId: row.subject_id as string,
        subjectName: readSubjectName(row.subjects),
        teacherId: row.teacher_id,
        teacherName:
          row.teacher_id && row.teachers
            ? profileName((row.teachers as { profiles?: { full_name?: string } | { full_name?: string }[] }).profiles)
            : null,
      })),
  );

  if (mapped.length > 0) return mapped;

  const allSubjects = await fetchSubjects(schoolId);
  return dedupeSubjectOptions(
    allSubjects.map((s) => ({
      subjectId: s.id,
      subjectName: readSubjectName(s),
      teacherId: null,
      teacherName: null,
    })),
  );
}

export async function fetchSchedules(filters: {
  schoolId?: string;
  classId?: string;
  teacherId?: string;
  termId?: string;
  status?: string;
  publishedOnly?: boolean;
}): Promise<ScheduleEntry[]> {
  const applyFilters = (
    q: ReturnType<typeof supabase.from>,
    useExtendedColumns: boolean,
  ) => {
    let query = q.order("day_of_week").order("start_time");
    if (filters.classId) query = query.eq("class_id", filters.classId);
    if (filters.teacherId) query = query.eq("teacher_id", filters.teacherId);
    if (useExtendedColumns) {
      if (filters.termId && filters.termId !== "all") query = query.eq("term_id", filters.termId);
      if (filters.status && filters.status !== "all") query = query.eq("status", filters.status);
      if (filters.publishedOnly) query = query.eq("status", "published");
    }
    return query;
  };

  const schoolClassFilter = async () => {
    if (!filters.schoolId || filters.classId || filters.teacherId) return null;
    const { data: cls } = await supabase.from("classes").select("id").eq("school_id", filters.schoolId);
    const ids = (cls ?? []).map((c) => c.id);
    return ids.length ? ids : [];
  };

  let q = applyFilters(supabase.from("schedules").select(SCHEDULE_SELECT_FULL), true);
  if (filters.schoolId && !filters.classId && !filters.teacherId) {
    const ids = await schoolClassFilter();
    if (ids && ids.length === 0) return [];
    if (ids) q = q.in("class_id", ids);
  }

  let { data, error } = await q;
  if (isMissingColumnError(error)) {
    let qBase = applyFilters(supabase.from("schedules").select(SCHEDULE_SELECT_BASE), false);
    if (filters.schoolId && !filters.classId && !filters.teacherId) {
      const ids = await schoolClassFilter();
      if (ids && ids.length === 0) return [];
      if (ids) qBase = qBase.in("class_id", ids);
    }
    const res = await qBase;
    data = res.data;
    error = res.error;
  }

  if (error) throw error;
  return ((data ?? []) as ScheduleEntry[]).map((row) => ({
    ...row,
    status: row.status ?? "draft",
  }));
}

async function findExistingScheduleEntryId(input: {
  classId: string;
  dayOfWeek: number;
  periodId?: string | null;
  startTime: string;
}): Promise<string | null> {
  if (isUuid(input.periodId)) {
    const { data, error } = await supabase
      .from("schedules")
      .select("id")
      .eq("class_id", input.classId)
      .eq("day_of_week", input.dayOfWeek)
      .eq("period_id", input.periodId!)
      .maybeSingle();
    if (!error && data?.id) return data.id as string;
  }

  const startNorm = normalizeDbTime(input.startTime);
  const { data: rows, error } = await supabase
    .from("schedules")
    .select("id, start_time")
    .eq("class_id", input.classId)
    .eq("day_of_week", input.dayOfWeek);

  if (error || !rows?.length) return null;

  const match = rows.find((r) => toTimeInputValue(String(r.start_time)) === toTimeInputValue(startNorm));
  return (match?.id as string) ?? null;
}

async function updateScheduleRow(
  id: string,
  rowFull: Record<string, unknown>,
  rowBase: Record<string, unknown>,
): Promise<string | null> {
  let { data, error } = await supabase.from("schedules").update(rowFull).eq("id", id).select("id").maybeSingle();
  if (isMissingColumnError(error)) {
    ({ data, error } = await supabase.from("schedules").update(rowBase).eq("id", id).select("id").maybeSingle());
  }
  if (error) throw error;
  return (data?.id as string) ?? null;
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
  const rowFull = {
    class_id: input.classId,
    subject_id: input.subjectId,
    teacher_id: input.teacherId,
    day_of_week: input.dayOfWeek,
    start_time: normalizeDbTime(input.startTime),
    end_time: normalizeDbTime(input.endTime),
    room: input.room ?? null,
    school_id: input.schoolId,
    term_id: input.termId ?? null,
    academic_year_id: input.academicYearId ?? null,
    period_id: isUuid(input.periodId) ? input.periodId : null,
    status: input.status ?? "draft",
    updated_at: new Date().toISOString(),
  };

  const rowBase = {
    class_id: input.classId,
    subject_id: input.subjectId,
    teacher_id: input.teacherId,
    day_of_week: input.dayOfWeek,
    start_time: rowFull.start_time,
    end_time: rowFull.end_time,
    room: rowFull.room,
  };

  let targetId = input.id && isUuid(input.id) ? input.id : null;

  if (!targetId) {
    targetId = await findExistingScheduleEntryId({
      classId: input.classId,
      dayOfWeek: input.dayOfWeek,
      periodId: input.periodId,
      startTime: input.startTime,
    });
  }

  if (targetId) {
    const updated = await updateScheduleRow(targetId, rowFull, rowBase);
    if (updated) {
      if (isUuid(input.periodId)) {
        await supabase
          .from("schedules")
          .delete()
          .eq("class_id", input.classId)
          .eq("day_of_week", input.dayOfWeek)
          .eq("period_id", input.periodId!)
          .neq("id", targetId);
      }
      return updated;
    }
    targetId = await findExistingScheduleEntryId({
      classId: input.classId,
      dayOfWeek: input.dayOfWeek,
      periodId: input.periodId,
      startTime: input.startTime,
    });
    if (targetId) {
      const retry = await updateScheduleRow(targetId, rowFull, rowBase);
      if (retry) return retry;
    }
  }

  let { data, error } = await supabase.from("schedules").insert(rowFull).select("id").single();
  if (isMissingColumnError(error)) {
    ({ data, error } = await supabase.from("schedules").insert(rowBase).select("id").single());
  }
  if (error) throw error;
  return data.id as string;
}

export async function deleteScheduleEntry(id: string) {
  const { error } = await supabase.from("schedules").delete().eq("id", id);
  if (error) throw error;
}

export async function publishClassTimetable(classId: string, schoolId: string) {
  const { count, error: countError } = await supabase
    .from("schedules")
    .select("id", { count: "exact", head: true })
    .eq("class_id", classId);

  if (countError) throw toError(countError, "Could not load timetable entries");
  if (!count) {
    throw new Error("Add at least one period to the timetable before publishing.");
  }

  const { data: rpcCount, error: rpcError } = await supabase.rpc("publish_class_timetable", {
    p_class_id: classId,
    p_school_id: schoolId,
  });

  if (!rpcError) {
    if (typeof rpcCount === "number" && rpcCount > 0) return;
    if (rpcCount == null) return;
  }

  const rpcMissing =
    rpcError &&
    (isSchemaError(rpcError) ||
      rpcError.code === "PGRST202" ||
      (rpcError.message ?? "").toLowerCase().includes("publish_class_timetable"));

  if (!rpcMissing) {
    throw toError(
      rpcError,
      "Publish failed. Run public/sql/apply-timetable-publish-fix.sql in Supabase if this persists.",
    );
  }

  await publishClassTimetableDirect(classId, schoolId);
}

async function publishClassTimetableDirect(classId: string, schoolId: string) {
  const { data: entries, error: fetchError } = await supabase.from("schedules").select("*").eq("class_id", classId);
  if (fetchError) throw toError(fetchError, "Could not load timetable entries");

  const version = (entries?.length ?? 0) > 0 ? Math.max(1, await nextVersion(classId)) : 1;
  const { data: session } = await supabase.auth.getSession();
  const uid = session.session?.user?.id;
  let name = "Admin";
  if (uid) {
    const { data: p } = await supabase.from("profiles").select("full_name").eq("id", uid).maybeSingle();
    name = p?.full_name ?? name;
  }

  const { error: versionError } = await supabase.from("timetable_versions").insert({
    school_id: schoolId,
    class_id: classId,
    version_number: version,
    snapshot: entries ?? [],
    change_summary: "Published timetable",
    created_by: uid,
    created_by_name: name,
  });
  if (versionError && !isSchemaError(versionError)) {
    throw toError(versionError, "Could not save timetable version history");
  }

  let { data: published, error: publishError } = await supabase
    .from("schedules")
    .update({ status: "published", updated_at: new Date().toISOString() })
    .eq("class_id", classId)
    .select("id");

  if (isMissingColumnError(publishError)) {
    ({ data: published, error: publishError } = await supabase
      .from("schedules")
      .update({ status: "published" })
      .eq("class_id", classId)
      .select("id"));
  }

  if (publishError) {
    if (isMissingColumnError(publishError)) {
      throw new Error(
        "Timetable publish needs a database update. Run public/sql/apply-timetable-publish-fix.sql in the Supabase SQL Editor, then try again.",
      );
    }
    throw toError(publishError, "Could not mark timetable as published");
  }

  if (!published?.length) {
    throw new Error(
      "No periods were published. Confirm you are a school admin and run public/sql/apply-timetable-publish-fix.sql if needed.",
    );
  }

  try {
    await notifyTimetablePublished(classId, schoolId);
  } catch {
    /* notifications are optional */
  }
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
  if (error) {
    if (isSchemaError(error)) return [];
    throw error;
  }
  return data ?? [];
}

export async function fetchTimetableStats(schoolId: string) {
  const classList = await fetchClasses(schoolId);
  const classIds = classList.map((c) => c.id);

  const [classesRes, teachersRes] = await Promise.all([
    supabase.from("classes").select("id", { count: "exact", head: true }).eq("school_id", schoolId),
    supabase.from("teachers").select("id", { count: "exact", head: true }).eq("school_id", schoolId),
  ]);

  let schedules: { id: string; status?: string; teacher_id: string | null; class_id: string }[] = [];
  if (classIds.length) {
    let res = await supabase.from("schedules").select("id, status, teacher_id, class_id").in("class_id", classIds);
    if (isMissingColumnError(res.error)) {
      res = await supabase.from("schedules").select("id, teacher_id, class_id").in("class_id", classIds);
    }
    if (res.error && !isSchemaError(res.error)) throw res.error;
    schedules = (res.data ?? []) as typeof schedules;
  }

  const classesWithSchedules = new Set(schedules.map((s) => s.class_id));
  const assignedTeachers = new Set(schedules.map((s) => s.teacher_id).filter(Boolean));

  return {
    totalClasses: classesRes.count ?? classList.length,
    totalTeachers: teachersRes.count ?? 0,
    teachersAssigned: assignedTeachers.size,
    activeTimetables: classesWithSchedules.size,
    drafts: schedules.filter((s) => (s.status ?? "draft") === "draft").length,
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
  const { data, error } = await supabase
    .from("classes")
    .select("id, name, school_id")
    .eq("school_id", schoolId)
    .order("name");
  if (error) throw error;
  if ((data ?? []).length > 0) return data.map((c) => ({ id: c.id, name: c.name }));

  // Legacy rows or profile mismatch: return any class visible via RLS for this admin
  const { data: visible, error: err2 } = await supabase.from("classes").select("id, name").order("name");
  if (err2) throw err2;
  return visible ?? [];
}

export async function fetchSubjects(schoolId: string) {
  const { data, error } = await supabase.from("subjects").select("id, name, code").eq("school_id", schoolId).order("name");
  if (error) throw error;
  return data ?? [];
}

export async function fetchTeachers(schoolId: string) {
  const { data, error } = await supabase
    .from("teachers")
    .select("id, user_id, profiles(full_name)")
    .eq("school_id", schoolId)
    .order("created_at");
  if (error) throw error;
  return (data ?? []).map((t) => ({
    id: t.id as string,
    profiles: { full_name: profileName(t.profiles as { full_name?: string } | { full_name?: string }[]) },
  }));
}
