export type ItemStockStatus = "available" | "low_stock" | "out_of_stock" | "discontinued";
export type TransactionType = "stock_in" | "stock_out" | "transfer" | "return" | "adjustment";
export type AssetCondition = "excellent" | "good" | "fair" | "damaged";
export type AssetStatus = "active" | "maintenance" | "retired" | "lost";
export type PaymentStatus = "paid" | "partial" | "unpaid";
export type DeliveryStatus = "pending" | "partial" | "delivered" | "cancelled";
export type RecipientType = "student" | "teacher" | "department" | "office";
export type IssuanceStatus = "issued" | "returned" | "overdue";
export type SupplierStatus = "active" | "inactive";

export type InventoryDashboardStats = {
  total_items: number;
  total_assets: number;
  available_stock: number;
  low_stock_items: number;
  out_of_stock_items: number;
  recently_added: number;
  total_inventory_value: number;
  issued_today: number;
  returned_today: number;
  pending_purchase_orders: number;
  damaged_items: number;
  disposed_items: number;
};

export type InventoryItem = {
  id: string;
  school_id: string;
  sku: string | null;
  barcode: string | null;
  name: string;
  category: string | null;
  subcategory: string | null;
  brand: string | null;
  description: string | null;
  quantity: number;
  unit: string | null;
  location: string | null;
  reorder_level: number | null;
  max_stock_level: number | null;
  unit_cost: number;
  supplier_id: string | null;
  item_status: ItemStockStatus;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  supplier_name?: string | null;
  stock_value?: number;
};

export type InventorySupplier = {
  id: string;
  school_id: string;
  name: string;
  company_name: string | null;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  payment_terms: string | null;
  products_supplied: string | null;
  status: SupplierStatus;
  created_at: string;
  updated_at: string;
  purchase_count?: number;
};

export type InventoryAsset = {
  id: string;
  school_id: string;
  asset_code: string;
  name: string;
  category: string | null;
  serial_number: string | null;
  purchase_date: string | null;
  purchase_cost: number;
  current_value: number;
  assigned_department: string | null;
  assigned_staff_id: string | null;
  assigned_class_id: string | null;
  asset_condition: AssetCondition;
  warranty_info: string | null;
  maintenance_schedule: string | null;
  last_maintenance_date: string | null;
  next_maintenance_date: string | null;
  asset_status: AssetStatus;
  barcode: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  staff_name?: string | null;
  class_name?: string | null;
};

export type StockMovement = {
  id: string;
  school_id: string;
  item_id: string;
  transaction_type: TransactionType;
  quantity: number;
  previous_stock: number;
  current_stock: number;
  source_destination: string | null;
  department: string | null;
  requested_by: string | null;
  approved_by: string | null;
  remarks: string | null;
  created_at: string;
  item_name?: string;
  item_sku?: string | null;
};

export type PurchaseOrderLine = {
  id: string;
  purchase_order_id: string;
  item_id: string | null;
  item_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
};

export type PurchaseOrder = {
  id: string;
  school_id: string;
  po_number: string;
  supplier_id: string | null;
  purchase_date: string;
  expected_delivery_date: string | null;
  total_cost: number;
  payment_status: PaymentStatus;
  delivery_status: DeliveryStatus;
  invoice_number: string | null;
  receipt_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  supplier_name?: string | null;
  lines?: PurchaseOrderLine[];
};

export type InventoryIssuance = {
  id: string;
  school_id: string;
  item_id: string;
  recipient_type: RecipientType;
  recipient_name: string;
  recipient_ref: string | null;
  class_or_department: string | null;
  quantity: number;
  issue_date: string;
  return_date: string | null;
  expected_return_date: string | null;
  issued_by: string | null;
  approved_by: string | null;
  status: IssuanceStatus;
  remarks: string | null;
  created_at: string;
  updated_at: string;
  item_name?: string;
  item_sku?: string | null;
};

export type InventoryFilters = {
  search: string;
  category: string;
  supplierId: string;
  department: string;
  stockStatus: string;
  assetStatus: string;
  dateFrom: string;
  dateTo: string;
};
