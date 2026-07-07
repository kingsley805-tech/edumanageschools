-- Inventory Management: full enterprise module
-- Run after apply-operations-modules.sql

-- ---------------------------------------------------------------------------
-- Extend inventory_items
-- ---------------------------------------------------------------------------
ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS barcode text,
  ADD COLUMN IF NOT EXISTS subcategory text,
  ADD COLUMN IF NOT EXISTS brand text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS max_stock_level numeric(12,2),
  ADD COLUMN IF NOT EXISTS unit_cost numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS supplier_id uuid,
  ADD COLUMN IF NOT EXISTS item_status text NOT NULL DEFAULT 'available',
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_inventory_items_sku ON public.inventory_items(school_id, sku);
CREATE INDEX IF NOT EXISTS idx_inventory_items_barcode ON public.inventory_items(school_id, barcode);

-- ---------------------------------------------------------------------------
-- Suppliers
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inventory_suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  company_name text,
  contact_person text,
  phone text,
  email text,
  address text,
  payment_terms text,
  products_supplied text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, name)
);

CREATE INDEX IF NOT EXISTS idx_inventory_suppliers_school ON public.inventory_suppliers(school_id);

-- FK supplier on items (after suppliers table exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'inventory_items_supplier_id_fkey'
  ) THEN
    ALTER TABLE public.inventory_items
      ADD CONSTRAINT inventory_items_supplier_id_fkey
      FOREIGN KEY (supplier_id) REFERENCES public.inventory_suppliers(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Assets
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inventory_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  asset_code text NOT NULL,
  name text NOT NULL,
  category text,
  serial_number text,
  purchase_date date,
  purchase_cost numeric(12,2) NOT NULL DEFAULT 0,
  current_value numeric(12,2) NOT NULL DEFAULT 0,
  assigned_department text,
  assigned_staff_id uuid REFERENCES public.teachers(id) ON DELETE SET NULL,
  assigned_class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  asset_condition text NOT NULL DEFAULT 'good' CHECK (asset_condition IN ('excellent', 'good', 'fair', 'damaged')),
  warranty_info text,
  maintenance_schedule text,
  last_maintenance_date date,
  next_maintenance_date date,
  asset_status text NOT NULL DEFAULT 'active' CHECK (asset_status IN ('active', 'maintenance', 'retired', 'lost')),
  barcode text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, asset_code)
);

CREATE INDEX IF NOT EXISTS idx_inventory_assets_school ON public.inventory_assets(school_id);

-- ---------------------------------------------------------------------------
-- Stock movements
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inventory_stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  transaction_type text NOT NULL CHECK (transaction_type IN ('stock_in', 'stock_out', 'transfer', 'return', 'adjustment')),
  quantity numeric(12,2) NOT NULL,
  previous_stock numeric(12,2) NOT NULL DEFAULT 0,
  current_stock numeric(12,2) NOT NULL DEFAULT 0,
  source_destination text,
  department text,
  requested_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_school ON public.inventory_stock_movements(school_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_item ON public.inventory_stock_movements(item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_date ON public.inventory_stock_movements(created_at);

-- ---------------------------------------------------------------------------
-- Purchase orders
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inventory_purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  po_number text NOT NULL,
  supplier_id uuid REFERENCES public.inventory_suppliers(id) ON DELETE SET NULL,
  purchase_date date NOT NULL DEFAULT CURRENT_DATE,
  expected_delivery_date date,
  total_cost numeric(12,2) NOT NULL DEFAULT 0,
  payment_status text NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('paid', 'partial', 'unpaid')),
  delivery_status text NOT NULL DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'partial', 'delivered', 'cancelled')),
  invoice_number text,
  receipt_url text,
  notes text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, po_number)
);

CREATE TABLE IF NOT EXISTS public.inventory_purchase_order_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  purchase_order_id uuid NOT NULL REFERENCES public.inventory_purchase_orders(id) ON DELETE CASCADE,
  item_id uuid REFERENCES public.inventory_items(id) ON DELETE SET NULL,
  item_name text NOT NULL,
  quantity numeric(12,2) NOT NULL DEFAULT 1,
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  line_total numeric(12,2) NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_inventory_po_school ON public.inventory_purchase_orders(school_id);

