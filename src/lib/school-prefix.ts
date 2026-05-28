/** Normalize prefix segment (uppercase alphanumeric only). */
export function normalizeSchoolPrefix(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * Default admission prefix: first 3 letters of the school name (letters only).
 * e.g. "Mingo High School" → "MIN", "Saint Mary's" → "SAI"
 */
export function derivePrefixFromSchoolName(schoolName: string): string {
  const letters = schoolName.replace(/[^a-zA-Z]/g, "").toUpperCase();
  if (letters.length >= 3) return letters.slice(0, 3);
  if (letters.length > 0) return letters.padEnd(3, "X");

  const alnum = schoolName.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  if (alnum.length >= 3) return alnum.slice(0, 3);
  if (alnum.length > 0) return alnum.padEnd(3, "X");

  return "SCH";
}

export type SchoolPrefixSource = {
  admission_prefix?: string | null;
  school_name?: string | null;
  school_code?: string | null;
};

/**
 * Resolved prefix for admission numbers.
 * 1. Explicit admission_prefix (admin override)
 * 2. First 3 letters of school_name
 * 3. school_code (legacy fallback only)
 */
export function getSchoolPrefix(school: SchoolPrefixSource): string {
  const explicit = school.admission_prefix?.trim();
  if (explicit) return normalizeSchoolPrefix(explicit);

  const name = school.school_name?.trim();
  if (name) return derivePrefixFromSchoolName(name);

  const code = school.school_code?.trim();
  if (code) return normalizeSchoolPrefix(code);

  throw new Error("School admission prefix is not configured");
}

/** True when stored prefix was auto-derived from name (not a manual override). */
export function isAutoDerivedPrefix(school: SchoolPrefixSource): boolean {
  if (!school.admission_prefix?.trim()) return true;
  const stored = normalizeSchoolPrefix(school.admission_prefix);
  const fromName = school.school_name ? derivePrefixFromSchoolName(school.school_name) : null;
  const fromCode = school.school_code ? normalizeSchoolPrefix(school.school_code) : null;
  return stored === fromName || stored === fromCode;
}
