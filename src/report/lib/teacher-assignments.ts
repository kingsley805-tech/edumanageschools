import { supabase } from "@/integrations/supabase/client";

export type TeacherClassOption = { id: string; name: string };

/** Resolve teachers.id from auth user / profile id (school-hub class_subjects FK). */
export async function fetchTeacherRecordId(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("teachers")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

/** Unique classes assigned to this teacher via class_subjects. */
export async function fetchTeacherAssignedClasses(userId: string): Promise<TeacherClassOption[]> {
  const teacherRecordId = await fetchTeacherRecordId(userId);
  if (!teacherRecordId) return [];

  const { data, error } = await supabase
    .from("class_subjects")
    .select("class_id, classes(id, name)")
    .eq("teacher_id", teacherRecordId);
  if (error) throw error;

  const map = new Map<string, TeacherClassOption>();
  for (const row of data ?? []) {
    const c = row.classes as { id: string; name: string } | null;
    if (c?.id) map.set(c.id, { id: c.id, name: c.name });
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** class_ids this teacher may access for reports. */
export async function fetchTeacherAssignedClassIds(userId: string): Promise<string[]> {
  const classes = await fetchTeacherAssignedClasses(userId);
  return classes.map((c) => c.id);
}
