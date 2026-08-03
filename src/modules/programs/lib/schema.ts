import { supabase } from "@/integrations/supabase/client";
import { isMissingTableError } from "@/modules/lib/missingSchema";

export type ProgramsSchemaStatus = {
  programs: boolean;
};

async function tableExists(table: string): Promise<boolean> {
  const { error } = await supabase.from(table).select("id", { head: true, count: "exact" }).limit(1);
  if (!error) return true;
  return !isMissingTableError(error);
}

export async function checkProgramsSchema(): Promise<ProgramsSchemaStatus> {
  const programs = await tableExists("academic_programs");
  return { programs };
}

export function programsSchemaReady(status: ProgramsSchemaStatus): boolean {
  return status.programs;
}

export function programsSchemaMissingLabels(status: ProgramsSchemaStatus): string[] {
  return status.programs ? [] : ["academic_programs"];
}
