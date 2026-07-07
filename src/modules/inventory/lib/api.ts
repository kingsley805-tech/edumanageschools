import { supabase } from "@/integrations/supabase/client";
import type {
  InventoryAsset,
  InventoryDashboardStats,
  InventoryIssuance,
  InventoryItem,
  InventorySupplier,
  PurchaseOrder,
  StockMovement,
} from "@/modules/inventory/lib/types";

const EMPTY_STATS: InventoryDashboardStats = {
  total_items: 0,
  total_assets: 0,
  available_stock: 0,
  low_stock_items: 0,
  out_of_stock_items: 0,
  recently_added: 0,
  total_inventory_value: 0,
  issued_today: 0,
  returned_today: 0,
  pending_purchase_orders: 0,
  damaged_items: 0,
  disposed_items: 0,
};

function deriveItemStatus(
  quantity: number,
  reorder: number | null,
  status?: string | null,
): InventoryItem["item_status"] {
  if (status === "discontinued") return "discontinued";
  if (quantity <= 0) return "out_of_stock";
  if (reorder != null && quantity <= reorder) return "low_stock";
  return "available";
}

export async function fetchInventoryDashboardStats(schoolId: string): Promise<InventoryDashboardStats> {
  const { data, error } = await supabase.rpc("get_inventory_dashboard_stats", { p_school_id: schoolId });
  if (error) throw error;
  return { ...EMPTY_STATS, ...(data as InventoryDashboardStats) };
}

export async function fetchInventoryItems(schoolId: string, includeArchived = false): Promise<InventoryItem[]> {
  let q = supabase
    .from("inventory_items")
    .select("*, inventory_suppliers(name)")
    .eq("school_id", schoolId)
    .order("name");
  if (!includeArchived) q = q.eq("is_archived", false);

  const { data, error } = await q;
  if (error) throw error;

  return (data ?? []).map((row) => {
    const qty = Number(row.quantity ?? 0);
    const cost = Number(row.unit_cost ?? 0);
    return {
      ...row,
      quantity: qty,
      unit_cost: cost,
      reorder_level: row.reorder_level != null ? Number(row.reorder_level) : null,
      max_stock_level: row.max_stock_level != null ? Number(row.max_stock_level) : null,
      item_status: deriveItemStatus(qty, row.reorder_level != null ? Number(row.reorder_level) : null, row.item_status),
      is_archived: Boolean(row.is_archived),
      supplier_name: (row.inventory_suppliers as { name?: string } | null)?.name ?? null,
      stock_value: qty * cost,
    };
  });
}

export async function saveInventoryItem(
  schoolId: string,
  payload: Partial<InventoryItem> & { name: string },
  id?: string,
) {
  const qty = Number(payload.quantity ?? 0);
  const reorder = payload.reorder_level != null ? Number(payload.reorder_level) : null;
  const row = {
    school_id: schoolId,
    sku: payload.sku?.trim() || null,
    barcode: payload.barcode?.trim() || null,
    name: payload.name.trim(),
    category: payload.category?.trim() || null,
    subcategory: payload.subcategory?.trim() || null,
    brand: payload.brand?.trim() || null,
    description: payload.description?.trim() || null,
    quantity: qty,
    unit: payload.unit?.trim() || "pcs",
    location: payload.location?.trim() || null,
    reorder_level: reorder,
    max_stock_level: payload.max_stock_level != null ? Number(payload.max_stock_level) : null,
    unit_cost: Number(payload.unit_cost ?? 0),
    supplier_id: payload.supplier_id || null,
    item_status: payload.item_status ?? deriveItemStatus(qty, reorder),
    is_archived: payload.is_archived ?? false,
    updated_at: new Date().toISOString(),
  };

  if (id) {
    const { error } = await supabase.from("inventory_items").update(row).eq("id", id);
    if (error) throw error;
    return id;
  }

  const { data, error } = await supabase.from("inventory_items").insert(row).select("id").single();
  if (error) throw error;
  return data.id;
}

export async function deleteInventoryItem(id: string) {
  const { error } = await supabase.from("inventory_items").delete().eq("id", id);
  if (error) throw error;
}

