import { supabase } from "@/integrations/supabase/client";

/** Returns true if the teacher is assigned to the class (class_subjects or class teacher). */
export async function teacherCanAccessClass(
  teacherId: string,
  classId: string,
): Promise<boolean> {
  const [{ data: asClassTeacher }, { data: assigned }] = await Promise.all([
    supabase
      .from("classes")
      .select("id")
      .eq("id", classId)
      .eq("class_teacher_id", teacherId)
      .maybeSingle(),
    supabase
      .from("class_subjects")
      .select("id")
      .eq("class_id", classId)
      .eq("teacher_id", teacherId)
      .limit(1)
      .maybeSingle(),
  ]);
  return Boolean(asClassTeacher?.id || assigned?.id);
}

/** Resolve the caller's student row; never trust a client-supplied student id. */
export async function resolveSessionStudentId(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("students")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.id ?? null;
}

/** True if parent is linked to student via guardian_id or parent_student_links. */
export async function parentCanAccessStudent(
  parentId: string,
  studentId: string,
): Promise<boolean> {
  const [{ data: asGuardian }, { data: link }] = await Promise.all([
    supabase
      .from("students")
      .select("id")
      .eq("id", studentId)
      .eq("guardian_id", parentId)
      .maybeSingle(),
    supabase
      .from("parent_student_links")
      .select("id")
      .eq("parent_id", parentId)
      .eq("student_id", studentId)
      .maybeSingle(),
  ]);
  return Boolean(asGuardian?.id || link?.id);
}
