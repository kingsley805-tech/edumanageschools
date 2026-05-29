// @ts-nocheck
import { supabase } from "@/integrations/supabase/client";

export type ParentRecord = {
  id: string;
  school_id: string;
  signup_child_admission_numbers?: string[] | null;
};

/** Load the parent row for the signed-in user. */
export async function fetchParentRecordByUserId(userId: string): Promise<ParentRecord | null> {
  const { data, error } = await supabase
    .from("parents")
    .select("id, school_id, signup_child_admission_numbers")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    if (error.code === "42703" || error.message?.includes("signup_child_admission_numbers")) {
      const { data: fallback, error: fallbackErr } = await supabase
        .from("parents")
        .select("id, school_id")
        .eq("user_id", userId)
        .maybeSingle();
      if (fallbackErr) throw fallbackErr;
      return fallback;
    }
    throw error;
  }
  return data;
}

/** Admission numbers from signup metadata and/or parents table. */
export function getParentSignupAdmissionNumbers(
  user: { user_metadata?: Record<string, unknown> } | null | undefined,
  parent: ParentRecord | null,
): string[] {
  const fromMeta = user?.user_metadata?.child_admission_numbers;
  const metaList = Array.isArray(fromMeta)
    ? fromMeta.map((n) => String(n).trim()).filter(Boolean)
    : [];
  const fromDb = parent?.signup_child_admission_numbers ?? [];
  return [...new Set([...metaList, ...fromDb].map((n) => n.toUpperCase()))];
}

/**
 * All students linked to a parent via parent_student_links and/or guardian_id.
 * Pass a Supabase select fragment for the students table (without wrapping parens).
 */
export async function fetchStudentsForParent<T = Record<string, unknown>>(
  parentId: string,
  select: string
): Promise<T[]> {
  const { data: links, error: linksError } = await supabase
    .from("parent_student_links")
    .select(`student:students(${select})`)
    .eq("parent_id", parentId);

  if (linksError) throw linksError;

  const fromLinks = (links ?? [])
    .map((row) => row.student as T | null)
    .filter((s): s is T => s != null && typeof s === "object" && "id" in s);

  const { data: fromGuardian, error: guardianError } = await supabase
    .from("students")
    .select(select)
    .eq("guardian_id", parentId);

  if (guardianError) throw guardianError;

  const merged = new Map<string, T>();
  for (const student of [...fromLinks, ...((fromGuardian ?? []) as T[])]) {
    const id = (student as { id?: string }).id;
    if (id) merged.set(id, student);
  }

  return Array.from(merged.values());
}

/** Student name for parent UI — prefers students.full_name, then profile. */
export function studentDisplayNameForParent(student: {
  full_name?: string | null;
  profiles?: { full_name?: string | null } | { full_name?: string | null }[] | null;
}): string {
  const profile = Array.isArray(student.profiles) ? student.profiles[0] : student.profiles;
  return student.full_name?.trim() || profile?.full_name?.trim() || "Student";
}