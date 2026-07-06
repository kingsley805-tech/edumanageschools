import { supabase } from "@/integrations/supabase/client";

export async function assignTeacherClassSubjects(
  teacherId: string,
  classId: string,
  subjectIds: string[],
): Promise<{ assigned: number; skipped: number }> {
  let assigned = 0;
  let skipped = 0;

  for (const subjectId of subjectIds) {
    const { data: existing } = await supabase
      .from("class_subjects")
      .select("id")
      .eq("teacher_id", teacherId)
      .eq("class_id", classId)
      .eq("subject_id", subjectId)
      .maybeSingle();

    if (existing) {
      skipped += 1;
      continue;
    }

    const { error } = await supabase.from("class_subjects").insert({
      teacher_id: teacherId,
      class_id: classId,
      subject_id: subjectId,
    });

    if (!error) assigned += 1;
  }

  return { assigned, skipped };
}
