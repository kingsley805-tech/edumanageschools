import { supabase } from "@/integrations/supabase/client";
import { normalizeAdmissionNumber, type RegistrationPoolType } from "@/lib/admission-numbers";

/** Internal Supabase auth email — students sign in with admission number, not this address. */
export function buildStudentAuthEmail(admissionNumber: string, schoolId: string): string {
  const slug = normalizeAdmissionNumber(admissionNumber)
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "");
  return `${schoolId}.${slug}@students.app`;
}

export type StudentAdmissionPreview = {
  valid: boolean;
  error?: string;
  student_id?: string;
  school_id?: string;
  student_name?: string;
  admission_number?: string;
  class_name?: string;
  school_name?: string;
  has_guardian?: boolean;
};

export type LoginResolveResult = {
  ok: boolean;
  error?: string;
  email?: string;
  role?: string;
};

export type RegistrationNumberValidation = {
  valid: boolean;
  error?: string;
  schoolId?: string;
  registrationNumber?: string;
};

/** Verify an unused registration number exists (signup) — lookup by number only, not prefix guess. */
export async function validateUnusedRegistrationNumber(
  registrationNumber: string,
  poolType: RegistrationPoolType
): Promise<RegistrationNumberValidation> {
  const num = normalizeAdmissionNumber(registrationNumber);
  if (!num) {
    return { valid: false, error: "Admission number is required." };
  }

  const { data: rpcData, error: rpcError } = await supabase.rpc(
    "validate_registration_number_for_signup",
    {
      p_registration_number: num,
      p_number_type: poolType,
    }
  );

  if (!rpcError && rpcData) {
    const result = rpcData as {
      valid?: boolean;
      error?: string;
      school_id?: string;
      registration_number?: string;
    };
    if (result.valid && result.school_id) {
      return {
        valid: true,
        schoolId: result.school_id,
        registrationNumber: result.registration_number,
      };
    }
    if (result.error) return { valid: false, error: result.error };
  }

  const { data: rows, error } = await supabase
    .from("registration_numbers")
    .select("school_id, registration_number, status")
    .ilike("registration_number", num)
    .eq("number_type", poolType)
    .eq("status", "unused")
    .limit(1);

  if (error) {
    return {
      valid: false,
      error: error.message || "Could not verify admission number.",
    };
  }

  const row = rows?.[0];
  if (!row) {
    const { data: usedRow } = await supabase
      .from("registration_numbers")
      .select("status")
      .ilike("registration_number", num)
      .eq("number_type", poolType)
      .maybeSingle();

    if (usedRow?.status === "used") {
      return {
        valid: false,
        error: "This admission number has already been used. Ask your school for a new number.",
      };
    }

    return {
      valid: false,
      error:
        "Admission number not found. Check the number from Number Generator or contact your school administrator.",
    };
  }

  return {
    valid: true,
    schoolId: row.school_id as string,
    registrationNumber: row.registration_number as string,
  };
}

export async function resolveStudentByAdmissionNumber(
  admissionNumber: string
): Promise<StudentAdmissionPreview> {
  const { data, error } = await supabase.rpc("resolve_student_by_admission_number", {
    p_admission_number: normalizeAdmissionNumber(admissionNumber),
  });

  if (error) {
    return { valid: false, error: error.message };
  }

  return (data ?? { valid: false, error: "Could not verify admission number." }) as StudentAdmissionPreview;
}

export async function resolveLoginIdentifier(identifier: string): Promise<LoginResolveResult> {
  const { data, error } = await supabase.rpc("resolve_login_identifier", {
    p_identifier: identifier.trim(),
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  return (data ?? { ok: false, error: "Login failed." }) as LoginResolveResult;
}

export async function linkParentToStudents(
  parentId: string,
  schoolId: string,
  admissionNumbers: string[]
): Promise<{ ok: boolean; error?: string; linked: number }> {
  let linked = 0;

  for (const raw of admissionNumbers) {
    const num = normalizeAdmissionNumber(raw);
    if (!num) continue;

    const preview = await resolveStudentByAdmissionNumber(num);
    if (!preview.valid || !preview.student_id) {
      return { ok: false, error: preview.error ?? `Invalid admission number: ${num}`, linked };
    }

    if (preview.school_id !== schoolId) {
      return { ok: false, error: "All children must belong to the same school.", linked };
    }

    const { data: existingLink } = await supabase
      .from("parent_student_links")
      .select("id")
      .eq("parent_id", parentId)
      .eq("student_id", preview.student_id)
      .maybeSingle();

    if (existingLink) {
      linked += 1;
      continue;
    }

    const { data: studentRow } = await supabase
      .from("students")
      .select("guardian_id")
      .eq("id", preview.student_id)
      .maybeSingle();

    if (studentRow?.guardian_id && studentRow.guardian_id !== parentId) {
      return {
        ok: false,
        error: "This student is already linked to another parent account.",
        linked,
      };
    }

    const { error: linkErr } = await supabase.from("parent_student_links").upsert(
      {
        parent_id: parentId,
        student_id: preview.student_id,
        relationship: "parent",
      },
      { onConflict: "parent_id,student_id" }
    );

    if (linkErr) {
      return { ok: false, error: linkErr.message, linked };
    }

    await supabase
      .from("students")
      .update({ guardian_id: parentId })
      .eq("id", preview.student_id)
      .is("guardian_id", null);

    linked += 1;
  }

  if (linked === 0) {
    return { ok: false, error: "No students were linked.", linked: 0 };
  }

  return { ok: true, linked };
}