-- ---------------------------------------------------------------------------
-- Issuance & returns
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inventory_issuances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  recipient_type text NOT NULL CHECK (recipient_type IN ('student', 'teacher', 'department', 'office')),
  recipient_name text NOT NULL,
  recipient_ref text,
  class_or_department text,
  quantity numeric(12,2) NOT NULL,
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  return_date date,
  expected_return_date date,
  issued_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'issued' CHECK (status IN ('issued', 'returned', 'overdue')),
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_issuances_school ON public.inventory_issuances(school_id);
CREATE INDEX IF NOT EXISTS idx_inventory_issuances_item ON public.inventory_issuances(item_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.inventory_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_purchase_order_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_issuances ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'inventory_suppliers', 'inventory_assets', 'inventory_stock_movements',
    'inventory_purchase_orders', 'inventory_purchase_order_lines', 'inventory_issuances'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_school_rw ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_school_rw ON public.%I FOR ALL USING (
        school_id = public.get_user_school_id(auth.uid())
        OR public.has_role(auth.uid(), ''super_admin''::app_role)
      ) WITH CHECK (
        school_id = public.get_user_school_id(auth.uid())
        OR public.has_role(auth.uid(), ''super_admin''::app_role)
      )',
      t, t
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.inventory_item_stock_status(
  p_quantity numeric,
  p_reorder numeric
)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_quantity <= 0 THEN 'out_of_stock'
    WHEN p_reorder IS NOT NULL AND p_quantity <= p_reorder THEN 'low_stock'
    ELSE 'available'
  END;
$$;

CREATE OR REPLACE FUNCTION public.record_inventory_stock_movement(
  p_item_id uuid,
  p_transaction_type text,
  p_quantity numeric,
  p_source_destination text DEFAULT NULL,
  p_department text DEFAULT NULL,
  p_remarks text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item public.inventory_items%ROWTYPE;
  v_prev numeric;
  v_new numeric;
  v_delta numeric;
BEGIN
  SELECT * INTO v_item FROM public.inventory_items WHERE id = p_item_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Item not found');
  END IF;

  IF NOT (
    public.is_platform_super_admin()
    OR (v_item.school_id = public.get_user_school_id(auth.uid())
        AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'accountant'::app_role)))
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Forbidden');
  END IF;

  v_prev := v_item.quantity;
  v_delta := abs(p_quantity);

  v_new := CASE p_transaction_type
    WHEN 'stock_in' THEN v_prev + v_delta
    WHEN 'return' THEN v_prev + v_delta
    WHEN 'stock_out' THEN greatest(v_prev - v_delta, 0)
    WHEN 'transfer' THEN greatest(v_prev - v_delta, 0)
    WHEN 'adjustment' THEN p_quantity
    ELSE v_prev
  END;

  UPDATE public.inventory_items
  SET
    quantity = v_new,
    item_status = public.inventory_item_stock_status(v_new, reorder_level),
    updated_at = now()
  WHERE id = p_item_id;

  INSERT INTO public.inventory_stock_movements (
    school_id, item_id, transaction_type, quantity,
    previous_stock, current_stock, source_destination, department,
    requested_by, approved_by, remarks
  ) VALUES (
    v_item.school_id, p_item_id, p_transaction_type, v_delta,
    v_prev, v_new, p_source_destination, p_department,
    auth.uid(), auth.uid(), p_remarks
  );

  RETURN jsonb_build_object('ok', true, 'previous_stock', v_prev, 'current_stock', v_new);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_inventory_dashboard_stats(p_school_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := CURRENT_DATE;
BEGIN
  IF NOT (
    public.is_platform_super_admin()
    OR p_school_id = public.get_user_school_id(auth.uid())
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN jsonb_build_object(
    'total_items', (SELECT COUNT(*)::int FROM public.inventory_items WHERE school_id = p_school_id AND NOT is_archived),
    'total_assets', (SELECT COUNT(*)::int FROM public.inventory_assets WHERE school_id = p_school_id AND asset_status != 'retired'),
    'available_stock', (SELECT coalesce(SUM(quantity), 0) FROM public.inventory_items WHERE school_id = p_school_id AND NOT is_archived),
    'low_stock_items', (
      SELECT COUNT(*)::int FROM public.inventory_items
      WHERE school_id = p_school_id AND NOT is_archived
        AND reorder_level IS NOT NULL AND quantity > 0 AND quantity <= reorder_level
    ),
    'out_of_stock_items', (
      SELECT COUNT(*)::int FROM public.inventory_items
      WHERE school_id = p_school_id AND NOT is_archived AND quantity <= 0
    ),
    'recently_added', (
      SELECT COUNT(*)::int FROM public.inventory_items
      WHERE school_id = p_school_id AND created_at >= now() - interval '7 days'
    ),
    'total_inventory_value', (
      SELECT coalesce(SUM(quantity * unit_cost), 0) FROM public.inventory_items
      WHERE school_id = p_school_id AND NOT is_archived
    ),
    'issued_today', (
      SELECT coalesce(SUM(quantity), 0) FROM public.inventory_issuances
      WHERE school_id = p_school_id AND issue_date = v_today AND status = 'issued'
    ),
    'returned_today', (
      SELECT coalesce(SUM(quantity), 0) FROM public.inventory_issuances
      WHERE school_id = p_school_id AND return_date = v_today AND status = 'returned'
    ),
    'pending_purchase_orders', (
      SELECT COUNT(*)::int FROM public.inventory_purchase_orders
      WHERE school_id = p_school_id AND delivery_status IN ('pending', 'partial')
    ),
    'damaged_items', (
      SELECT COUNT(*)::int FROM public.inventory_assets
      WHERE school_id = p_school_id AND asset_condition = 'damaged'
    ),
    'disposed_items', (
      SELECT COUNT(*)::int FROM public.inventory_assets
      WHERE school_id = p_school_id AND asset_status = 'retired'
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_inventory_dashboard_stats(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_inventory_stock_movement(uuid, text, numeric, text, text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
