import { supabase } from "@/integrations/supabase/client";
import { isMissingTableError } from "@/modules/lib/missingSchema";

export type HostelSchemaStatus = {
  blocks: boolean;
  rooms: boolean;
  beds: boolean;
  allocations: boolean;
  payments: boolean;
  rpcStats: boolean;
};

async function tableExists(table: string): Promise<boolean> {
  const { error } = await supabase.from(table).select("id", { head: true, count: "exact" }).limit(1);
  if (!error) return true;
  return !isMissingTableError(error);
}

export async function checkHostelSchema(schoolId: string): Promise<HostelSchemaStatus> {
  const [blocks, rooms, beds, allocations, payments] = await Promise.all([
    tableExists("hostel_blocks"),
    tableExists("hostel_rooms"),
    tableExists("hostel_beds"),
    tableExists("hostel_allocations"),
    tableExists("hostel_payments"),
  ]);

  let rpcStats = false;
  if (blocks) {
    const { error } = await supabase.rpc("get_hostel_dashboard_stats", { p_school_id: schoolId });
    if (!error) rpcStats = true;
    else if (!isMissingTableError(error)) rpcStats = true;
  }

  return { blocks, rooms, beds, allocations, payments, rpcStats };
}

export function hostelSchemaReady(status: HostelSchemaStatus): boolean {
  return status.blocks && status.rooms && status.allocations;
}

export function hostelSchemaMissingLabels(status: HostelSchemaStatus): string[] {
  const missing: string[] = [];
  if (!status.blocks) missing.push("hostel_blocks");
  if (!status.rooms) missing.push("hostel_rooms");
  if (!status.beds) missing.push("hostel_beds");
  if (!status.allocations) missing.push("hostel_allocations");
  if (!status.payments) missing.push("hostel_payments");
  if (status.blocks && !status.rpcStats) missing.push("get_hostel_dashboard_stats (RPC)");
  return missing;
}
