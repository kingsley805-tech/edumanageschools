// @ts-nocheck
import { supabase } from "@/integrations/supabase/client";
import { isMissingTableError } from "@/modules/lib/missingSchema";

export type AiReceptionistSchemaStatus = {
  agents: boolean;
  settings: boolean;
  knowledge: boolean;
  calls: boolean;
  actions: boolean;
};

async function tableExists(table: string): Promise<boolean> {
  const { error } = await supabase.from(table).select("id", { head: true, count: "exact" }).limit(1);
  if (!error) return true;
  return !isMissingTableError(error);
}

export async function checkAiReceptionistSchema(): Promise<AiReceptionistSchemaStatus> {
  const [agents, settings, knowledge, calls, actions] = await Promise.all([
    tableExists("ai_voice_agents"),
    tableExists("ai_voice_settings"),
    tableExists("ai_knowledge_base"),
    tableExists("ai_calls"),
    tableExists("ai_actions"),
  ]);
  return { agents, settings, knowledge, calls, actions };
}

export function aiReceptionistSchemaReady(status: AiReceptionistSchemaStatus): boolean {
  return status.agents && status.settings && status.knowledge && status.calls && status.actions;
}

export function aiReceptionistSchemaMissingLabels(status: AiReceptionistSchemaStatus): string[] {
  const missing: string[] = [];
  if (!status.agents) missing.push("ai_voice_agents");
  if (!status.settings) missing.push("ai_voice_settings");
  if (!status.knowledge) missing.push("ai_knowledge_base");
  if (!status.calls) missing.push("ai_calls");
  if (!status.actions) missing.push("ai_actions");
  return missing;
}
