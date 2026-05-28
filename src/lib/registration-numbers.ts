import { supabase } from "@/integrations/supabase/client";

export type RegistrationNumberType = "student" | "employee";

export function getRegistrationPrefix(
  type: RegistrationNumberType,
  year: number = new Date().getFullYear()
): string {
  return type === "student" ? `ADM-${year}-` : `EMP-${year}-`;
}

export async function getNextSequenceNumber(
  schoolId: string,
  type: RegistrationNumberType,
  year: number = new Date().getFullYear()
): Promise<number> {
  const prefix = getRegistrationPrefix(type, year);

  const { data, error } = await supabase
    .from("registration_numbers")
    .select("registration_number")
    .eq("school_id", schoolId)
    .eq("number_type", type)
    .like("registration_number", `${prefix}%`)
    .order("registration_number", { ascending: false })
    .limit(1);

  if (error || !data?.length) {
    return 1;
  }

  const suffix = data[0].registration_number.replace(prefix, "");
  const lastSequence = parseInt(suffix, 10);
  return Number.isNaN(lastSequence) ? 1 : lastSequence + 1;
}

export async function generateRegistrationNumber(params: {
  schoolId: string;
  userId: string;
  type: RegistrationNumberType;
  auditAction?: string;
}): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = getRegistrationPrefix(params.type, year);
  const sequence = await getNextSequenceNumber(params.schoolId, params.type, year);
  const registrationNumber = `${prefix}${sequence.toString().padStart(3, "0")}`;

  const { error } = await supabase.from("registration_numbers").insert({
    school_id: params.schoolId,
    number_type: params.type,
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
      number_type: params.type,
      registration_number: registrationNumber,
      format: params.type === "student" ? `ADM-${year}-NNN` : `EMP-${year}-NNN`,
    },
  });

  return registrationNumber;
}
