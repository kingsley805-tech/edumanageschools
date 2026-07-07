import { supabase } from "@/integrations/supabase/client";
import { isMissingTableError } from "@/modules/lib/missingSchema";

export type InventorySchemaStatus = {
  items: boolean;
  suppliers: boolean;
  assets: boolean;
  movements: boolean;
  purchases: boolean;
  issuances: boolean;
  rpcStats: boolean;
};

async function tableExists(table: string): Promise<boolean> {
  const { error } = await supabase.from(table).select("id", { head: true, count: "exact" }).limit(1);
  if (!error) return true;
  return !isMissingTableError(error);
}

export async function checkInventorySchema(schoolId: string): Promise<InventorySchemaStatus> {
  const [items, suppliers, assets, movements, purchases, issuances] = await Promise.all([
    tableExists("inventory_items"),
    tableExists("inventory_suppliers"),
    tableExists("inventory_assets"),
    tableExists("inventory_stock_movements"),
    tableExists("inventory_purchase_orders"),
    tableExists("inventory_issuances"),
  ]);

  let rpcStats = false;
  if (items) {
    const { error } = await supabase.rpc("get_inventory_dashboard_stats", { p_school_id: schoolId });
    if (!error) rpcStats = true;
    else if (!isMissingTableError(error)) rpcStats = true;
  }

  return { items, suppliers, assets, movements, purchases, issuances, rpcStats };
}

export function inventorySchemaReady(status: InventorySchemaStatus): boolean {
  return status.items && status.suppliers && status.assets && status.movements;
}

export function inventorySchemaMissingLabels(status: InventorySchemaStatus): string[] {
  const missing: string[] = [];
  if (!status.items) missing.push("inventory_items");
  if (!status.suppliers) missing.push("inventory_suppliers");
  if (!status.assets) missing.push("inventory_assets");
  if (!status.movements) missing.push("inventory_stock_movements");
  if (!status.purchases) missing.push("inventory_purchase_orders");
  if (!status.issuances) missing.push("inventory_issuances");
  if (status.items && !status.rpcStats) missing.push("get_inventory_dashboard_stats (RPC)");
  return missing;
}
