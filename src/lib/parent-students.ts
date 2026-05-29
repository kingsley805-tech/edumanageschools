// @ts-nocheck
import { supabase } from "@/integrations/supabase/client";

export type ParentRecord = {
  id: string;
  school_id: string;
};

/** Load the parent row for the signed-in user. */
export async function fetchParentRecordByUserId(userId: string): Promise<ParentRecord | null> {
  const { data, error } = await supabase
    .from("parents")
    .select("id, school_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data;
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