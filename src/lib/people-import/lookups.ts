import { supabase } from "@/integrations/supabase/client";
import type { ImportContextLookups, PeopleImportEntity } from "./types";

export async function loadImportLookups(
  schoolId: string,
  entity: PeopleImportEntity,
): Promise<ImportContextLookups> {
  const { data: school } = await supabase
    .from("schools")
    .select("school_code")
    .eq("id", schoolId)
    .maybeSingle();

  const { data: classes } = await supabase
    .from("classes")
    .select("id, name, stream, level")
    .eq("school_id", schoolId);

  const { data: subjects } = await supabase
    .from("subjects")
    .select("id, name")
    .eq("school_id", schoolId);

  let existingStudents: ImportContextLookups["existingStudents"] = [];
  let existingTeachers: ImportContextLookups["existingTeachers"] = [];
  let existingParents: ImportContextLookups["existingParents"] = [];

  if (entity === "student" || entity === "parent") {
    const { data } = await supabase
      .from("students")
      .select("id, admission_no, admission_number, full_name, user_id")
      .eq("school_id", schoolId);
    existingStudents = data ?? [];
  }

  if (entity === "teacher") {
    const { data } = await supabase
      .from("teachers")
      .select("id, employee_no, user_id, profiles:user_id(email, phone)")
      .eq("school_id", schoolId);
    existingTeachers = (data ?? []).map((t: any) => ({
      id: t.id,
      employee_no: t.employee_no,
      user_id: t.user_id,
      email: t.profiles?.email ?? null,
      phone: t.profiles?.phone ?? null,
    }));
  }

  if (entity === "parent" || entity === "student") {
    const { data } = await supabase
      .from("parents")
      .select("id, user_id, phone, profiles:user_id(email)")
      .eq("school_id", schoolId);
    existingParents = (data ?? []).map((p: any) => ({
      id: p.id,
      user_id: p.user_id,
      phone: p.phone,
      email: p.profiles?.email ?? null,
    }));
  }

  return {
    schoolId,
    schoolCode: school?.school_code ?? "",
    classes: classes ?? [],
    subjects: subjects ?? [],
    existingStudents,
    existingTeachers,
    existingParents,
  };
}

function normKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/** "10A" → name 10 + stream A; "JHS 1" stays as name. */
export function parseClassLabel(
  className: string,
  section = "",
): { name: string; stream: string | null } {
  const sectionTrim = section.trim();
  const raw = className.trim();
  if (!raw) return { name: "", stream: sectionTrim || null };
  if (sectionTrim) return { name: raw, stream: sectionTrim };

  const compact = raw.match(/^(\d+)\s*([A-Za-z])$/);
  if (compact) {
    return { name: compact[1], stream: compact[2].toUpperCase() };
  }
  const spaced = raw.match(/^(.+?)\s+([A-Za-z])$/);
  if (spaced && /^\d/.test(spaced[1].trim())) {
    return { name: spaced[1].trim(), stream: spaced[2].toUpperCase() };
  }
  return { name: raw, stream: null };
}

function classExists(
  lookups: ImportContextLookups,
  name: string,
  stream: string | null,
): boolean {
  const n = normKey(name);
  const s = stream ? normKey(stream) : "";
  const combined = s ? `${n}${s}` : n;
  return lookups.classes.some((c) => {
    const cn = normKey(c.name);
    const cs = c.stream ? normKey(c.stream) : "";
    if (cn === n && (!s || cs === s)) return true;
    if (`${cn}${cs}` === combined) return true;
    if (cn === combined) return true;
    return false;
  });
}

function subjectExists(lookups: ImportContextLookups, name: string): boolean {
  const n = normKey(name);
  return lookups.subjects.some((s) => normKey(s.name) === n);
}

function splitList(raw: string): string[] {
  return raw
    .split(/[,;|]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export type EnsureLookupsResult = {
  lookups: ImportContextLookups;
  createdClasses: string[];
  createdSubjects: string[];
};

/**
 * Create any classes / subjects referenced in the spreadsheet that do not exist yet,
 * then return refreshed lookups.
 */
export async function ensureMissingImportLookups(
  schoolId: string,
  entity: PeopleImportEntity,
  rows: Record<string, string>[],
  lookups: ImportContextLookups,
): Promise<EnsureLookupsResult> {
  const createdClasses: string[] = [];
  const createdSubjects: string[] = [];
  let next = { ...lookups, classes: [...lookups.classes], subjects: [...lookups.subjects] };

  const classSpecs = new Map<string, { name: string; stream: string | null }>();

  for (const row of rows) {
    if (entity === "student") {
      const className = (row.class ?? "").trim();
      const section = (row.section ?? "").trim();
      if (!className) continue;
      const parsed = parseClassLabel(className, section);
      if (!parsed.name) continue;
      const key = `${normKey(parsed.name)}|${normKey(parsed.stream ?? "")}`;
      classSpecs.set(key, parsed);
    }
    if (entity === "teacher") {
      for (const name of splitList(row.classes_assigned ?? "")) {
        const parsed = parseClassLabel(name, "");
        if (!parsed.name) continue;
        const key = `${normKey(parsed.name)}|${normKey(parsed.stream ?? "")}`;
        classSpecs.set(key, parsed);
      }
      for (const sub of splitList(row.subjects ?? "")) {
        if (!subjectExists(next, sub)) {
          const { data, error } = await supabase
            .from("subjects")
            .insert({ name: sub, school_id: schoolId })
            .select("id, name")
            .single();
          if (!error && data) {
            next.subjects.push(data);
            createdSubjects.push(data.name);
          }
        }
      }
    }
  }

  for (const spec of classSpecs.values()) {
    if (classExists(next, spec.name, spec.stream)) continue;
    const label = spec.stream ? `${spec.name}${spec.stream}` : spec.name;
    const { data, error } = await supabase
      .from("classes")
      .insert({
        name: spec.name,
        stream: spec.stream,
        level: spec.name,
        school_id: schoolId,
      })
      .select("id, name, stream, level")
      .single();
    if (!error && data) {
      next.classes.push(data);
      createdClasses.push(label);
    } else {
      // Fallback: store full label as name (e.g. "10A")
      const fullName = label;
      if (classExists(next, fullName, null)) continue;
      const { data: data2, error: err2 } = await supabase
        .from("classes")
        .insert({
          name: fullName,
          stream: null,
          level: fullName,
          school_id: schoolId,
        })
        .select("id, name, stream, level")
        .single();
      if (!err2 && data2) {
        next.classes.push(data2);
        createdClasses.push(fullName);
      }
    }
  }

  return { lookups: next, createdClasses, createdSubjects };
}
