import { supabase } from "@/integrations/supabase/client";
import { normalizeAdmissionNumber } from "@/lib/admission-numbers";

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
