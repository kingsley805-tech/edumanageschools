import { supabase } from "@/integrations/supabase/client";
import { isMissingTableError } from "@/modules/lib/missingSchema";

export type AchievementsSchemaStatus = {
  categories: boolean;
  achievements: boolean;
  notes: boolean;
  rpcStats: boolean;
};

async function tableExists(table: string): Promise<boolean> {
  const { error } = await supabase.from(table).select("id", { head: true, count: "exact" }).limit(1);
  if (!error) return true;
  return !isMissingTableError(error);
}

export async function checkAchievementsSchema(schoolId: string): Promise<AchievementsSchemaStatus> {
  const [categories, achievements, notes] = await Promise.all([
    tableExists("achievement_categories"),
    tableExists("achievements"),
    tableExists("achievement_notes"),
  ]);

  let rpcStats = false;
  if (achievements) {
    const { error } = await supabase.rpc("get_achievements_dashboard_stats", {
      p_school_id: schoolId,
    });
    if (!error) rpcStats = true;
    else if (!isMissingTableError(error)) rpcStats = true;
  }

  return { categories, achievements, notes, rpcStats };
}

export function achievementsSchemaReady(status: AchievementsSchemaStatus): boolean {
  return status.categories && status.achievements;
}

export function achievementsSchemaMissingLabels(status: AchievementsSchemaStatus): string[] {
  const missing: string[] = [];
  if (!status.categories) missing.push("achievement_categories");
  if (!status.achievements) missing.push("achievements");
  if (!status.notes) missing.push("achievement_notes");
  if (status.achievements && !status.rpcStats) {
    missing.push("get_achievements_dashboard_stats (RPC)");
  }
  return missing;
}
