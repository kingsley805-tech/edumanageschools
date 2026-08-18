import { supabase } from "@/integrations/supabase/client";
import type {
  Achievement,
  AchievementCategory,
  AchievementNote,
  AchievementsDashboardStats,
  AchievementStatus,
  AchievementType,
  StudentOption,
} from "@/modules/achievements/lib/types";

const EMPTY_STATS: AchievementsDashboardStats = {
  total: 0,
  published: 0,
  pending: 0,
  approved: 0,
  awards: 0,
  certificates: 0,
  competitions: 0,
  archived: 0,
};

export async function fetchAchievementsDashboardStats(
  schoolId: string,
): Promise<AchievementsDashboardStats> {
  const { data, error } = await supabase.rpc("get_achievements_dashboard_stats", {
    p_school_id: schoolId,
  });
  if (error) throw error;
  return { ...EMPTY_STATS, ...(data as AchievementsDashboardStats) };
}

export async function fetchAchievementCategories(
  schoolId: string,
): Promise<AchievementCategory[]> {
  const { data, error } = await supabase
    .from("achievement_categories")
    .select("*")
    .eq("school_id", schoolId)
    .eq("is_archived", false)
    .order("name");
  if (error) throw error;
  return (data ?? []) as AchievementCategory[];
}

export async function saveAchievementCategory(
  schoolId: string,
  payload: { name: string; description?: string | null; color?: string | null },
  id?: string,
) {
  const row = {
    school_id: schoolId,
    name: payload.name.trim(),
    description: payload.description ?? null,
    color: payload.color ?? null,
    updated_at: new Date().toISOString(),
  };
  if (id) {
    const { error } = await supabase.from("achievement_categories").update(row).eq("id", id);
    if (error) throw error;
    return id;
  }
  const { data, error } = await supabase
    .from("achievement_categories")
    .insert(row)
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function archiveAchievementCategory(id: string) {
  const { error } = await supabase
    .from("achievement_categories")
    .update({ is_archived: true, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function fetchAchievements(schoolId: string): Promise<Achievement[]> {
  const { data, error } = await supabase
    .from("achievements")
    .select(
      "*, students(full_name, admission_number, classes(name)), achievement_categories(name)",
    )
    .eq("school_id", schoolId)
    .order("awarded_on", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((row) => {
    const student = row.students as {
      full_name?: string;
      admission_number?: string;
      classes?: { name?: string } | null;
    } | null;
    const category = row.achievement_categories as { name?: string } | null;
    return {
      ...(row as Omit<Achievement, "student_name" | "admission_number" | "class_name" | "category_name">),
      achievement_type: (row.achievement_type ?? "award") as AchievementType,
      status: (row.status ?? "pending") as AchievementStatus,
      student_name: student?.full_name ?? "Student",
      admission_number: student?.admission_number ?? "",
      class_name: student?.classes?.name ?? "",
      category_name: category?.name ?? null,
    };
  });
}

export type AchievementPayload = {
  student_id: string;
  category_id?: string | null;
  title: string;
  achievement_type: AchievementType;
  description?: string | null;
  awarded_by?: string | null;
  awarded_on: string;
  academic_year?: string | null;
  term_label?: string | null;
  level?: string | null;
  venue?: string | null;
  image_url?: string | null;
  document_url?: string | null;
  recommendation_letter?: string | null;
  notes?: string | null;
  status?: AchievementStatus;
  is_published?: boolean;
};

export async function saveAchievement(
  schoolId: string,
  payload: AchievementPayload,
  id?: string,
  userId?: string | null,
) {
  const row = {
    school_id: schoolId,
    student_id: payload.student_id,
    category_id: payload.category_id || null,
    title: payload.title.trim(),
    achievement_type: payload.achievement_type,
    description: payload.description ?? null,
    awarded_by: payload.awarded_by ?? null,
    awarded_on: payload.awarded_on,
    academic_year: payload.academic_year ?? null,
    term_label: payload.term_label ?? null,
    level: payload.level ?? null,
    venue: payload.venue ?? null,
    image_url: payload.image_url ?? null,
    document_url: payload.document_url ?? null,
    recommendation_letter: payload.recommendation_letter ?? null,
    notes: payload.notes ?? null,
    status: payload.status ?? "pending",
    is_published: payload.is_published ?? Boolean(payload.student_id),
    updated_at: new Date().toISOString(),
    updated_by: userId ?? null,
  };

  if (id) {
    const { error } = await supabase.from("achievements").update(row).eq("id", id);
    if (error) throw error;
    return id;
  }

  const { data, error } = await supabase
    .from("achievements")
    .insert({ ...row, created_by: userId ?? null })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function setAchievementStatus(
  id: string,
  status: AchievementStatus,
  userId?: string | null,
  rejectionReason?: string | null,
) {
  const row: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
    updated_by: userId ?? null,
  };
  if (status === "approved" || status === "active") {
    row.approved_by = userId ?? null;
    row.approved_at = new Date().toISOString();
    row.rejection_reason = null;
    row.is_published = true;
  }
  if (status === "rejected") {
    row.rejection_reason = rejectionReason ?? null;
    row.is_published = false;
  }
  if (status === "archived") {
    row.is_archived = true;
    row.is_published = false;
  }
  const { error } = await supabase.from("achievements").update(row).eq("id", id);
  if (error) throw error;
}

export async function setAchievementPublished(id: string, published: boolean, userId?: string | null) {
  const { error } = await supabase
    .from("achievements")
    .update({
      is_published: published,
      updated_at: new Date().toISOString(),
      updated_by: userId ?? null,
    })
    .eq("id", id);
  if (error) throw error;
}

export async function archiveAchievement(id: string, archived: boolean, userId?: string | null) {
  const { error } = await supabase
    .from("achievements")
    .update({
      is_archived: archived,
      status: archived ? "archived" : "inactive",
      deleted_by: archived ? userId ?? null : null,
      updated_at: new Date().toISOString(),
      updated_by: userId ?? null,
    })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteAchievement(id: string) {
  const { error } = await supabase.from("achievements").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchAchievementNotes(achievementId: string): Promise<AchievementNote[]> {
  const { data, error } = await supabase
    .from("achievement_notes")
    .select("*, profiles(full_name)")
    .eq("achievement_id", achievementId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((n) => ({
    id: n.id,
    achievement_id: n.achievement_id,
    note: n.note,
    created_by: n.created_by,
    created_at: n.created_at,
    author_name: (n.profiles as { full_name?: string } | null)?.full_name ?? "Staff",
  }));
}

export async function addAchievementNote(
  schoolId: string,
  achievementId: string,
  note: string,
  userId?: string | null,
) {
  const { error } = await supabase.from("achievement_notes").insert({
    school_id: schoolId,
    achievement_id: achievementId,
    note: note.trim(),
    created_by: userId ?? null,
  });
  if (error) throw error;
}

export async function fetchStudentOptions(schoolId: string): Promise<StudentOption[]> {
  const { data, error } = await supabase
    .from("students")
    .select("id, full_name, admission_number, classes(name)")
    .eq("school_id", schoolId)
    .order("full_name");
  if (error) throw error;
  return (data ?? []).map((s) => ({
    id: s.id,
    name: s.full_name ?? "Student",
    admission: s.admission_number ?? "",
    class_name: (s.classes as { name?: string } | null)?.name ?? "",
  }));
}

/** Published certificates/awards for student & parent portals. */
export async function fetchPublishedAchievementsForStudents(
  studentIds: string[],
): Promise<Achievement[]> {
  if (!studentIds.length) return [];
  const { data, error } = await supabase
    .from("achievements")
    .select(
      "*, students(full_name, admission_number, classes(name)), achievement_categories(name)",
    )
    .in("student_id", studentIds)
    .eq("is_published", true)
    .eq("is_archived", false)
    .neq("status", "rejected")
    .order("awarded_on", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((row) => {
    const student = row.students as {
      full_name?: string;
      admission_number?: string;
      classes?: { name?: string } | null;
    } | null;
    const category = row.achievement_categories as { name?: string } | null;
    return {
      ...(row as Omit<Achievement, "student_name" | "admission_number" | "class_name" | "category_name">),
      achievement_type: (row.achievement_type ?? "award") as AchievementType,
      status: (row.status ?? "pending") as AchievementStatus,
      student_name: student?.full_name ?? "Student",
      admission_number: student?.admission_number ?? "",
      class_name: student?.classes?.name ?? "",
      category_name: category?.name ?? null,
    };
  });
}
