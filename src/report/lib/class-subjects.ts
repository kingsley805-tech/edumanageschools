import { supabase } from "@/integrations/supabase/client";
import { emptySubjectRow, type SubjectRow } from "@/report/lib/shepherd-grading";

/** Admin-assigned subjects for a class (from class_subjects → subjects). */
export async function fetchClassSubjectTemplates(classId: string): Promise<SubjectRow[]> {
  const { data, error } = await supabase
    .from("class_subjects")
    .select("subject_id, subjects(name)")
    .eq("class_id", classId);
  if (error) throw error;

  const seen = new Set<string>();
  const names: string[] = [];
  for (const row of data ?? []) {
    const name = (row.subjects as { name: string } | null)?.name?.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  names.sort((a, b) => a.localeCompare(b));
  return names.map((name) => emptySubjectRow(name));
}
