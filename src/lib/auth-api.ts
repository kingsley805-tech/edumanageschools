// @ts-nocheck
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

function formatAuthRpcError(error: { message?: string; code?: string }, fn: string): string {
  const msg = error.message ?? "";
  if (
    error.code === "PGRST202" ||
    error.code === "PGRST205" ||
    msg.includes("schema cache") ||
    msg.includes(`function public.${fn}`)
  ) {
    return `Login database function is not installed. Ask your administrator to run public/sql/apply-auth-login.sql in Supabase SQL Editor, then reload the API schema.`;
  }
  return msg || "Request failed.";
}

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
    return { valid: false, error: formatAuthRpcError(error, "resolve_student_by_admission_number") };
  }

  return (data ?? { valid: false, error: "Could not verify admission number." }) as StudentAdmissionPreview;
}

export async function resolveLoginIdentifier(identifier: string): Promise<LoginResolveResult> {
  const { data, error } = await supabase.rpc("resolve_login_identifier", {
    p_identifier: identifier.trim(),
  });

  if (error) {
    return { ok: false, error: formatAuthRpcError(error, "resolve_login_identifier") };
  }

  return (data ?? { ok: false, error: "Login failed." }) as LoginResolveResult;
}

export async function linkParentToStudents(
  _parentId: string | null,
  _schoolId: string | null,
  admissionNumbers: string[],
): Promise<{ ok: boolean; error?: string; linked: number; admission_numbers?: string[] }> {
  const nums = admissionNumbers.map(normalizeAdmissionNumber).filter(Boolean);
  if (nums.length === 0) {
    return { ok: false, error: "No admission numbers provided.", linked: 0 };
  }

  const { data, error } = await supabase.rpc("link_parent_children_by_admission", {
    p_admission_numbers: nums,
  });

  if (error) {
    const msg = error.message ?? "";
    if (
      error.code === "PGRST202" ||
      error.code === "PGRST205" ||
      msg.includes("link_parent_children_by_admission")
    ) {
      return {
        ok: false,
        error:
          "Parent linking is not installed. Ask your administrator to run public/sql/apply-parent-child-link.sql in Supabase.",
        linked: 0,
      };
    }
    return { ok: false, error: msg, linked: 0 };
  }

  const result = (data ?? {}) as {
    ok?: boolean;
    error?: string;
    linked?: number;
    admission_numbers?: string[];
  };

  if (!result.ok) {
    return {
      ok: false,
      error: result.error ?? "Could not link children",
      linked: result.linked ?? 0,
    };
  }

  return {
    ok: true,
    linked: result.linked ?? nums.length,
    admission_numbers: result.admission_numbers,
  };
}

/** Retry linking after signup while the parent row is created by the auth trigger. */
export async function ensureParentChildrenLinked(
  admissionNumbers: string[],
  maxAttempts = 8,
): Promise<{ ok: boolean; error?: string; linked: number }> {
  const nums = admissionNumbers.map(normalizeAdmissionNumber).filter(Boolean);
  if (nums.length === 0) {
    return { ok: false, error: "No admission numbers to link.", linked: 0 };
  }

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      return { ok: false, error: "Sign in required to link children.", linked: 0 };
    }

    const { data: parent } = await supabase
      .from("parents")
      .select("id")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (parent?.id) {
      return linkParentToStudents(parent.id, null, nums);
    }

    await new Promise((r) => setTimeout(r, 800));
  }

  return {
    ok: false,
    error: "Parent profile is still being created. Sign in and open My Children to finish linking.",
    linked: 0,
  };
}