import { supabase } from "@/integrations/supabase/client";
import { isMissingTableError } from "@/modules/lib/missingSchema";

export type ProgramsSchemaStatus = {
  programs: boolean;
  /** Cover image / video / gallery columns + storage (apply-program-media.sql) */
  media: boolean;
};

async function tableExists(table: string): Promise<boolean> {
  const { error } = await supabase.from(table).select("id", { head: true, count: "exact" }).limit(1);
  if (!error) return true;
  return !isMissingTableError(error);
}

async function mediaColumnsExist(): Promise<boolean> {
  const { error } = await supabase
    .from("academic_programs")
    .select("id, image_url, video_url, gallery_urls", { head: true, count: "exact" })
    .limit(1);
  if (!error) return true;
  if (isMissingTableError(error)) return false;
  return !(
    error.code === "PGRST204" ||
    /Could not find the '.+' column/i.test(error.message ?? "") ||
    /schema cache/i.test(error.message ?? "")
  );
}

export async function checkProgramsSchema(): Promise<ProgramsSchemaStatus> {
  const programs = await tableExists("academic_programs");
  const media = programs ? await mediaColumnsExist() : false;
  return { programs, media };
}

export function programsSchemaReady(status: ProgramsSchemaStatus): boolean {
  return status.programs;
}

export function programsSchemaMissingLabels(status: ProgramsSchemaStatus): string[] {
  const missing: string[] = [];
  if (!status.programs) missing.push("academic_programs");
  if (status.programs && !status.media) missing.push("program media (image_url / video_url / gallery)");
  return missing;
}
