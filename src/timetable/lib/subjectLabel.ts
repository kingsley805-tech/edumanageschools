/** Normalize subject row from Supabase join (object or array). */
export function readSubjectName(subjects: unknown): string {
  if (!subjects) return "Subject";
  const row = Array.isArray(subjects) ? subjects[0] : subjects;
  if (!row || typeof row !== "object") return "Subject";
  const name = String((row as { name?: string }).name ?? "").trim();
  const code = String((row as { code?: string }).code ?? "").trim();
  if (!name) return "Subject";
  if (code && code.toLowerCase() !== name.toLowerCase()) {
    return `${name} (${code})`;
  }
  return name;
}

export function dedupeSubjectOptions<T extends { subjectId: string; subjectName: string }>(rows: T[]): T[] {
  const map = new Map<string, T>();
  for (const row of rows) {
    const key = row.subjectId;
    if (!map.has(key)) map.set(key, row);
  }
  return [...map.values()];
}