export async function archiveInventoryItem(id: string, archived: boolean) {
  const { error } = await supabase
    .from("inventory_items")
    .update({ is_archived: archived, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function recordStockMovement(
  itemId: string,
  transactionType: string,
  quantity: number,
  opts?: { source_destination?: string; department?: string; remarks?: string },
) {
  const { data, error } = await supabase.rpc("record_inventory_stock_movement", {
    p_item_id: itemId,
    p_transaction_type: transactionType,
    p_quantity: quantity,
    p_source_destination: opts?.source_destination ?? null,
    p_department: opts?.department ?? null,
    p_remarks: opts?.remarks ?? null,
  });
  if (error) throw error;
  const result = data as { ok?: boolean; error?: string };
  if (!result?.ok) throw new Error(result?.error ?? "Stock movement failed");
  return result;
}

export async function fetchSuppliers(schoolId: string): Promise<InventorySupplier[]> {
  const { data, error } = await supabase
    .from("inventory_suppliers")
    .select("*")
    .eq("school_id", schoolId)
    .order("name");
  if (error) throw error;

  const { data: pos } = await supabase
    .from("inventory_purchase_orders")
    .select("supplier_id")
    .eq("school_id", schoolId);

  const counts = new Map<string, number>();
  for (const po of pos ?? []) {
    if (po.supplier_id) counts.set(po.supplier_id, (counts.get(po.supplier_id) ?? 0) + 1);
  }

  return (data ?? []).map((s) => ({
    ...s,
    status: (s.status ?? "active") as InventorySupplier["status"],
    purchase_count: counts.get(s.id) ?? 0,
  }));
}

export async function saveSupplier(
  schoolId: string,
  payload: Partial<InventorySupplier> & { name: string },
  id?: string,
) {
  const row = {
    school_id: schoolId,
    name: payload.name.trim(),
    company_name: payload.company_name?.trim() || null,
    contact_person: payload.contact_person?.trim() || null,
    phone: payload.phone?.trim() || null,
    email: payload.email?.trim() || null,
    address: payload.address?.trim() || null,
    payment_terms: payload.payment_terms?.trim() || null,
    products_supplied: payload.products_supplied?.trim() || null,
    status: payload.status ?? "active",
    updated_at: new Date().toISOString(),
  };

  if (id) {
    const { error } = await supabase.from("inventory_suppliers").update(row).eq("id", id);
    if (error) throw error;
    return id;
  }

  const { data, error } = await supabase.from("inventory_suppliers").insert(row).select("id").single();
  if (error) throw error;
  return data.id;
}

export async function deleteSupplier(id: string) {
  const { error } = await supabase.from("inventory_suppliers").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchAssets(schoolId: string): Promise<InventoryAsset[]> {
  const { data, error } = await supabase
    .from("inventory_assets")
    .select("*, teachers(full_name), classes(name)")
    .eq("school_id", schoolId)
    .order("name");
  if (error) throw error;

  return (data ?? []).map((a) => ({
    ...a,
    purchase_cost: Number(a.purchase_cost ?? 0),
    current_value: Number(a.current_value ?? 0),
    asset_condition: (a.asset_condition ?? "good") as InventoryAsset["asset_condition"],
    asset_status: (a.asset_status ?? "active") as InventoryAsset["asset_status"],
    staff_name: (a.teachers as { full_name?: string } | null)?.full_name ?? null,
    class_name: (a.classes as { name?: string } | null)?.name ?? null,
  }));
}

export async function saveAsset(
  schoolId: string,
  payload: Partial<InventoryAsset> & { name: string; asset_code: string },
  id?: string,
) {
  const row = {
    school_id: schoolId,
    asset_code: payload.asset_code.trim(),
    name: payload.name.trim(),
    category: payload.category?.trim() || null,
    serial_number: payload.serial_number?.trim() || null,
    purchase_date: payload.purchase_date || null,
    purchase_cost: Number(payload.purchase_cost ?? 0),
    current_value: Number(payload.current_value ?? 0),
    assigned_department: payload.assigned_department?.trim() || null,
    assigned_staff_id: payload.assigned_staff_id || null,
    assigned_class_id: payload.assigned_class_id || null,
    asset_condition: payload.asset_condition ?? "good",
    warranty_info: payload.warranty_info?.trim() || null,
    maintenance_schedule: payload.maintenance_schedule?.trim() || null,
    last_maintenance_date: payload.last_maintenance_date || null,
    next_maintenance_date: payload.next_maintenance_date || null,
    asset_status: payload.asset_status ?? "active",
    barcode: payload.barcode?.trim() || null,
    notes: payload.notes?.trim() || null,
    updated_at: new Date().toISOString(),
  };

  if (id) {
    const { error } = await supabase.from("inventory_assets").update(row).eq("id", id);
    if (error) throw error;
    return id;
  }

  const { data, error } = await supabase.from("inventory_assets").insert(row).select("id").single();
  if (error) throw error;
  return data.id;
}

export async function deleteAsset(id: string) {
  const { error } = await supabase.from("inventory_assets").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchStockMovements(schoolId: string): Promise<StockMovement[]> {
  const { data, error } = await supabase
    .from("inventory_stock_movements")
    .select("*, inventory_items(name, sku)")
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;

  return (data ?? []).map((m) => ({
    ...m,
    quantity: Number(m.quantity),
    previous_stock: Number(m.previous_stock),
    current_stock: Number(m.current_stock),
    transaction_type: m.transaction_type as StockMovement["transaction_type"],
    item_name: (m.inventory_items as { name?: string } | null)?.name,
    item_sku: (m.inventory_items as { sku?: string } | null)?.sku ?? null,
  }));
}

export async function fetchPurchaseOrders(schoolId: string): Promise<PurchaseOrder[]> {
  const { data, error } = await supabase
    .from("inventory_purchase_orders")
    .select("*, inventory_suppliers(name), inventory_purchase_order_lines(*)")
    .eq("school_id", schoolId)
    .order("purchase_date", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((po) => ({
    ...po,
    total_cost: Number(po.total_cost ?? 0),
    payment_status: po.payment_status as PurchaseOrder["payment_status"],
    delivery_status: po.delivery_status as PurchaseOrder["delivery_status"],
    supplier_name: (po.inventory_suppliers as { name?: string } | null)?.name ?? null,
    lines: ((po.inventory_purchase_order_lines as PurchaseOrder["lines"]) ?? []).map((l) => ({
      ...l,
      quantity: Number(l.quantity),
      unit_price: Number(l.unit_price),
      line_total: Number(l.line_total),
    })),
  }));
}

export async function savePurchaseOrder(
  schoolId: string,
  payload: {
    po_number: string;
    supplier_id?: string | null;
    purchase_date: string;
    expected_delivery_date?: string | null;
    payment_status?: string;
    delivery_status?: string;
    invoice_number?: string | null;
    receipt_url?: string | null;
    notes?: string | null;
    lines: { item_id?: string | null; item_name: string; quantity: number; unit_price: number }[];
  },
  id?: string,
) {
  const total = payload.lines.reduce((s, l) => s + l.quantity * l.unit_price, 0);
  const row = {
    school_id: schoolId,
    po_number: payload.po_number.trim(),
    supplier_id: payload.supplier_id || null,
    purchase_date: payload.purchase_date,
    expected_delivery_date: payload.expected_delivery_date || null,
    total_cost: total,
    payment_status: payload.payment_status ?? "unpaid",
    delivery_status: payload.delivery_status ?? "pending",
    invoice_number: payload.invoice_number?.trim() || null,
    receipt_url: payload.receipt_url?.trim() || null,
    notes: payload.notes?.trim() || null,
    updated_at: new Date().toISOString(),
  };

  let poId = id;
  if (id) {
    const { error } = await supabase.from("inventory_purchase_orders").update(row).eq("id", id);
    if (error) throw error;
    await supabase.from("inventory_purchase_order_lines").delete().eq("purchase_order_id", id);
  } else {
    const { data, error } = await supabase.from("inventory_purchase_orders").insert(row).select("id").single();
    if (error) throw error;
    poId = data.id;
  }

  if (payload.lines.length > 0 && poId) {
    const lineRows = payload.lines.map((l) => ({
      school_id: schoolId,
      purchase_order_id: poId,
      item_id: l.item_id || null,
      item_name: l.item_name,
      quantity: l.quantity,
      unit_price: l.unit_price,
      line_total: l.quantity * l.unit_price,
    }));
    const { error } = await supabase.from("inventory_purchase_order_lines").insert(lineRows);
    if (error) throw error;
  }

  return poId!;
}

export async function deletePurchaseOrder(id: string) {
  const { error } = await supabase.from("inventory_purchase_orders").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchIssuances(schoolId: string): Promise<InventoryIssuance[]> {
  const { data, error } = await supabase
    .from("inventory_issuances")
    .select("*, inventory_items(name, sku)")
    .eq("school_id", schoolId)
    .order("issue_date", { ascending: false });
  if (error) throw error;

  const today = new Date().toISOString().slice(0, 10);
  return (data ?? []).map((i) => {
    let status = i.status as InventoryIssuance["status"];
    if (status === "issued" && i.expected_return_date && i.expected_return_date < today) {
      status = "overdue";
    }
    return {
      ...i,
      quantity: Number(i.quantity),
      recipient_type: i.recipient_type as InventoryIssuance["recipient_type"],
      status,
      item_name: (i.inventory_items as { name?: string } | null)?.name,
      item_sku: (i.inventory_items as { sku?: string } | null)?.sku ?? null,
    };
  });
}

export async function saveIssuance(
  schoolId: string,
  payload: Partial<InventoryIssuance> & { item_id: string; recipient_name: string; quantity: number },
  id?: string,
) {
  const row = {
    school_id: schoolId,
    item_id: payload.item_id,
    recipient_type: payload.recipient_type ?? "student",
    recipient_name: payload.recipient_name.trim(),
    recipient_ref: payload.recipient_ref?.trim() || null,
    class_or_department: payload.class_or_department?.trim() || null,
    quantity: Number(payload.quantity),
    issue_date: payload.issue_date ?? new Date().toISOString().slice(0, 10),
    return_date: payload.return_date || null,
    expected_return_date: payload.expected_return_date || null,
    status: payload.status ?? "issued",
    remarks: payload.remarks?.trim() || null,
    updated_at: new Date().toISOString(),
  };

  if (id) {
    const { error } = await supabase.from("inventory_issuances").update(row).eq("id", id);
    if (error) throw error;
    return id;
  }

  const { data, error } = await supabase.from("inventory_issuances").insert(row).select("id").single();
  if (error) throw error;

  if (row.status === "issued") {
    await recordStockMovement(payload.item_id, "stock_out", row.quantity, {
      department: row.class_or_department ?? undefined,
      remarks: `Issued to ${row.recipient_name}`,
    });
  }

  return data.id;
}

export async function returnIssuance(issuance: InventoryIssuance) {
  const { error } = await supabase
    .from("inventory_issuances")
    .update({
      status: "returned",
      return_date: new Date().toISOString().slice(0, 10),
      updated_at: new Date().toISOString(),
    })
    .eq("id", issuance.id);
  if (error) throw error;

  await recordStockMovement(issuance.item_id, "return", issuance.quantity, {
    remarks: `Returned by ${issuance.recipient_name}`,
  });
}

export async function lookupItemByCode(schoolId: string, code: string): Promise<InventoryItem | null> {
  const trimmed = code.trim();
  if (!trimmed) return null;

  const { data, error } = await supabase
    .from("inventory_items")
    .select("*, inventory_suppliers(name)")
    .eq("school_id", schoolId)
    .or(`sku.eq.${trimmed},barcode.eq.${trimmed}`)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const qty = Number(data.quantity ?? 0);
  const cost = Number(data.unit_cost ?? 0);
  return {
    ...data,
    quantity: qty,
    unit_cost: cost,
    item_status: deriveItemStatus(qty, data.reorder_level != null ? Number(data.reorder_level) : null, data.item_status),
    is_archived: Boolean(data.is_archived),
    supplier_name: (data.inventory_suppliers as { name?: string } | null)?.name ?? null,
    stock_value: qty * cost,
  };
}

export async function fetchTeacherOptions(schoolId: string) {
  const { data, error } = await supabase
    .from("teachers")
    .select("id, full_name")
    .eq("school_id", schoolId)
    .order("full_name");
  if (error) throw error;
  return (data ?? []).map((t) => ({ id: t.id, name: t.full_name ?? "Teacher" }));
}

export async function fetchClassOptions(schoolId: string) {
  const { data, error } = await supabase
    .from("classes")
    .select("id, name")
    .eq("school_id", schoolId)
    .order("name");
  if (error) throw error;
  return (data ?? []).map((c) => ({ id: c.id, name: c.name }));
}
