import { supabase } from "@/integrations/supabase/client";
import { fetchSchoolPrefixById as fetchSchoolPrefixFromDb, isSchemaColumnError } from "@/lib/schoolFetch";
import { getSchoolPrefix, normalizeSchoolPrefix } from "@/lib/school-prefix";

export { derivePrefixFromSchoolName, getSchoolPrefix, normalizeSchoolPrefix } from "@/lib/school-prefix";

/** Role segment in admission numbers (MINGO-Stu-2026-001) */
export type AdmissionRoleCode = "Stu" | "Tea" | "Par" | "Adm";

/** Internal pool type for registration_numbers table */
export type RegistrationPoolType = "student" | "employee";

export const ROLE_TO_POOL: Record<AdmissionRoleCode, RegistrationPoolType> = {
  Stu: "student",
  Tea: "employee",
  Par: "employee", // unused in pool today; reserved
  Adm: "employee",
};

export const POOL_TO_ROLE: Record<RegistrationPoolType, AdmissionRoleCode> = {
  student: "Stu",
  employee: "Tea",
};

function canonicalRoleCode(segment: string): AdmissionRoleCode {
  switch (segment.toLowerCase()) {
    case "tea":
      return "Tea";
    case "par":
      return "Par";
    case "adm":
      return "Adm";
    default:
      return "Stu";
  }
}

/** Canonical form stored in DB (e.g. MIN-Stu-2026-004). Accepts any casing on input. */
export function normalizeAdmissionNumber(value: string): string {
  const trimmed = value.trim();
  const parsed = parseAdmissionNumber(trimmed);
  if (!parsed) return trimmed.toUpperCase();

  if (parsed.legacy && parsed.year != null && parsed.sequence != null) {
    const seq = parsed.sequence.toString().padStart(3, "0");
    if (parsed.role === "Tea") return `EMP-${parsed.year}-${seq}`;
    return `ADM-${parsed.year}-${seq}`;
  }

  if (parsed.schoolPrefix && parsed.role && parsed.year != null && parsed.sequence != null) {
    return buildAdmissionNumber(parsed.schoolPrefix, parsed.role, parsed.year, parsed.sequence);
  }

  return trimmed.toUpperCase();
}

export function buildAdmissionNumber(
  schoolPrefix: string,
  role: AdmissionRoleCode,
  year: number,
  sequence: number
): string {
  const prefix = schoolPrefix.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return `${prefix}-${role}-${year}-${sequence.toString().padStart(3, "0")}`;
}

/** Parse new format or legacy ADM-YYYY-NNN / EMP-YYYY-NNN */
export function parseAdmissionNumber(value: string): {
  schoolPrefix: string | null;
  role: AdmissionRoleCode | null;
  year: number | null;
  sequence: number | null;
  legacy: boolean;
} | null {
  const v = value.trim();
  const modern = /^([A-Z0-9]+)-(Stu|Tea|Par|Adm)-(\d{4})-(\d{3})$/i.exec(v);
  if (modern) {
    return {
      schoolPrefix: modern[1].toUpperCase(),
      role: canonicalRoleCode(modern[2]),
      year: parseInt(modern[3], 10),
      sequence: parseInt(modern[4], 10),
      legacy: false,
    };
  }
  const legacyStu = /^ADM-(\d{4})-(\d{3})$/i.exec(v);
  if (legacyStu) {
    return {
      schoolPrefix: null,
      role: "Stu",
      year: parseInt(legacyStu[1], 10),
      sequence: parseInt(legacyStu[2], 10),
      legacy: true,
    };
  }
  const legacyEmp = /^EMP-(\d{4})-(\d{3})$/i.exec(v);
  if (legacyEmp) {
    return {
      schoolPrefix: null,
      role: "Tea",
      year: parseInt(legacyEmp[1], 10),
      sequence: parseInt(legacyEmp[2], 10),
      legacy: true,
    };
  }
  return null;
}

export function formatExample(schoolPrefix: string, role: AdmissionRoleCode, year?: number): string {
  const y = year ?? new Date().getFullYear();
  return buildAdmissionNumber(schoolPrefix, role, y, 1);
}

function extractSequenceFromNumber(value: string, schoolPrefix: string, role: AdmissionRoleCode, year: number): number | null {
  const parsed = parseAdmissionNumber(value);
  if (!parsed || parsed.year !== year) return null;
  if (parsed.role !== role) return null;
  if (parsed.schoolPrefix && parsed.schoolPrefix !== schoolPrefix.toUpperCase()) return null;
  return parsed.sequence;
}

export async function getNextSequenceNumber(
  schoolId: string,
  poolType: RegistrationPoolType,
  schoolPrefix: string,
  year: number = new Date().getFullYear()
): Promise<number> {
  const role = POOL_TO_ROLE[poolType];

  const { data, error } = await supabase
    .from("registration_numbers")
    .select("registration_number")
    .eq("school_id", schoolId)
    .eq("number_type", poolType);

  if (error) throw error;

  let maxSeq = 0;
  for (const row of data ?? []) {
    const seq = extractSequenceFromNumber(row.registration_number, schoolPrefix, role, year);
    if (seq != null && seq > maxSeq) maxSeq = seq;
  }

  // Also consider assigned students/teachers
  if (poolType === "student") {
    const { data: students } = await supabase
      .from("students")
      .select("admission_no, admission_number")
      .eq("school_id", schoolId);
    for (const s of students ?? []) {
      const num = s.admission_no || s.admission_number;
      if (!num) continue;
      const seq = extractSequenceFromNumber(num, schoolPrefix, role, year);
      if (seq != null && seq > maxSeq) maxSeq = seq;
    }
  } else {
    const { data: teachers } = await supabase
      .from("teachers")
      .select("employee_no")
      .eq("school_id", schoolId);
    for (const t of teachers ?? []) {
      if (!t.employee_no) continue;
      const seq = extractSequenceFromNumber(t.employee_no, schoolPrefix, role, year);
      if (seq != null && seq > maxSeq) maxSeq = seq;
    }
  }

  return maxSeq + 1;
}

export async function fetchSchoolPrefixById(schoolId: string): Promise<string> {
  return fetchSchoolPrefixFromDb(schoolId);
}

export async function resolveSchoolIdFromAdmissionNumber(
  admissionNumber: string
): Promise<{ schoolId: string; schoolPrefix: string } | null> {
  const parsed = parseAdmissionNumber(admissionNumber);
  if (!parsed?.schoolPrefix) return null;

  const prefixQuery = await supabase
    .from("schools")
    .select("id, admission_prefix, school_code")
    .eq("admission_prefix", parsed.schoolPrefix)
    .eq("is_active", true)
    .maybeSingle();

  if (!isSchemaColumnError(prefixQuery.error) && prefixQuery.data) {
    return {
      schoolId: prefixQuery.data.id,
      schoolPrefix: getSchoolPrefix(prefixQuery.data),
    };
  }

  const codeQuery = await supabase
    .from("schools")
    .select("id, school_code, admission_prefix")
    .eq("school_code", parsed.schoolPrefix)
    .eq("is_active", true)
    .maybeSingle();

  if (isSchemaColumnError(codeQuery.error)) {
    const fallback = await supabase
      .from("schools")
      .select("id, school_code")
      .eq("school_code", parsed.schoolPrefix)
      .eq("is_active", true)
      .maybeSingle();
    if (fallback.data) {
      return {
        schoolId: fallback.data.id,
        schoolPrefix: getSchoolPrefix({ school_code: fallback.data.school_code }),
      };
    }
  } else if (codeQuery.data) {
    return {
      schoolId: codeQuery.data.id,
      schoolPrefix: getSchoolPrefix(codeQuery.data),
    };
  }

  const { data: activeSchools, error: listError } = await supabase
    .from("schools")
    .select("id, school_name, school_code, admission_prefix")
    .eq("is_active", true);

  if (!listError && activeSchools?.length) {
    const match = activeSchools.find(
      (s) => getSchoolPrefix(s) === parsed.schoolPrefix.toUpperCase()
    );
    if (match) {
      return { schoolId: match.id, schoolPrefix: getSchoolPrefix(match) };
    }
  }

  if (isSchemaColumnError(listError)) {
    const { data: basicSchools } = await supabase
      .from("schools")
      .select("id, school_name, school_code")
      .eq("is_active", true);
    const match = basicSchools?.find(
      (s) => getSchoolPrefix(s) === parsed.schoolPrefix.toUpperCase()
    );
    if (match) {
      return { schoolId: match.id, schoolPrefix: getSchoolPrefix(match) };
    }
  }

  return null;
}

export async function generateRegistrationNumber(params: {
  schoolId: string;
  userId: string;
  poolType: RegistrationPoolType;
  auditAction?: string;
}): Promise<string> {
  const year = new Date().getFullYear();
  const schoolPrefix = await fetchSchoolPrefixById(params.schoolId);
  const role = POOL_TO_ROLE[params.poolType];
  const sequence = await getNextSequenceNumber(params.schoolId, params.poolType, schoolPrefix, year);
  const registrationNumber = buildAdmissionNumber(schoolPrefix, role, year, sequence);

  const { error } = await supabase.from("registration_numbers").insert({
    school_id: params.schoolId,
    number_type: params.poolType,
    registration_number: registrationNumber,
    status: "unused",
    generated_by: params.userId,
  });

  if (error) {
    if (error.code === "23505") {
      throw new Error("This number already exists. Try generating again.");
    }
    throw error;
  }

  await supabase.from("audit_logs").insert({
    school_id: params.schoolId,
    action_type: params.auditAction ?? "single_generate",
    entity_type: "registration_number",
    performed_by: params.userId,
    details: {
      number_type: params.poolType,
      registration_number: registrationNumber,
      format: `${schoolPrefix}-${role}-${year}-NNN`,
    },
  });

  return registrationNumber;
}
