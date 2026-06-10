-- Run once in Supabase SQL Editor (project: xbhhpjtwawfawifhpxbe)
-- Then: Dashboard -> Settings -> API -> Reload schema



-- ========== supabase/scripts/apply-all-missing-tables.sql ==========

-- =============================================================================
-- ALL MISSING PORTAL TABLES â€” run once in Supabase SQL Editor (or use db push)
-- =============================================================================
-- Preferred:  supabase link --project-ref xbhhpjtwawfawifhpxbe && supabase db push
--
-- This script is idempotent (safe to re-run).
-- After running: Supabase Dashboard â†’ Settings â†’ API â†’ Reload schema
--
-- Also push these migrations if you use CLI (for RBAC seed + family billing):
--   supabase/migrations/20260526120000_rbac_system.sql
--   supabase/migrations/20260527100000_rbac_portal_catalog.sql
--   supabase/migrations/20260528000000_multi_child_consolidated_billing.sql
-- Or run: supabase/scripts/apply-rbac-full.sql
--         supabase/scripts/apply-consolidated-billing.sql
-- =============================================================================

-- ==== BEGIN: 20260528140000_portal_missing_schema.sql ====
-- Portal schema: tables/columns/views referenced by the app but often missing on remote DB.
-- Safe to re-run (IF NOT EXISTS). Apply with: supabase db push
-- Also applies: fee_categories (if 20260528130000 was skipped), billing extensions, academic calendar.

-- =============================================================================
-- Academic calendar (billing / fees UI)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.academic_years (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  start_date date,
  end_date date,
  is_current boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, name)
);

ALTER TABLE public.academic_years ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "school read academic years" ON public.academic_years;
CREATE POLICY "school read academic years" ON public.academic_years
  FOR SELECT USING (
    school_id = public.get_user_school_id(auth.uid())
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

DROP POLICY IF EXISTS "finance manage academic years" ON public.academic_years;
CREATE POLICY "finance manage academic years" ON public.academic_years
  FOR ALL USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'accountant'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  )
  WITH CHECK (
    school_id = public.get_user_school_id(auth.uid())
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

ALTER TABLE public.terms
  ADD COLUMN IF NOT EXISTS academic_year_id uuid REFERENCES public.academic_years(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fees_due_date date;

-- =============================================================================
-- Academic alerts (admin analytics dashboard)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.academic_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id uuid REFERENCES public.students(id) ON DELETE CASCADE,
  alert_type text NOT NULL DEFAULT 'performance',
  status text NOT NULL DEFAULT 'pending',
  message text,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_academic_alerts_school_status ON public.academic_alerts(school_id, status);

ALTER TABLE public.academic_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "school read academic alerts" ON public.academic_alerts;
CREATE POLICY "school read academic alerts" ON public.academic_alerts
  FOR SELECT USING (
    school_id = public.get_user_school_id(auth.uid())
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

DROP POLICY IF EXISTS "staff manage academic alerts" ON public.academic_alerts;
CREATE POLICY "staff manage academic alerts" ON public.academic_alerts
  FOR ALL USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'teacher'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  )
  WITH CHECK (school_id = public.get_user_school_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'::app_role));

-- =============================================================================
-- Billing: enums + core tables (if earlier billing migrations were not pushed)
-- =============================================================================
DO $$ BEGIN
  CREATE TYPE public.billing_invoice_status AS ENUM ('draft', 'sent', 'viewed', 'partially_paid', 'paid', 'overdue', 'void');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.billing_payment_status AS ENUM ('pending', 'processing', 'paid', 'failed', 'refunded', 'disputed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.billing_payment_gateway AS ENUM ('paystack', 'stripe', 'flutterwave', 'manual');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.billing_payment_method AS ENUM ('card', 'mobile_money', 'bank_transfer', 'ussd', 'cash');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.billing_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  invoice_number text NOT NULL,
  student_id uuid REFERENCES public.students(id) ON DELETE SET NULL,
  issued_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status public.billing_invoice_status NOT NULL DEFAULT 'draft',
  currency text NOT NULL DEFAULT 'GHS',
  total_amount numeric(12,2) NOT NULL DEFAULT 0,
  amount_paid numeric(12,2) NOT NULL DEFAULT 0,
  balance_due numeric(12,2),
  due_date date NOT NULL DEFAULT CURRENT_DATE,
  sent_at timestamptz,
  paid_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, invoice_number)
);

ALTER TABLE public.billing_invoices
  ADD COLUMN IF NOT EXISTS term_id uuid REFERENCES public.terms(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS subtotal numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_amount numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount numeric(12,2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.billing_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES public.billing_invoices(id) ON DELETE RESTRICT,
  gateway public.billing_payment_gateway NOT NULL DEFAULT 'manual',
  gateway_ref text,
  method public.billing_payment_method NOT NULL DEFAULT 'cash',
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'GHS',
  status public.billing_payment_status NOT NULL DEFAULT 'pending',
  paid_at timestamptz,
  payer_name text,
  payer_role text,
  payment_context text NOT NULL DEFAULT 'fees',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.billing_payments
  ADD COLUMN IF NOT EXISTS paystack_transaction_id text;

CREATE TABLE IF NOT EXISTS public.billing_invoice_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.billing_invoices(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity numeric(10,2) NOT NULL DEFAULT 1,
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  fee_item_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_invoices_school_status ON public.billing_invoices(school_id, status);
CREATE INDEX IF NOT EXISTS idx_billing_payments_school_status ON public.billing_payments(school_id, status);
CREATE INDEX IF NOT EXISTS idx_billing_invoice_line_items_invoice ON public.billing_invoice_line_items(invoice_id);

ALTER TABLE public.billing_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_invoice_line_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "school members read billing invoices" ON public.billing_invoices;
CREATE POLICY "school members read billing invoices" ON public.billing_invoices
  FOR SELECT USING (school_id = public.get_user_school_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "admins manage billing invoices" ON public.billing_invoices;
CREATE POLICY "admins manage billing invoices" ON public.billing_invoices
  FOR ALL USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'accountant'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  )
  WITH CHECK (school_id = public.get_user_school_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "school members read billing payments" ON public.billing_payments;
CREATE POLICY "school members read billing payments" ON public.billing_payments
  FOR SELECT USING (school_id = public.get_user_school_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "admins manage billing payments" ON public.billing_payments;
CREATE POLICY "admins manage billing payments" ON public.billing_payments
  FOR ALL USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'accountant'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  )
  WITH CHECK (school_id = public.get_user_school_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "school read billing line items" ON public.billing_invoice_line_items;
CREATE POLICY "school read billing line items" ON public.billing_invoice_line_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.billing_invoices i
      WHERE i.id = invoice_id
        AND (i.school_id = public.get_user_school_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'::app_role))
    )
  );

DROP POLICY IF EXISTS "finance manage billing line items" ON public.billing_invoice_line_items;
CREATE POLICY "finance manage billing line items" ON public.billing_invoice_line_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.billing_invoices i
      WHERE i.id = invoice_id
        AND (
          public.has_role(auth.uid(), 'admin'::app_role)
          OR public.has_role(auth.uid(), 'accountant'::app_role)
          OR public.has_role(auth.uid(), 'super_admin'::app_role)
        )
    )
  );

-- =============================================================================
-- Invoice clients (bulk / new invoice dialogs)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  client_type text NOT NULL DEFAULT 'school',
  email text,
  phone text,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clients_school ON public.clients(school_id);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "school read clients" ON public.clients;
CREATE POLICY "school read clients" ON public.clients
  FOR SELECT USING (
    school_id = public.get_user_school_id(auth.uid())
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

DROP POLICY IF EXISTS "finance manage clients" ON public.clients;
CREATE POLICY "finance manage clients" ON public.clients
  FOR ALL USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'accountant'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  )
  WITH CHECK (school_id = public.get_user_school_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'::app_role));

ALTER TABLE public.billing_invoices
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;

-- =============================================================================
-- Paystack webhook log
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.paystack_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE,
  event_type text,
  reference text,
  status text NOT NULL DEFAULT 'pending',
  attempts int NOT NULL DEFAULT 0,
  last_error text,
  next_retry_at timestamptz,
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_paystack_webhook_school ON public.paystack_webhook_events(school_id, created_at DESC);

ALTER TABLE public.paystack_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "finance read paystack webhooks" ON public.paystack_webhook_events;
CREATE POLICY "finance read paystack webhooks" ON public.paystack_webhook_events
  FOR SELECT USING (
    school_id = public.get_user_school_id(auth.uid())
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

DROP POLICY IF EXISTS "service manage paystack webhooks" ON public.paystack_webhook_events;
CREATE POLICY "service manage paystack webhooks" ON public.paystack_webhook_events
  FOR ALL USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'accountant'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  )
  WITH CHECK (true);

-- =============================================================================
-- Fee categories + items (billing fees page)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.fee_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  is_optional boolean NOT NULL DEFAULT false,
  code text,
  default_priority smallint NOT NULL DEFAULT 5,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, name)
);

ALTER TABLE public.fee_categories
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_optional boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS code text,
  ADD COLUMN IF NOT EXISTS default_priority smallint NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.fee_categories
SET code = upper(regexp_replace(name, '[^a-zA-Z0-9]+', '_', 'g'))
WHERE code IS NULL;

ALTER TABLE public.fee_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "school read fee categories" ON public.fee_categories;
CREATE POLICY "school read fee categories" ON public.fee_categories
  FOR SELECT USING (
    school_id = public.get_user_school_id(auth.uid())
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

DROP POLICY IF EXISTS "finance manage fee categories" ON public.fee_categories;
CREATE POLICY "finance manage fee categories" ON public.fee_categories
  FOR ALL USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'accountant'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  )
  WITH CHECK (school_id = public.get_user_school_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE TABLE IF NOT EXISTS public.fee_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.fee_categories(id) ON DELETE CASCADE,
  term_id uuid NOT NULL REFERENCES public.terms(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'GHS',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fee_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "school read fee items" ON public.fee_items;
CREATE POLICY "school read fee items" ON public.fee_items
  FOR SELECT USING (
    school_id = public.get_user_school_id(auth.uid())
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

DROP POLICY IF EXISTS "finance manage fee items" ON public.fee_items;
CREATE POLICY "finance manage fee items" ON public.fee_items
  FOR ALL USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'accountant'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  )
  WITH CHECK (school_id = public.get_user_school_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE TABLE IF NOT EXISTS public.fee_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  fee_item_id uuid NOT NULL REFERENCES public.fee_items(id) ON DELETE CASCADE,
  class_id uuid REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id uuid REFERENCES public.students(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fee_assignments_target_check CHECK (
    (class_id IS NOT NULL AND student_id IS NULL)
    OR (class_id IS NULL AND student_id IS NOT NULL)
  )
);

ALTER TABLE public.fee_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "school read fee assignments" ON public.fee_assignments;
CREATE POLICY "school read fee assignments" ON public.fee_assignments
  FOR SELECT USING (
    school_id = public.get_user_school_id(auth.uid())
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

DROP POLICY IF EXISTS "finance manage fee assignments" ON public.fee_assignments;
CREATE POLICY "finance manage fee assignments" ON public.fee_assignments
  FOR ALL USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'accountant'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  )
  WITH CHECK (school_id = public.get_user_school_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'::app_role));

-- =============================================================================
-- RBAC tables (permissions / roles â€” staff portal access)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module text NOT NULL,
  action text NOT NULL,
  code text NOT NULL UNIQUE,
  description text,
  category text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (module, action)
);

ALTER TABLE public.permissions ADD COLUMN IF NOT EXISTS category text;

CREATE TABLE IF NOT EXISTS public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE,
  slug text NOT NULL,
  name text NOT NULL,
  description text,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, slug)
);

CREATE TABLE IF NOT EXISTS public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS public.user_role_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role_id, school_id)
);

CREATE TABLE IF NOT EXISTS public.permission_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action_type text NOT NULL,
  role_id uuid REFERENCES public.roles(id) ON DELETE SET NULL,
  target_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  permission_code text,
  details jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_role_assignments_user ON public.user_role_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_permission_logs_school ON public.permission_logs(school_id, created_at DESC);

ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_role_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permission_logs ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- Report / billing compatibility columns & views
-- =============================================================================
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS stream text;

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text;

UPDATE public.students s
SET
  first_name = COALESCE(s.first_name, split_part(COALESCE(s.full_name, p.full_name, ''), ' ', 1)),
  last_name = COALESCE(
    s.last_name,
    nullif(trim(substring(COALESCE(s.full_name, p.full_name, '') from position(' ' in COALESCE(s.full_name, p.full_name, ' ') || ' ') + 1)), '')
  )
FROM public.profiles p
WHERE p.id = s.user_id
  AND (s.first_name IS NULL OR s.last_name IS NULL);

CREATE OR REPLACE VIEW public.school_classes AS
SELECT id, school_id, name, level, stream FROM public.classes;

GRANT SELECT ON public.school_classes TO authenticated;

CREATE OR REPLACE VIEW public.parent_students AS
SELECT
  psl.id,
  p.user_id AS parent_id,
  psl.student_id,
  NULL::text AS relationship
FROM public.parent_student_links psl
JOIN public.parents p ON p.id = psl.parent_id;

GRANT SELECT ON public.parent_students TO authenticated;

-- =============================================================================
-- Seed + billing RPC helpers
-- =============================================================================
CREATE OR REPLACE FUNCTION public.seed_billing_fee_categories(p_school_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.fee_categories (school_id, code, name, default_priority, description, sort_order, is_optional)
  VALUES
    (p_school_id, 'TUITION', 'Tuition', 1, 'Core tuition fees', 0, false),
    (p_school_id, 'PTA', 'PTA Levy', 2, 'Parent-teacher association', 1, false),
    (p_school_id, 'BOOKS', 'Books & Materials', 3, 'Learning materials', 2, false),
    (p_school_id, 'TRANSPORT', 'Transport', 4, 'School transport', 3, true),
    (p_school_id, 'OTHER', 'Other Fees', 5, 'Miscellaneous', 4, true)
  ON CONFLICT (school_id, name) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.reverse_billing_sent_invoice(p_invoice_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school uuid;
  v_status text;
  v_paid numeric;
BEGIN
  SELECT school_id, status::text, amount_paid INTO v_school, v_status, v_paid
  FROM public.billing_invoices WHERE id = p_invoice_id;
  IF v_school IS NULL THEN RAISE EXCEPTION 'Invoice not found'; END IF;
  IF NOT (
    public.is_school_admin(auth.uid(), v_school)
    OR public.has_role(auth.uid(), 'accountant'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF v_status NOT IN ('sent', 'viewed') OR COALESCE(v_paid, 0) > 0 THEN
    RAISE EXCEPTION 'Only sent/viewed invoices with no payments can be reversed';
  END IF;
  UPDATE public.billing_invoices SET status = 'draft', sent_at = NULL, updated_at = now()
  WHERE id = p_invoice_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reassign_billing_invoice(
  p_invoice_id uuid,
  p_student_id uuid,
  p_term_id uuid DEFAULT NULL,
  p_due_date date DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school uuid;
  v_paid numeric;
  v_status text;
BEGIN
  SELECT school_id, amount_paid, status::text INTO v_school, v_paid, v_status
  FROM public.billing_invoices WHERE id = p_invoice_id;
  IF v_school IS NULL THEN RAISE EXCEPTION 'Invoice not found'; END IF;
  IF NOT (
    public.is_school_admin(auth.uid(), v_school)
    OR public.has_role(auth.uid(), 'accountant'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF COALESCE(v_paid, 0) > 0 OR v_status IN ('paid', 'void', 'partially_paid') THEN
    RAISE EXCEPTION 'Cannot reassign paid or void invoices';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.students s WHERE s.id = p_student_id AND s.school_id = v_school) THEN
    RAISE EXCEPTION 'Student not in this school';
  END IF;
  UPDATE public.billing_invoices
  SET
    student_id = p_student_id,
    term_id = COALESCE(p_term_id, term_id),
    due_date = COALESCE(p_due_date, due_date),
    updated_at = now()
  WHERE id = p_invoice_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.seed_billing_fee_categories(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reverse_billing_sent_invoice(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reassign_billing_invoice(uuid, uuid, uuid, date) TO authenticated;

NOTIFY pgrst, 'reload schema';


-- ========== supabase/scripts/apply-consolidated-billing.sql ==========

-- =============================================================================
-- Multi-Child Consolidated Billing â€” run once in Supabase SQL Editor
-- Dashboard â†’ SQL â†’ New query â†’ paste this file â†’ Run
-- Safe to re-run: uses IF NOT EXISTS / DROP POLICY IF EXISTS throughout.
-- =============================================================================
-- Multi-Child Consolidated Billing Engine
-- Family ledger: billing_accounts -> account_invoices -> account_invoice_items
-- Payment waterfall via allocate_account_payment()

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.billing_account_status AS ENUM ('active', 'suspended', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.fee_scope AS ENUM ('global', 'grade', 'student');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.account_invoice_status AS ENUM (
    'draft', 'issued', 'partially_paid', 'paid', 'void', 'overdue'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.account_payment_status AS ENUM (
    'pending', 'completed', 'failed', 'refunded'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.billing_job_status AS ENUM ('queued', 'running', 'completed', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- Extend fee_categories (priority for payment waterfall)
-- ---------------------------------------------------------------------------
ALTER TABLE public.fee_categories
  ADD COLUMN IF NOT EXISTS code text,
  ADD COLUMN IF NOT EXISTS default_priority smallint NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

UPDATE public.fee_categories
SET code = upper(regexp_replace(name, '[^a-zA-Z0-9]+', '_', 'g'))
WHERE code IS NULL;

-- ---------------------------------------------------------------------------
-- Billing accounts (family ledger)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.billing_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  account_no text NOT NULL,
  primary_parent_id uuid NOT NULL REFERENCES public.parents(id),
  display_name text,
  status public.billing_account_status NOT NULL DEFAULT 'active',
  balance_due numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'GHS',
  payment_method_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, account_no)
);

CREATE INDEX IF NOT EXISTS idx_billing_accounts_school ON public.billing_accounts(school_id);
CREATE INDEX IF NOT EXISTS idx_billing_accounts_parent ON public.billing_accounts(primary_parent_id);

CREATE TABLE IF NOT EXISTS public.billing_account_students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_account_id uuid NOT NULL REFERENCES public.billing_accounts(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  is_primary boolean NOT NULL DEFAULT true,
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_to date,
  UNIQUE (billing_account_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_bas_student ON public.billing_account_students(student_id);
CREATE INDEX IF NOT EXISTS idx_bas_account ON public.billing_account_students(billing_account_id);

-- ---------------------------------------------------------------------------
-- Fee templates (global / grade / student scope)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fee_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  fee_category_id uuid NOT NULL REFERENCES public.fee_categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  scope public.fee_scope NOT NULL,
  class_id uuid REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id uuid REFERENCES public.students(id) ON DELETE CASCADE,
  academic_term text NOT NULL,
  term_id uuid REFERENCES public.terms(id) ON DELETE SET NULL,
  due_day_of_month smallint,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fee_templates_scope_check CHECK (
    (scope = 'global' AND class_id IS NULL AND student_id IS NULL)
    OR (scope = 'grade' AND class_id IS NOT NULL AND student_id IS NULL)
    OR (scope = 'student' AND student_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_fee_templates_school_term ON public.fee_templates(school_id, academic_term);
CREATE INDEX IF NOT EXISTS idx_fee_templates_class ON public.fee_templates(class_id) WHERE class_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fee_templates_student ON public.fee_templates(student_id) WHERE student_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Consolidated invoices (per family account)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.account_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  billing_account_id uuid NOT NULL REFERENCES public.billing_accounts(id) ON DELETE CASCADE,
  invoice_no text NOT NULL,
  academic_term text NOT NULL,
  term_id uuid REFERENCES public.terms(id) ON DELETE SET NULL,
  total_amount numeric(12,2) NOT NULL DEFAULT 0,
  total_paid numeric(12,2) NOT NULL DEFAULT 0,
  status public.account_invoice_status NOT NULL DEFAULT 'draft',
  due_date date NOT NULL,
  issued_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, invoice_no)
);

CREATE INDEX IF NOT EXISTS idx_account_invoices_account ON public.account_invoices(billing_account_id);
CREATE INDEX IF NOT EXISTS idx_account_invoices_school_term ON public.account_invoices(school_id, academic_term);

CREATE TABLE IF NOT EXISTS public.account_invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.account_invoices(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  fee_category_id uuid NOT NULL REFERENCES public.fee_categories(id),
  fee_template_id uuid REFERENCES public.fee_templates(id) ON DELETE SET NULL,
  description text,
  amount numeric(12,2) NOT NULL,
  amount_paid numeric(12,2) NOT NULL DEFAULT 0,
  due_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (invoice_id, student_id, fee_category_id, fee_template_id)
);

CREATE INDEX IF NOT EXISTS idx_account_invoice_items_invoice ON public.account_invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_account_invoice_items_student ON public.account_invoice_items(student_id);

-- ---------------------------------------------------------------------------
-- Payments + allocations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.account_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  billing_account_id uuid NOT NULL REFERENCES public.billing_accounts(id),
  invoice_id uuid REFERENCES public.account_invoices(id) ON DELETE SET NULL,
  payer_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  unallocated_amount numeric(12,2) NOT NULL DEFAULT 0,
  payment_provider text,
  provider_reference text,
  status public.account_payment_status NOT NULL DEFAULT 'pending',
  allocation_mode text NOT NULL DEFAULT 'auto' CHECK (allocation_mode IN ('auto', 'manual')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_account_payments_account ON public.account_payments(billing_account_id);
CREATE INDEX IF NOT EXISTS idx_account_payments_invoice ON public.account_payments(invoice_id);

CREATE TABLE IF NOT EXISTS public.payment_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES public.account_payments(id) ON DELETE CASCADE,
  invoice_item_id uuid NOT NULL REFERENCES public.account_invoice_items(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  allocated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_allocations_payment ON public.payment_allocations(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_item ON public.payment_allocations(invoice_item_id);

-- ---------------------------------------------------------------------------
-- Allocation rules + audit + jobs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.billing_allocation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  rule_order smallint NOT NULL,
  rule_type text NOT NULL CHECK (rule_type IN ('overdue_first', 'category_priority', 'proportional')),
  is_enabled boolean NOT NULL DEFAULT true,
  UNIQUE (school_id, rule_order)
);

CREATE TABLE IF NOT EXISTS public.financial_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  action text NOT NULL,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  old_balance numeric(12,2),
  new_balance numeric(12,2),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_financial_audit_school ON public.financial_audit_log(school_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.billing_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  job_type text NOT NULL DEFAULT 'generate_term_invoices',
  academic_term text NOT NULL,
  term_id uuid REFERENCES public.terms(id) ON DELETE SET NULL,
  status public.billing_job_status NOT NULL DEFAULT 'queued',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  progress jsonb NOT NULL DEFAULT '{"processed":0,"total":0,"invoices_created":0}'::jsonb,
  error_message text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_jobs_school_status ON public.billing_jobs(school_id, status);

-- Immutable audit log
DROP RULE IF EXISTS financial_audit_log_no_update ON public.financial_audit_log;
CREATE RULE financial_audit_log_no_update AS ON UPDATE TO public.financial_audit_log DO INSTEAD NOTHING;
DROP RULE IF EXISTS financial_audit_log_no_delete ON public.financial_audit_log;
CREATE RULE financial_audit_log_no_delete AS ON DELETE TO public.financial_audit_log DO INSTEAD NOTHING;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.write_financial_audit_log(
  p_school_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_action text,
  p_actor_user_id uuid,
  p_old_balance numeric,
  p_new_balance numeric,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.financial_audit_log (
    school_id, entity_type, entity_id, action, actor_user_id,
    old_balance, new_balance, metadata
  ) VALUES (
    p_school_id, p_entity_type, p_entity_id, p_action, p_actor_user_id,
    p_old_balance, p_new_balance, COALESCE(p_metadata, '{}'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_account_invoice_totals(p_invoice_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total numeric(12,2);
  v_paid numeric(12,2);
  v_due date;
  v_status public.account_invoice_status;
BEGIN
  SELECT COALESCE(SUM(amount), 0), COALESCE(SUM(amount_paid), 0)
  INTO v_total, v_paid
  FROM public.account_invoice_items WHERE invoice_id = p_invoice_id;

  SELECT due_date, status INTO v_due, v_status
  FROM public.account_invoices WHERE id = p_invoice_id;

  IF v_status = 'void' THEN RETURN; END IF;

  IF v_paid >= v_total AND v_total > 0 THEN
    v_status := 'paid';
  ELSIF v_paid > 0 THEN
    v_status := 'partially_paid';
  ELSIF v_due < CURRENT_DATE AND v_total > v_paid THEN
    v_status := 'overdue';
  ELSIF v_status IN ('paid', 'partially_paid', 'overdue') AND v_paid = 0 THEN
    v_status := 'issued';
  END IF;

  UPDATE public.account_invoices
  SET total_amount = v_total, total_paid = v_paid, status = v_status, updated_at = now()
  WHERE id = p_invoice_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_billing_account_balance(p_billing_account_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance numeric(12,2);
  v_school_id uuid;
BEGIN
  SELECT ba.school_id INTO v_school_id FROM public.billing_accounts ba WHERE ba.id = p_billing_account_id;

  SELECT COALESCE(SUM(ii.amount - ii.amount_paid), 0)
  INTO v_balance
  FROM public.account_invoice_items ii
  JOIN public.account_invoices i ON i.id = ii.invoice_id
  WHERE i.billing_account_id = p_billing_account_id
    AND i.status NOT IN ('void', 'draft');

  UPDATE public.billing_accounts
  SET balance_due = v_balance, updated_at = now()
  WHERE id = p_billing_account_id;
END;
$$;

CREATE OR REPLACE FUNCTION public._apply_allocation_to_item(
  p_payment_id uuid,
  p_invoice_item_id uuid,
  p_amount numeric,
  p_actor_user_id uuid,
  p_school_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_paid numeric(12,2);
  v_new_paid numeric(12,2);
  v_invoice_id uuid;
BEGIN
  IF p_amount <= 0 THEN RETURN; END IF;

  SELECT amount_paid, invoice_id INTO v_old_paid, v_invoice_id
  FROM public.account_invoice_items
  WHERE id = p_invoice_item_id
  FOR UPDATE;

  v_new_paid := v_old_paid + p_amount;

  IF v_new_paid > (SELECT amount FROM public.account_invoice_items WHERE id = p_invoice_item_id) + 0.01 THEN
    RAISE EXCEPTION 'Allocation exceeds line item amount';
  END IF;

  INSERT INTO public.payment_allocations (payment_id, invoice_item_id, amount, allocated_by)
  VALUES (p_payment_id, p_invoice_item_id, p_amount, p_actor_user_id);

  UPDATE public.account_invoice_items
  SET amount_paid = v_new_paid
  WHERE id = p_invoice_item_id;

  PERFORM public.write_financial_audit_log(
    p_school_id, 'account_invoice_item', p_invoice_item_id,
    'payment_allocated', p_actor_user_id, v_old_paid, v_new_paid,
    jsonb_build_object('payment_id', p_payment_id, 'amount', p_amount)
  );

  PERFORM public.refresh_account_invoice_totals(v_invoice_id);
END;
$$;

-- Payment allocation: overdue -> category priority -> proportional
CREATE OR REPLACE FUNCTION public.allocate_account_payment(
  p_payment_id uuid,
  p_manual_allocations jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment record;
  v_remaining numeric(12,2);
  v_item record;
  v_apply numeric(12,2);
  v_results jsonb := '[]'::jsonb;
  v_total_outstanding numeric(12,2);
  v_alloc record;
  v_manual_sum numeric(12,2);
BEGIN
  SELECT * INTO v_payment FROM public.account_payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment not found'; END IF;
  IF v_payment.status <> 'completed' THEN
    RAISE EXCEPTION 'Payment must be completed before allocation';
  END IF;

  v_remaining := v_payment.amount;

  -- Manual allocation path
  IF p_manual_allocations IS NOT NULL AND jsonb_array_length(p_manual_allocations) > 0 THEN
    SELECT COALESCE(SUM((elem->>'amount')::numeric), 0) INTO v_manual_sum
    FROM jsonb_array_elements(p_manual_allocations) AS elem;

    IF abs(v_manual_sum - v_payment.amount) > 0.02 THEN
      RAISE EXCEPTION 'Manual allocations must sum to payment amount (got %, expected %)', v_manual_sum, v_payment.amount;
    END IF;

    FOR v_alloc IN
      SELECT (elem->>'invoice_item_id')::uuid AS item_id, (elem->>'amount')::numeric AS amt
      FROM jsonb_array_elements(p_manual_allocations) AS elem
    LOOP
      PERFORM public._apply_allocation_to_item(
        p_payment_id, v_alloc.item_id, v_alloc.amt, auth.uid(), v_payment.school_id
      );
      v_results := v_results || jsonb_build_array(
        jsonb_build_object('invoice_item_id', v_alloc.item_id, 'amount', v_alloc.amt, 'mode', 'manual')
      );
    END LOOP;

    UPDATE public.account_payments SET unallocated_amount = 0, allocation_mode = 'manual' WHERE id = p_payment_id;
    PERFORM public.refresh_billing_account_balance(v_payment.billing_account_id);
    RETURN jsonb_build_object('allocations', v_results, 'unallocated', 0);
  END IF;

  -- PASS 1: Overdue (oldest due_date first)
  FOR v_item IN
    SELECT ii.id, ii.amount, ii.amount_paid, ii.due_date
    FROM public.account_invoice_items ii
    JOIN public.account_invoices i ON i.id = ii.invoice_id
    WHERE i.billing_account_id = v_payment.billing_account_id
      AND i.status NOT IN ('void', 'draft')
      AND ii.amount > ii.amount_paid
      AND ii.due_date < CURRENT_DATE
    ORDER BY ii.due_date ASC, ii.created_at ASC
    FOR UPDATE OF ii
  LOOP
    EXIT WHEN v_remaining <= 0;
    v_apply := LEAST(v_remaining, v_item.amount - v_item.amount_paid);
    PERFORM public._apply_allocation_to_item(
      p_payment_id, v_item.id, v_apply, NULL, v_payment.school_id
    );
    v_remaining := v_remaining - v_apply;
    v_results := v_results || jsonb_build_array(
      jsonb_build_object('invoice_item_id', v_item.id, 'amount', v_apply, 'pass', 'overdue')
    );
  END LOOP;

  -- PASS 2: Category priority (non-overdue)
  FOR v_item IN
    SELECT ii.id, ii.amount, ii.amount_paid
    FROM public.account_invoice_items ii
    JOIN public.account_invoices i ON i.id = ii.invoice_id
    JOIN public.fee_categories fc ON fc.id = ii.fee_category_id
    WHERE i.billing_account_id = v_payment.billing_account_id
      AND i.status NOT IN ('void', 'draft')
      AND ii.amount > ii.amount_paid
      AND ii.due_date >= CURRENT_DATE
    ORDER BY fc.default_priority ASC, ii.due_date ASC, ii.created_at ASC
    FOR UPDATE OF ii
  LOOP
    EXIT WHEN v_remaining <= 0;
    v_apply := LEAST(v_remaining, v_item.amount - v_item.amount_paid);
    PERFORM public._apply_allocation_to_item(
      p_payment_id, v_item.id, v_apply, NULL, v_payment.school_id
    );
    v_remaining := v_remaining - v_apply;
    v_results := v_results || jsonb_build_array(
      jsonb_build_object('invoice_item_id', v_item.id, 'amount', v_apply, 'pass', 'priority')
    );
  END LOOP;

  -- PASS 3: Proportional split on remaining open items
  IF v_remaining > 0 THEN
    SELECT COALESCE(SUM(ii.amount - ii.amount_paid), 0) INTO v_total_outstanding
    FROM public.account_invoice_items ii
    JOIN public.account_invoices i ON i.id = ii.invoice_id
    WHERE i.billing_account_id = v_payment.billing_account_id
      AND i.status NOT IN ('void', 'draft')
      AND ii.amount > ii.amount_paid;

    IF v_total_outstanding > 0 THEN
      FOR v_item IN
        SELECT ii.id, ii.amount, ii.amount_paid,
          (ii.amount - ii.amount_paid) / v_total_outstanding AS share
        FROM public.account_invoice_items ii
        JOIN public.account_invoices i ON i.id = ii.invoice_id
        WHERE i.billing_account_id = v_payment.billing_account_id
          AND i.status NOT IN ('void', 'draft')
          AND ii.amount > ii.amount_paid
        ORDER BY ii.created_at ASC
        FOR UPDATE OF ii
      LOOP
        EXIT WHEN v_remaining <= 0.01;
        v_apply := LEAST(
          v_remaining,
          ROUND(v_payment.amount * v_item.share, 2),
          v_item.amount - v_item.amount_paid
        );
        IF v_apply > 0 THEN
          PERFORM public._apply_allocation_to_item(
            p_payment_id, v_item.id, v_apply, NULL, v_payment.school_id
          );
          v_remaining := v_remaining - v_apply;
          v_results := v_results || jsonb_build_array(
            jsonb_build_object('invoice_item_id', v_item.id, 'amount', v_apply, 'pass', 'proportional')
          );
        END IF;
      END LOOP;
    END IF;
  END IF;

  UPDATE public.account_payments SET unallocated_amount = GREATEST(v_remaining, 0) WHERE id = p_payment_id;
  PERFORM public.refresh_billing_account_balance(v_payment.billing_account_id);

  RETURN jsonb_build_object('allocations', v_results, 'unallocated', GREATEST(v_remaining, 0));
END;
$$;

-- Record payment and auto-allocate
CREATE OR REPLACE FUNCTION public.record_account_payment(
  p_school_id uuid,
  p_billing_account_id uuid,
  p_invoice_id uuid,
  p_amount numeric,
  p_allocation_mode text DEFAULT 'auto',
  p_manual_allocations jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment_id uuid;
  v_result jsonb;
BEGIN
  IF p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;

  IF NOT (
    public.is_school_admin(auth.uid(), p_school_id)
    OR public.has_role(auth.uid(), 'accountant'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  INSERT INTO public.account_payments (
    school_id, billing_account_id, invoice_id, payer_user_id,
    amount, unallocated_amount, status, allocation_mode
  ) VALUES (
    p_school_id, p_billing_account_id, p_invoice_id, auth.uid(),
    p_amount, p_amount, 'completed', COALESCE(p_allocation_mode, 'auto')
  )
  RETURNING id INTO v_payment_id;

  v_result := public.allocate_account_payment(v_payment_id, p_manual_allocations);

  RETURN jsonb_build_object('payment_id', v_payment_id, 'allocation', v_result);
END;
$$;

-- Backfill billing accounts from guardian_id
CREATE OR REPLACE FUNCTION public.backfill_billing_accounts_for_school(p_school_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_created int := 0;
  v_linked int := 0;
  v_parent record;
  v_account_id uuid;
  v_st record;
BEGIN
  FOR v_parent IN
    SELECT DISTINCT p.id AS parent_id, p.user_id
    FROM public.parents p
    JOIN public.students s ON s.guardian_id = p.id
    WHERE s.school_id = p_school_id AND p.id IS NOT NULL
  LOOP
    SELECT id INTO v_account_id
    FROM public.billing_accounts
    WHERE school_id = p_school_id AND primary_parent_id = v_parent.parent_id
    LIMIT 1;

    IF v_account_id IS NULL THEN
      INSERT INTO public.billing_accounts (
        school_id, account_no, primary_parent_id, display_name, currency
      ) VALUES (
        p_school_id,
        'BA-' || to_char(now(), 'YYYY') || '-' || lpad((floor(random() * 99999))::int::text, 5, '0'),
        v_parent.parent_id,
        (SELECT full_name FROM public.profiles WHERE id = v_parent.user_id),
        'GHS'
      )
      RETURNING id INTO v_account_id;
      v_created := v_created + 1;
    END IF;

    FOR v_st IN
      SELECT s.id FROM public.students s
      WHERE s.school_id = p_school_id AND s.guardian_id = v_parent.parent_id
    LOOP
      INSERT INTO public.billing_account_students (billing_account_id, student_id)
      VALUES (v_account_id, v_st.id)
      ON CONFLICT (billing_account_id, student_id) DO NOTHING;
      v_linked := v_linked + 1;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object('accounts_created', v_created, 'links_ensured', v_linked);
END;
$$;

-- Seed default fee categories with priorities
CREATE OR REPLACE FUNCTION public.seed_billing_fee_categories(p_school_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.fee_categories (school_id, code, name, default_priority, description)
  SELECT p_school_id, v.code, v.name, v.prio, v.description
  FROM (VALUES
    ('TUITION', 'Tuition', 1, 'School tuition fees'),
    ('BOOKS', 'Books', 2, 'Books and learning materials'),
    ('PTA', 'PTA', 3, 'Parent-Teacher Association levy'),
    ('TRANSPORT', 'Bus / Transport', 4, 'Transportation fees')
  ) AS v(code, name, prio, description)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.fee_categories fc
    WHERE fc.school_id = p_school_id AND fc.name = v.name
  );
END;
$$;

-- Resolve billing account for student (create if missing)
CREATE OR REPLACE FUNCTION public.ensure_student_billing_account(
  p_student_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student record;
  v_account_id uuid;
BEGIN
  SELECT s.id, s.school_id, s.guardian_id INTO v_student
  FROM public.students s WHERE s.id = p_student_id;

  IF v_student.id IS NULL THEN RAISE EXCEPTION 'Student not found'; END IF;
  IF v_student.guardian_id IS NULL THEN
    RAISE EXCEPTION 'Student has no guardian; link parent first';
  END IF;

  SELECT bas.billing_account_id INTO v_account_id
  FROM public.billing_account_students bas
  WHERE bas.student_id = p_student_id
  LIMIT 1;

  IF v_account_id IS NOT NULL THEN RETURN v_account_id; END IF;

  SELECT id INTO v_account_id FROM public.billing_accounts
  WHERE school_id = v_student.school_id AND primary_parent_id = v_student.guardian_id
  LIMIT 1;

  IF v_account_id IS NULL THEN
    INSERT INTO public.billing_accounts (
      school_id, account_no, primary_parent_id, currency
    ) VALUES (
      v_student.school_id,
      'BA-' || to_char(now(), 'YYYY') || '-' || lpad((floor(random() * 99999))::int::text, 5, '0'),
      v_student.guardian_id,
      'GHS'
    )
    RETURNING id INTO v_account_id;
  END IF;

  INSERT INTO public.billing_account_students (billing_account_id, student_id)
  VALUES (v_account_id, p_student_id)
  ON CONFLICT (billing_account_id, student_id) DO NOTHING;

  RETURN v_account_id;
END;
$$;

-- Process one chunk of billing job (200 students)
CREATE OR REPLACE FUNCTION public.process_billing_job_chunk(
  p_job_id uuid,
  p_chunk_size int DEFAULT 200
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job record;
  v_processed int := 0;
  v_invoices_created int := 0;
  v_student record;
  v_template record;
  v_account_id uuid;
  v_invoice_id uuid;
  v_due_date date;
  v_line_amount numeric(12,2);
  v_items_by_account jsonb := '{}'::jsonb;
  v_offset int;
  v_total int;
BEGIN
  SELECT * INTO v_job FROM public.billing_jobs WHERE id = p_job_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Job not found'; END IF;
  IF v_job.status = 'completed' THEN
    RETURN v_job.progress;
  END IF;

  IF v_job.status = 'queued' THEN
    UPDATE public.billing_jobs SET status = 'running', started_at = now() WHERE id = p_job_id;
  END IF;

  v_offset := COALESCE((v_job.progress->>'processed')::int, 0);
  v_total := COALESCE((v_job.progress->>'total')::int, 0);

  IF v_total = 0 THEN
    SELECT count(*)::int INTO v_total
    FROM public.students s
    WHERE s.school_id = v_job.school_id
      AND s.guardian_id IS NOT NULL;
    UPDATE public.billing_jobs
    SET progress = jsonb_set(progress, '{total}', to_jsonb(v_total))
    WHERE id = p_job_id;
  END IF;

  v_due_date := COALESCE(
    (SELECT end_date FROM public.terms WHERE id = v_job.term_id),
    (CURRENT_DATE + interval '30 days')::date
  );

  FOR v_student IN
    SELECT s.id, s.class_id, s.guardian_id, s.school_id
    FROM public.students s
    WHERE s.school_id = v_job.school_id
      AND s.guardian_id IS NOT NULL
    ORDER BY s.id
    OFFSET v_offset
    LIMIT p_chunk_size
  LOOP
    v_account_id := public.ensure_student_billing_account(v_student.id);

    -- Find or create draft/issued invoice for this account + term
    SELECT id INTO v_invoice_id
    FROM public.account_invoices
    WHERE billing_account_id = v_account_id
      AND academic_term = v_job.academic_term
      AND status NOT IN ('void', 'paid')
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_invoice_id IS NULL THEN
      INSERT INTO public.account_invoices (
        school_id, billing_account_id, invoice_no, academic_term, term_id,
        due_date, status, issued_at
      ) VALUES (
        v_job.school_id,
        v_account_id,
        'FAM-' || to_char(now(), 'YYYY') || '-' || upper(substr(md5(random()::text), 1, 8)),
        v_job.academic_term,
        v_job.term_id,
        v_due_date,
        'issued',
        now()
      )
      RETURNING id INTO v_invoice_id;
      v_invoices_created := v_invoices_created + 1;
    END IF;

    FOR v_template IN
      SELECT ft.*
      FROM public.fee_templates ft
      WHERE ft.school_id = v_job.school_id
        AND ft.academic_term = v_job.academic_term
        AND ft.is_active = true
        AND (
          ft.scope = 'global'
          OR (ft.scope = 'grade' AND ft.class_id = v_student.class_id)
          OR (ft.scope = 'student' AND ft.student_id = v_student.id)
        )
    LOOP
      INSERT INTO public.account_invoice_items (
        invoice_id, student_id, fee_category_id, fee_template_id,
        description, amount, due_date
      ) VALUES (
        v_invoice_id,
        v_student.id,
        v_template.fee_category_id,
        v_template.id,
        v_template.name,
        v_template.amount,
        v_due_date
      )
      ON CONFLICT (invoice_id, student_id, fee_category_id, fee_template_id) DO NOTHING;
    END LOOP;

    PERFORM public.refresh_account_invoice_totals(v_invoice_id);
    PERFORM public.refresh_billing_account_balance(v_account_id);
    v_processed := v_processed + 1;
  END LOOP;

  UPDATE public.billing_jobs
  SET
    progress = jsonb_build_object(
      'processed', v_offset + v_processed,
      'total', v_total,
      'invoices_created', COALESCE((progress->>'invoices_created')::int, 0) + v_invoices_created
    ),
    status = CASE
      WHEN v_offset + v_processed >= v_total THEN 'completed'::public.billing_job_status
      ELSE 'running'::public.billing_job_status
    END,
    completed_at = CASE WHEN v_offset + v_processed >= v_total THEN now() ELSE NULL END
  WHERE id = p_job_id;

  RETURN (SELECT progress FROM public.billing_jobs WHERE id = p_job_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.create_billing_job(
  p_school_id uuid,
  p_academic_term text,
  p_term_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job_id uuid;
BEGIN
  IF NOT (
    public.is_school_admin(auth.uid(), p_school_id)
    OR public.has_role(auth.uid(), 'accountant'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  INSERT INTO public.billing_jobs (school_id, job_type, academic_term, term_id, created_by, status)
  VALUES (p_school_id, 'generate_term_invoices', p_academic_term, p_term_id, auth.uid(), 'queued')
  RETURNING id INTO v_job_id;

  RETURN v_job_id;
END;
$$;

-- Default allocation rules per school
CREATE OR REPLACE FUNCTION public.seed_billing_allocation_rules(p_school_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.billing_allocation_rules (school_id, rule_order, rule_type) VALUES
    (p_school_id, 1, 'overdue_first'),
    (p_school_id, 2, 'category_priority'),
    (p_school_id, 3, 'proportional')
  ON CONFLICT (school_id, rule_order) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.write_financial_audit_log TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_account_invoice_totals TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_billing_account_balance TO authenticated;
GRANT EXECUTE ON FUNCTION public.allocate_account_payment TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_account_payment TO authenticated;
GRANT EXECUTE ON FUNCTION public.backfill_billing_accounts_for_school TO authenticated;
GRANT EXECUTE ON FUNCTION public.seed_billing_fee_categories TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_student_billing_account TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_billing_job_chunk TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_billing_job TO authenticated;
GRANT EXECUTE ON FUNCTION public.seed_billing_allocation_rules TO authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.billing_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_account_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_allocation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_jobs ENABLE ROW LEVEL SECURITY;

-- Staff read/write by school
DROP POLICY IF EXISTS "staff manage billing accounts" ON public.billing_accounts;
CREATE POLICY "staff manage billing accounts" ON public.billing_accounts FOR ALL TO authenticated
  USING (
    school_id = public.get_user_school_id(auth.uid())
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  )
  WITH CHECK (
    school_id = public.get_user_school_id(auth.uid())
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

DROP POLICY IF EXISTS "staff manage billing account students" ON public.billing_account_students;
CREATE POLICY "staff manage billing account students" ON public.billing_account_students FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.billing_accounts ba
    WHERE ba.id = billing_account_id
      AND (ba.school_id = public.get_user_school_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'::app_role))
  ));

DROP POLICY IF EXISTS "staff manage fee templates" ON public.fee_templates;
CREATE POLICY "staff manage fee templates" ON public.fee_templates FOR ALL TO authenticated
  USING (school_id = public.get_user_school_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (school_id = public.get_user_school_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "staff manage account invoices" ON public.account_invoices;
CREATE POLICY "staff manage account invoices" ON public.account_invoices FOR ALL TO authenticated
  USING (school_id = public.get_user_school_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (school_id = public.get_user_school_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "staff manage account invoice items" ON public.account_invoice_items;
CREATE POLICY "staff manage account invoice items" ON public.account_invoice_items FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.account_invoices i
    WHERE i.id = invoice_id
      AND (i.school_id = public.get_user_school_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'::app_role))
  ));

DROP POLICY IF EXISTS "staff manage account payments" ON public.account_payments;
CREATE POLICY "staff manage account payments" ON public.account_payments FOR ALL TO authenticated
  USING (school_id = public.get_user_school_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (school_id = public.get_user_school_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "staff read payment allocations" ON public.payment_allocations;
CREATE POLICY "staff read payment allocations" ON public.payment_allocations FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.account_payments p
    WHERE p.id = payment_id
      AND (p.school_id = public.get_user_school_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'::app_role))
  ));

DROP POLICY IF EXISTS "staff manage billing jobs" ON public.billing_jobs;
CREATE POLICY "staff manage billing jobs" ON public.billing_jobs FOR ALL TO authenticated
  USING (school_id = public.get_user_school_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (school_id = public.get_user_school_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "staff read financial audit" ON public.financial_audit_log;
CREATE POLICY "staff read financial audit" ON public.financial_audit_log FOR SELECT TO authenticated
  USING (school_id = public.get_user_school_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'::app_role));

-- Parents: view own billing account and related invoices/items
DROP POLICY IF EXISTS "parents read own billing account" ON public.billing_accounts;
CREATE POLICY "parents read own billing account" ON public.billing_accounts FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.parents p
    WHERE p.id = primary_parent_id AND p.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "parents read own account invoices" ON public.account_invoices;
CREATE POLICY "parents read own account invoices" ON public.account_invoices FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.billing_accounts ba
    JOIN public.parents p ON p.id = ba.primary_parent_id
    WHERE ba.id = billing_account_id AND p.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "parents read own invoice items" ON public.account_invoice_items;
CREATE POLICY "parents read own invoice items" ON public.account_invoice_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.account_invoices i
    JOIN public.billing_accounts ba ON ba.id = i.billing_account_id
    JOIN public.parents p ON p.id = ba.primary_parent_id
    WHERE i.id = invoice_id AND p.user_id = auth.uid()
  ));


-- ========== public/sql/apply-lesson-notes.sql ==========

-- Weekly Lesson Notes Management System

DO $$ BEGIN
  CREATE TYPE public.lesson_note_status AS ENUM (
    'draft',
    'pending_review',
    'approved',
    'rejected',
    'needs_correction'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.lesson_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  term_id uuid REFERENCES public.terms(id) ON DELETE SET NULL,
  academic_year_id uuid REFERENCES public.academic_years(id) ON DELETE SET NULL,
  session_label text,
  week_number integer NOT NULL CHECK (week_number >= 1 AND week_number <= 52),
  day_of_week text NOT NULL CHECK (day_of_week IN (
    'monday','tuesday','wednesday','thursday','friday','saturday','sunday'
  )),
  lesson_date date NOT NULL,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE RESTRICT,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE RESTRICT,
  teacher_name text,
  topic text NOT NULL DEFAULT '',
  sub_topic text,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  status public.lesson_note_status NOT NULL DEFAULT 'draft',
  version_number integer NOT NULL DEFAULT 1,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewer_name text,
  admin_feedback text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lesson_notes_school_status ON public.lesson_notes(school_id, status);
CREATE INDEX IF NOT EXISTS idx_lesson_notes_teacher ON public.lesson_notes(teacher_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lesson_notes_term_week ON public.lesson_notes(term_id, week_number, day_of_week);
CREATE INDEX IF NOT EXISTS idx_lesson_notes_class_subject ON public.lesson_notes(class_id, subject_id);

CREATE TABLE IF NOT EXISTS public.lesson_note_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_note_id uuid NOT NULL REFERENCES public.lesson_notes(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  snapshot jsonb NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  submitted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (lesson_note_id, version_number)
);

CREATE TABLE IF NOT EXISTS public.lesson_note_status_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_note_id uuid NOT NULL REFERENCES public.lesson_notes(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  from_status public.lesson_note_status,
  to_status public.lesson_note_status NOT NULL,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_name text,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lesson_note_status_logs_note ON public.lesson_note_status_logs(lesson_note_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.lesson_note_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_note_id uuid NOT NULL REFERENCES public.lesson_notes(id) ON DELETE CASCADE,
  author_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_name text,
  author_role text,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lesson_note_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_note_id uuid NOT NULL REFERENCES public.lesson_notes(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_type text,
  file_size integer,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lesson_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_note_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_note_status_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_note_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_note_attachments ENABLE ROW LEVEL SECURITY;

-- Teachers: own notes
DROP POLICY IF EXISTS "teachers read own lesson notes" ON public.lesson_notes;
CREATE POLICY "teachers read own lesson notes" ON public.lesson_notes
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.teachers t WHERE t.id = lesson_notes.teacher_id AND t.user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

DROP POLICY IF EXISTS "teachers insert own lesson notes" ON public.lesson_notes;
CREATE POLICY "teachers insert own lesson notes" ON public.lesson_notes
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.teachers t WHERE t.id = lesson_notes.teacher_id AND t.user_id = auth.uid())
    AND school_id = public.get_user_school_id(auth.uid())
  );

DROP POLICY IF EXISTS "teachers update own editable lesson notes" ON public.lesson_notes;
CREATE POLICY "teachers update own editable lesson notes" ON public.lesson_notes
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.teachers t WHERE t.id = lesson_notes.teacher_id AND t.user_id = auth.uid())
    AND status IN ('draft'::public.lesson_note_status, 'needs_correction'::public.lesson_note_status, 'rejected'::public.lesson_note_status)
  );

DROP POLICY IF EXISTS "teachers delete own drafts" ON public.lesson_notes;
CREATE POLICY "teachers delete own drafts" ON public.lesson_notes
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.teachers t WHERE t.id = lesson_notes.teacher_id AND t.user_id = auth.uid())
    AND status = 'draft'::public.lesson_note_status
  );

DROP POLICY IF EXISTS "admins manage lesson notes" ON public.lesson_notes;
CREATE POLICY "admins manage lesson notes" ON public.lesson_notes
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  )
  WITH CHECK (
    school_id = public.get_user_school_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

-- Child tables: via lesson_note access
DROP POLICY IF EXISTS "lesson note versions read" ON public.lesson_note_versions;
CREATE POLICY "lesson note versions read" ON public.lesson_note_versions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.lesson_notes ln
      WHERE ln.id = lesson_note_versions.lesson_note_id
        AND (
          EXISTS (SELECT 1 FROM public.teachers t WHERE t.id = ln.teacher_id AND t.user_id = auth.uid())
          OR public.has_role(auth.uid(), 'admin'::app_role)
          OR public.has_role(auth.uid(), 'super_admin'::app_role)
        )
    )
  );

DROP POLICY IF EXISTS "lesson note versions insert" ON public.lesson_note_versions;
CREATE POLICY "lesson note versions insert" ON public.lesson_note_versions
  FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "lesson note logs read" ON public.lesson_note_status_logs;
CREATE POLICY "lesson note logs read" ON public.lesson_note_status_logs
  FOR SELECT TO authenticated
  USING (school_id = public.get_user_school_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "lesson note logs insert" ON public.lesson_note_status_logs;
CREATE POLICY "lesson note logs insert" ON public.lesson_note_status_logs
  FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "lesson note comments read" ON public.lesson_note_comments;
CREATE POLICY "lesson note comments read" ON public.lesson_note_comments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.lesson_notes ln
      WHERE ln.id = lesson_note_comments.lesson_note_id
        AND (
          EXISTS (SELECT 1 FROM public.teachers t WHERE t.id = ln.teacher_id AND t.user_id = auth.uid())
          OR public.has_role(auth.uid(), 'admin'::app_role)
          OR public.has_role(auth.uid(), 'super_admin'::app_role)
        )
    )
  );

DROP POLICY IF EXISTS "lesson note comments insert" ON public.lesson_note_comments;
CREATE POLICY "lesson note comments insert" ON public.lesson_note_comments
  FOR INSERT TO authenticated
  WITH CHECK (author_user_id = auth.uid());

DROP POLICY IF EXISTS "lesson note attachments all" ON public.lesson_note_attachments;
CREATE POLICY "lesson note attachments all" ON public.lesson_note_attachments
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.lesson_notes ln
      WHERE ln.id = lesson_note_attachments.lesson_note_id
        AND (
          EXISTS (SELECT 1 FROM public.teachers t WHERE t.id = ln.teacher_id AND t.user_id = auth.uid())
          OR public.has_role(auth.uid(), 'admin'::app_role)
          OR public.has_role(auth.uid(), 'super_admin'::app_role)
        )
    )
  );

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.lesson_notes;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column' AND pronamespace = 'public'::regnamespace) THEN
    DROP TRIGGER IF EXISTS update_lesson_notes_updated_at ON public.lesson_notes;
    CREATE TRIGGER update_lesson_notes_updated_at
      BEFORE UPDATE ON public.lesson_notes
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- Storage bucket for attachments (create in Dashboard if this fails)
INSERT INTO storage.buckets (id, name, public)
VALUES ('lesson-notes', 'lesson-notes', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "lesson notes attachments read" ON storage.objects;
CREATE POLICY "lesson notes attachments read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'lesson-notes');

DROP POLICY IF EXISTS "lesson notes attachments upload" ON storage.objects;
CREATE POLICY "lesson notes attachments upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'lesson-notes');

NOTIFY pgrst, 'reload schema';


-- ========== public/sql/apply-class-register.sql ==========

-- Class Register Management System (multi-tenant)
-- Run in Supabase SQL Editor.

DO $$ BEGIN
  CREATE TYPE public.class_register_status AS ENUM ('draft', 'submitted', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Customizable attendance statuses per school
CREATE TABLE IF NOT EXISTS public.attendance_status_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  code text NOT NULL,
  label text NOT NULL,
  color text NOT NULL DEFAULT '#22c55e',
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, code)
);

-- Class register header (one per class/subject/date/period)
CREATE TABLE IF NOT EXISTS public.class_registers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  term_id uuid REFERENCES public.terms(id) ON DELETE SET NULL,
  academic_year_id uuid REFERENCES public.academic_years(id) ON DELETE SET NULL,
  session_label text,
  register_date date NOT NULL,
  period_label text NOT NULL DEFAULT 'Period 1',
  day_of_week smallint CHECK (day_of_week IS NULL OR (day_of_week >= 0 AND day_of_week <= 6)),
  lesson_summary text,
  lesson_objectives text,
  teaching_methods text,
  homework text,
  participation_summary text,
  teacher_signature text,
  status public.class_register_status NOT NULL DEFAULT 'draft',
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewer_name text,
  admin_feedback text,
  locked boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_class_registers_unique_slot
  ON public.class_registers (school_id, class_id, subject_id, register_date, period_label, COALESCE(term_id, '00000000-0000-0000-0000-000000000000'::uuid));

CREATE INDEX IF NOT EXISTS idx_class_registers_school_date ON public.class_registers(school_id, register_date DESC);
CREATE INDEX IF NOT EXISTS idx_class_registers_status ON public.class_registers(school_id, status);
CREATE INDEX IF NOT EXISTS idx_class_registers_teacher ON public.class_registers(teacher_id, register_date DESC);

-- Per-student register lines
CREATE TABLE IF NOT EXISTS public.register_student_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  register_id uuid NOT NULL REFERENCES public.class_registers(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  attendance_status text NOT NULL DEFAULT 'present',
  time_in time,
  participation text,
  remarks text,
  behavior_remark text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (register_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_register_student_entries_register ON public.register_student_entries(register_id);

-- Workflow audit
CREATE TABLE IF NOT EXISTS public.register_status_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  register_id uuid NOT NULL REFERENCES public.class_registers(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  from_status public.class_register_status,
  to_status public.class_register_status NOT NULL,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_name text,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_register_status_logs_register ON public.register_status_logs(register_id, created_at DESC);

-- General audit trail
CREATE TABLE IF NOT EXISTS public.register_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  register_id uuid REFERENCES public.class_registers(id) ON DELETE SET NULL,
  action text NOT NULL,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_name text,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_register_audit_logs_school ON public.register_audit_logs(school_id, created_at DESC);

-- RLS
ALTER TABLE public.attendance_status_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_registers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.register_student_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.register_status_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.register_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "attendance status types school" ON public.attendance_status_types;
CREATE POLICY "attendance status types school" ON public.attendance_status_types
  FOR ALL TO authenticated
  USING (school_id = public.get_user_school_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (school_id = public.get_user_school_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "class registers school read" ON public.class_registers;
CREATE POLICY "class registers school read" ON public.class_registers
  FOR SELECT TO authenticated
  USING (
    school_id = public.get_user_school_id(auth.uid())
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.teachers t
      WHERE t.user_id = auth.uid() AND t.id = class_registers.teacher_id
    )
    OR (
      status = 'approved'::public.class_register_status
      AND EXISTS (
        SELECT 1 FROM public.students s
        WHERE s.class_id = class_registers.class_id AND s.user_id = auth.uid()
      )
    )
    OR (
      status = 'approved'::public.class_register_status
      AND EXISTS (
        SELECT 1 FROM public.students s
        JOIN public.parents p ON s.guardian_id = p.id
        WHERE s.class_id = class_registers.class_id AND p.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "class registers teacher write" ON public.class_registers;
CREATE POLICY "class registers teacher write" ON public.class_registers
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.teachers t
      WHERE t.user_id = auth.uid() AND t.id = teacher_id AND t.school_id = school_id
    )
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

DROP POLICY IF EXISTS "class registers teacher update" ON public.class_registers;
CREATE POLICY "class registers teacher update" ON public.class_registers
  FOR UPDATE TO authenticated
  USING (
    (locked = false AND status IN ('draft', 'rejected') AND EXISTS (
      SELECT 1 FROM public.teachers t WHERE t.user_id = auth.uid() AND t.id = teacher_id
    ))
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

DROP POLICY IF EXISTS "class registers admin delete" ON public.class_registers;
CREATE POLICY "class registers admin delete" ON public.class_registers
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

DROP POLICY IF EXISTS "register entries via register" ON public.register_student_entries;
CREATE POLICY "register entries via register" ON public.register_student_entries
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.class_registers r WHERE r.id = register_id)
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.class_registers r
      WHERE r.id = register_id
        AND (
          (r.locked = false AND r.status IN ('draft', 'rejected') AND EXISTS (
            SELECT 1 FROM public.teachers t WHERE t.user_id = auth.uid() AND t.id = r.teacher_id
          ))
          OR public.has_role(auth.uid(), 'admin'::app_role)
          OR public.has_role(auth.uid(), 'super_admin'::app_role)
        )
    )
  );

DROP POLICY IF EXISTS "register status logs school" ON public.register_status_logs;
CREATE POLICY "register status logs school" ON public.register_status_logs
  FOR SELECT TO authenticated
  USING (school_id = public.get_user_school_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "register status logs insert" ON public.register_status_logs;
CREATE POLICY "register status logs insert" ON public.register_status_logs
  FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "register audit logs school" ON public.register_audit_logs;
CREATE POLICY "register audit logs school" ON public.register_audit_logs
  FOR SELECT TO authenticated
  USING (
    school_id = public.get_user_school_id(auth.uid())
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

DROP POLICY IF EXISTS "register audit logs insert" ON public.register_audit_logs;
CREATE POLICY "register audit logs insert" ON public.register_audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Approve / reject RPC
CREATE OR REPLACE FUNCTION public.review_class_register(
  p_register_id uuid,
  p_action text,
  p_comment text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_name text;
  v_reg public.class_registers%ROWTYPE;
  v_new_status public.class_register_status;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_action NOT IN ('approve', 'reject') THEN RAISE EXCEPTION 'Invalid action'; END IF;

  SELECT * INTO v_reg FROM public.class_registers WHERE id = p_register_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Register not found'; END IF;

  IF NOT (
    public.has_role(v_uid, 'admin'::app_role)
    OR public.has_role(v_uid, 'super_admin'::app_role)
  ) THEN
    RAISE EXCEPTION 'Only admins can review registers';
  END IF;

  v_new_status := CASE WHEN p_action = 'approve' THEN 'approved'::public.class_register_status ELSE 'rejected'::public.class_register_status END;

  SELECT coalesce(full_name, 'Admin') INTO v_name FROM public.profiles WHERE id = v_uid;

  UPDATE public.class_registers
  SET status = v_new_status,
      reviewed_at = now(),
      reviewed_by = v_uid,
      reviewer_name = v_name,
      admin_feedback = p_comment,
      locked = (v_new_status = 'approved'),
      updated_at = now()
  WHERE id = p_register_id;

  INSERT INTO public.register_status_logs (register_id, school_id, from_status, to_status, actor_user_id, actor_name, comment)
  VALUES (p_register_id, v_reg.school_id, v_reg.status, v_new_status, v_uid, v_name, p_comment);
END;
$$;

GRANT EXECUTE ON FUNCTION public.review_class_register(uuid, text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';


-- ========== public/sql/apply-create-or-get-class-register.sql ==========

-- Create or get a class register atomically
CREATE OR REPLACE FUNCTION public.create_or_get_class_register(
  p_school_id uuid,
  p_class_id uuid,
  p_subject_id uuid,
  p_teacher_id uuid,
  p_register_date date,
  p_term_id uuid DEFAULT NULL,
  p_academic_year_id uuid DEFAULT NULL,
  p_session_label text DEFAULT NULL,
  p_period_label text DEFAULT 'Period 1',
  p_created_by uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_register_id uuid;
  v_day_of_week smallint;
BEGIN
  -- Calculate day of week
  v_day_of_week := EXTRACT(DOW FROM p_register_date)::smallint;

  -- First try to insert, if conflict then select
  INSERT INTO public.class_registers (
    school_id, class_id, subject_id, teacher_id, term_id, academic_year_id,
    session_label, register_date, period_label, day_of_week, status, created_by
  )
  VALUES (
    p_school_id, p_class_id, p_subject_id, p_teacher_id, p_term_id, p_academic_year_id,
    p_session_label, p_register_date, p_period_label, v_day_of_week, 'draft', p_created_by
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_register_id;

  -- If no insert, select existing
  IF v_register_id IS NULL THEN
    SELECT id
    INTO v_register_id
    FROM public.class_registers
    WHERE
      school_id = p_school_id
      AND class_id = p_class_id
      AND subject_id = p_subject_id
      AND register_date = p_register_date
      AND period_label = p_period_label
      AND COALESCE(term_id, '00000000-0000-0000-0000-000000000000'::uuid) = COALESCE(p_term_id, '00000000-0000-0000-0000-000000000000'::uuid)
    LIMIT 1;
  END IF;

  RETURN v_register_id;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.create_or_get_class_register(uuid, uuid, uuid, uuid, date, uuid, uuid, text, text, uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';


-- ========== supabase/migrations/20260609160000_class_teacher_system.sql ==========

-- DDL and Helper functions for Class Teacher System
-- Add class_teacher_id column to classes table
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS class_teacher_id UUID REFERENCES public.teachers(id) ON DELETE SET NULL;

-- Create academic_recommendations table
CREATE TABLE IF NOT EXISTS public.academic_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  term_id uuid REFERENCES public.terms(id) ON DELETE SET NULL,
  recommendation_type text NOT NULL CHECK (recommendation_type IN ('study_plan', 'extra_classes', 'assignment', 'intervention', 'general')),
  suggestions text NOT NULL,
  strengths text,
  weaknesses text,
  threshold_alert boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on academic_recommendations
ALTER TABLE public.academic_recommendations ENABLE ROW LEVEL SECURITY;

-- RLS policies for academic_recommendations
DROP POLICY IF EXISTS "school read recommendations" ON public.academic_recommendations;
CREATE POLICY "school read recommendations" ON public.academic_recommendations
  FOR SELECT TO authenticated
  USING (
    school_id = public.get_user_school_id(auth.uid())
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.students s
      JOIN public.parent_student_links psl ON s.id = psl.student_id
      JOIN public.parents p ON psl.parent_id = p.id
      WHERE s.id = student_id AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "teachers manage own recommendations" ON public.academic_recommendations;
CREATE POLICY "teachers manage own recommendations" ON public.academic_recommendations
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.teachers t
      WHERE t.user_id = auth.uid() AND t.id = teacher_id
    )
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

-- Overwrite teacher view/relationship helper functions to check class_teacher_id
CREATE OR REPLACE FUNCTION public.teacher_can_view_student(teacher_user_id UUID, student_class_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.teachers t
    JOIN public.class_subjects cs ON cs.teacher_id = t.id
    WHERE t.user_id = teacher_user_id
    AND cs.class_id = student_class_id
  ) OR EXISTS (
    SELECT 1 FROM public.classes c
    JOIN public.teachers t ON t.id = c.class_teacher_id
    WHERE t.user_id = teacher_user_id
    AND c.id = student_class_id
  )
$$;

CREATE OR REPLACE FUNCTION public.teacher_can_view_parent(teacher_user_id UUID, parent_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.teachers t
    JOIN public.class_subjects cs ON cs.teacher_id = t.id
    JOIN public.students s ON s.class_id = cs.class_id
    WHERE t.user_id = teacher_user_id
    AND s.guardian_id = parent_id
  ) OR EXISTS (
    SELECT 1 FROM public.classes c
    JOIN public.teachers t ON t.id = c.class_teacher_id
    JOIN public.students s ON s.class_id = c.id
    WHERE t.user_id = teacher_user_id
    AND s.guardian_id = parent_id
  )
$$;

CREATE OR REPLACE FUNCTION public.parent_can_view_teacher(parent_user_id UUID, teacher_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.parents p
    JOIN public.students s ON s.guardian_id = p.id
    JOIN public.class_subjects cs ON cs.class_id = s.class_id
    WHERE p.user_id = parent_user_id
    AND cs.teacher_id = teacher_id
  ) OR EXISTS (
    SELECT 1 FROM public.parents p
    JOIN public.students s ON s.guardian_id = p.id
    JOIN public.classes c ON c.id = s.class_id
    WHERE p.user_id = parent_user_id
    AND c.class_teacher_id = teacher_id
  )
$$;

CREATE OR REPLACE FUNCTION public.get_teacher_student_user_ids(_teacher_user_id UUID)
RETURNS SETOF UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT s.user_id
  FROM public.teachers t
  JOIN public.class_subjects cs ON cs.teacher_id = t.id
  JOIN public.students s ON s.class_id = cs.class_id
  WHERE t.user_id = _teacher_user_id
  UNION
  SELECT DISTINCT s.user_id
  FROM public.teachers t
  JOIN public.classes c ON c.class_teacher_id = t.id
  JOIN public.students s ON s.class_id = c.id
  WHERE t.user_id = _teacher_user_id
$$;

CREATE OR REPLACE FUNCTION public.get_teacher_parent_user_ids(_teacher_user_id UUID)
RETURNS SETOF UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT p.user_id
  FROM public.teachers t
  JOIN public.class_subjects cs ON cs.teacher_id = t.id
  JOIN public.students s ON s.class_id = cs.class_id
  JOIN public.parents p ON p.id = s.guardian_id
  WHERE t.user_id = _teacher_user_id
  UNION
  SELECT DISTINCT p.user_id
  FROM public.teachers t
  JOIN public.classes c ON c.class_teacher_id = t.id
  JOIN public.students s ON s.class_id = c.id
  JOIN public.parents p ON p.id = s.guardian_id
  WHERE t.user_id = _teacher_user_id
$$;

-- Restrict editing approved or published report cards by teachers
CREATE OR REPLACE FUNCTION public.upsert_term_report_card(p_row jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_student_id uuid;
  v_term_id uuid;
  v_class_id uuid;
  v_school_id uuid;
  v_teacher_id uuid;
  v_status public.report_card_status;
  v_existing_id uuid;
  v_existing_version int;
  v_existing_status public.report_card_status;
  v_new_version int;
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_student_id := NULLIF(trim(p_row->>'student_id'), '')::uuid;
  v_term_id := NULLIF(trim(p_row->>'term_id'), '')::uuid;
  v_class_id := NULLIF(trim(p_row->>'class_id'), '')::uuid;
  v_school_id := NULLIF(trim(p_row->>'school_id'), '')::uuid;
  v_teacher_id := COALESCE(NULLIF(trim(p_row->>'teacher_id'), '')::uuid, v_uid);
  v_status := COALESCE((p_row->>'status')::public.report_card_status, 'draft'::public.report_card_status);

  IF v_student_id IS NULL OR v_school_id IS NULL THEN
    RAISE EXCEPTION 'student_id and school_id are required';
  END IF;

  IF NOT public.can_manage_term_report_card(v_uid, v_school_id, v_student_id, v_class_id) THEN
    RAISE EXCEPTION 'Not authorized to save this report card';
  END IF;

  SELECT id, version, status
  INTO v_existing_id, v_existing_version, v_existing_status
  FROM public.term_report_cards
  WHERE student_id = v_student_id
    AND (
      (v_term_id IS NULL AND term_id IS NULL)
      OR term_id = v_term_id
    )
  LIMIT 1;

  -- Security rule check: Teachers cannot modify approved or published report cards without admin rights
  IF v_existing_id IS NOT NULL AND v_existing_status IN ('approved'::public.report_card_status, 'published'::public.report_card_status) THEN
    IF NOT (
      public.has_role(v_uid, 'admin'::app_role)
      OR public.has_role(v_uid, 'super_admin'::app_role)
      OR public.is_school_admin(v_uid, v_school_id)
    ) THEN
      RAISE EXCEPTION 'Cannot modify an approved or published report card without administrator authorization';
    END IF;
  END IF;

  IF v_existing_id IS NOT NULL THEN
    v_new_version := COALESCE(v_existing_version, 1) + 1;
    UPDATE public.term_report_cards
    SET
      school_id = v_school_id,
      class_id = COALESCE(v_class_id, class_id),
      teacher_id = v_teacher_id,
      status = v_status,
      student_name = COALESCE(p_row->>'student_name', student_name),
      class_name = COALESCE(p_row->>'class_name', class_name),
      roll_number = COALESCE(NULLIF(p_row->>'roll_number', '')::integer, roll_number),
      class_position = COALESCE(p_row->>'class_position', class_position),
      class_student_total_manual = COALESCE(NULLIF(p_row->>'class_student_total_manual', '')::integer, class_student_total_manual),
      term_label = COALESCE(p_row->>'term_label', term_label),
      academic_year = COALESCE(p_row->>'academic_year', academic_year),
      attendance_made = COALESCE(p_row->>'attendance_made', attendance_made),
      attendance_total = COALESCE(p_row->>'attendance_total', attendance_total),
      conduct = COALESCE(p_row->>'conduct', conduct),
      interest = COALESCE(p_row->>'interest', interest),
      club = COALESCE(p_row->>'club', club),
      attitude = COALESCE(p_row->>'attitude', attitude),
      teacher_remark = COALESCE(p_row->>'teacher_remark', teacher_remark),
      school_closes = COALESCE(p_row->>'school_closes', school_closes),
      reopening_date = COALESCE(p_row->>'reopening_date', reopening_date),
      next_term = COALESCE(p_row->>'next_term', next_term),
      teacher_sign_date = COALESCE(p_row->>'teacher_sign_date', teacher_sign_date),
      head_sign_date = COALESCE(p_row->>'head_sign_date', head_sign_date),
      parent_sign_date = COALESCE(p_row->>'parent_sign_date', parent_sign_date),
      admin_comment = COALESCE(p_row->>'admin_comment', admin_comment),
      rejection_reason = COALESCE(p_row->>'rejection_reason', rejection_reason),
      subjects = COALESCE(p_row->'subjects', subjects),
      total_score = COALESCE(NULLIF(p_row->>'total_score', '')::numeric, total_score),
      saved_at = COALESCE((p_row->>'saved_at')::timestamptz, now()),
      updated_at = now(),
      version = v_new_version
    WHERE id = v_existing_id;

    v_id := v_existing_id;
  ELSE
    v_new_version := COALESCE(NULLIF(p_row->>'version', '')::integer, 1);
    INSERT INTO public.term_report_cards (
      school_id,
      student_id,
      term_id,
      class_id,
      teacher_id,
      status,
      student_name,
      class_name,
      roll_number,
      class_position,
      class_student_total_manual,
      term_label,
      academic_year,
      attendance_made,
      attendance_total,
      conduct,
      interest,
      club,
      attitude,
      teacher_remark,
      school_closes,
      reopening_date,
      next_term,
      teacher_sign_date,
      head_sign_date,
      parent_sign_date,
      admin_comment,
      rejection_reason,
      subjects,
      total_score,
      version,
      saved_at
    )
    VALUES (
      v_school_id,
      v_student_id,
      v_term_id,
      v_class_id,
      v_teacher_id,
      v_status,
      COALESCE(p_row->>'student_name', 'Student'),
      p_row->>'class_name',
      NULLIF(p_row->>'roll_number', '')::integer,
      p_row->>'class_position',
      NULLIF(p_row->>'class_student_total_manual', '')::integer,
      p_row->>'term_label',
      p_row->>'academic_year',
      p_row->>'attendance_made',
      p_row->>'attendance_total',
      p_row->>'conduct',
      p_row->>'interest',
      p_row->>'club',
      p_row->>'attitude',
      p_row->>'teacher_remark',
      p_row->>'school_closes',
      p_row->>'reopening_date',
      p_row->>'next_term',
      p_row->>'teacher_sign_date',
      p_row->>'head_sign_date',
      p_row->>'parent_sign_date',
      p_row->>'admin_comment',
      p_row->>'rejection_reason',
      COALESCE(p_row->'subjects', '[]'::jsonb),
      NULLIF(p_row->>'total_score', '')::numeric,
      v_new_version,
      COALESCE((p_row->>'saved_at')::timestamptz, now())
    )
    RETURNING id INTO v_id;
  END IF;

  RETURN jsonb_build_object(
    'id', v_id,
    'version', v_new_version,
    'status', v_status
  );
END;
$$;

-- Create auditing trigger function for term_report_cards
CREATE OR REPLACE FUNCTION public.log_term_report_card_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school_id uuid;
  v_action text;
  v_details jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'CREATE';
    v_school_id := NEW.school_id;
    v_details := jsonb_build_object('status', NEW.status, 'student_name', NEW.student_name);
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'UPDATE';
    v_school_id := NEW.school_id;
    v_details := jsonb_build_object(
      'old_status', OLD.status,
      'new_status', NEW.status,
      'student_name', NEW.student_name,
      'version', NEW.version,
      'admin_comment', NEW.admin_comment,
      'rejection_reason', NEW.rejection_reason
    );
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'DELETE';
    v_school_id := OLD.school_id;
    v_details := jsonb_build_object('status', OLD.status, 'student_name', OLD.student_name);
  END IF;

  PERFORM public.write_audit_log(
    v_school_id,
    v_action,
    'term_report_cards',
    COALESCE(NEW.id, OLD.id),
    'reports',
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(NEW) ELSE NULL END,
    v_details
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_log_term_report_card_change ON public.term_report_cards;
CREATE TRIGGER trg_log_term_report_card_change
  AFTER INSERT OR UPDATE OR DELETE ON public.term_report_cards
  FOR EACH ROW EXECUTE FUNCTION public.log_term_report_card_change();

-- Create auditing trigger function for parent-teacher messages
CREATE OR REPLACE FUNCTION public.log_message_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school_id uuid;
  v_sender_name text;
  v_receiver_name text;
BEGIN
  SELECT school_id, full_name INTO v_school_id, v_sender_name FROM public.profiles WHERE id = NEW.sender_id;
  IF v_school_id IS NULL THEN
    SELECT school_id, full_name INTO v_school_id, v_receiver_name FROM public.profiles WHERE id = NEW.receiver_id;
  ELSE
    SELECT full_name INTO v_receiver_name FROM public.profiles WHERE id = NEW.receiver_id;
  END IF;

  IF v_school_id IS NOT NULL THEN
    PERFORM public.write_audit_log(
      v_school_id,
      'SEND_MESSAGE',
      'messages',
      NEW.id,
      'communication',
      NEW.id,
      NULL,
      to_jsonb(NEW),
      jsonb_build_object(
        'sender_name', v_sender_name,
        'receiver_name', v_receiver_name,
        'subject', NEW.subject
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_message_activity ON public.messages;
CREATE TRIGGER trg_log_message_activity
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.log_message_activity();

-- Create trigger function for academic recommendations
CREATE OR REPLACE FUNCTION public.log_academic_recommendation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_name text;
  v_teacher_name text;
  v_guardian_user_id uuid;
BEGIN
  SELECT full_name INTO v_student_name FROM public.students WHERE id = NEW.student_id;
  SELECT profiles.full_name INTO v_teacher_name FROM public.teachers t JOIN public.profiles ON profiles.id = t.user_id WHERE t.id = NEW.teacher_id;

  -- Log recommendation
  PERFORM public.write_audit_log(
    NEW.school_id,
    'SEND_RECOMMENDATION',
    'academic_recommendations',
    NEW.id,
    'communication',
    NEW.id,
    NULL,
    to_jsonb(NEW),
    jsonb_build_object(
      'student_name', v_student_name,
      'teacher_name', v_teacher_name,
      'type', NEW.recommendation_type
    )
  );

  -- Create a notification for the parent
  SELECT p.user_id INTO v_guardian_user_id 
  FROM public.students s 
  JOIN public.parents p ON s.guardian_id = p.id 
  WHERE s.id = NEW.student_id;

  IF v_guardian_user_id IS NOT NULL THEN
    PERFORM public.create_notification(
      v_guardian_user_id,
      'New academic recommendation',
      'Class teacher ' || COALESCE(v_teacher_name, 'assigned teacher') || ' sent an academic recommendation for ' || COALESCE(v_student_name, 'your child') || '.',
      jsonb_build_object('type', 'academic_recommendation', 'recommendation_id', NEW.id)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_academic_recommendation ON public.academic_recommendations;
CREATE TRIGGER trg_log_academic_recommendation
  AFTER INSERT ON public.academic_recommendations
  FOR EACH ROW EXECUTE FUNCTION public.log_academic_recommendation();

-- Modify save_teacher_class_attendance to audit log changes
CREATE OR REPLACE FUNCTION public.save_teacher_class_attendance(
  p_class_id uuid,
  p_date date,
  p_records jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_rec record;
  v_school_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT school_id INTO v_school_id FROM public.classes WHERE id = p_class_id;

  IF NOT (
    public.teacher_can_view_student(v_uid, p_class_id)
    OR (
      public.has_role(v_uid, 'admin'::app_role)
      AND v_school_id = public.get_user_school_id(v_uid)
    )
  ) THEN
    RAISE EXCEPTION 'Not authorized to mark attendance for this class';
  END IF;

  DELETE FROM public.attendance
  WHERE class_id = p_class_id AND date = p_date;

  FOR v_rec IN
    SELECT student_id, status
    FROM jsonb_to_recordset(coalesce(p_records, '[]'::jsonb)) AS x(student_id uuid, status text)
  LOOP
    INSERT INTO public.attendance (student_id, class_id, date, status, recorded_by, recorded_at)
    VALUES (v_rec.student_id, p_class_id, p_date, v_rec.status, v_uid, now());
  END LOOP;

  -- Log attendance update
  PERFORM public.write_audit_log(
    v_school_id,
    'UPDATE_ATTENDANCE',
    'attendance',
    p_class_id,
    'attendance',
    p_class_id,
    NULL,
    p_records,
    jsonb_build_object('class_id', p_class_id, 'date', p_date, 'records_count', jsonb_array_length(p_records))
  );
END;
$$;

-- Modify recalculate_class_rankings to log positions generation
CREATE OR REPLACE FUNCTION public.recalculate_class_rankings(p_class_id uuid, p_term_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_teacher_record uuid;
  v_school uuid;
  v_subject_count int;
  v_subject_updates int := 0;
  v_class_positions int := 0;
  v_reports_updated int := 0;
  v_reports_created int := 0;
  v_student_count int := 0;
  v_subject record;
  v_student record;
  v_class_student record;
  v_report_id uuid;
  v_report_status text;
  v_rank int;
  v_prev numeric;
  v_idx int;
  v_score numeric;
  v_total numeric;
  v_grade text;
  v_remark text;
  v_class_ranks jsonb := '{}'::jsonb;
  v_class_totals jsonb := '{}'::jsonb;
  v_subjects_json jsonb;
  v_class_pos_label text;
  v_agg_total numeric;
  v_st record;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_teacher_record := public.report_teacher_record_id(v_uid);

  SELECT school_id INTO v_school FROM public.classes WHERE id = p_class_id;
  IF v_school IS NULL THEN
    RAISE EXCEPTION 'Class not found';
  END IF;

  -- Check if user is school admin OR teachers assigned via class_subjects OR classes.class_teacher_id
  IF NOT (
    public.is_school_admin(v_uid, v_school)
    OR EXISTS (
      SELECT 1 FROM public.class_subjects cs
      WHERE cs.class_id = p_class_id
        AND (cs.teacher_id = v_uid OR cs.teacher_id = v_teacher_record)
    )
    OR EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = p_class_id
        AND (c.class_teacher_id = v_uid OR c.class_teacher_id = v_teacher_record)
    )
  ) THEN
    RAISE EXCEPTION 'Not authorized to recalculate positions for this class';
  END IF;

  SELECT COUNT(DISTINCT subject_id) INTO v_subject_count
  FROM public.class_subjects
  WHERE class_id = p_class_id;

  IF v_subject_count = 0 THEN
    RETURN jsonb_build_object(
      'subjectUpdates', 0,
      'classPositions', 0,
      'reportCardsUpdated', 0,
      'reportCardsCreated', 0,
      'eligibleStudents', 0
    );
  END IF;

  CREATE TEMP TABLE tmp_class_students ON COMMIT DROP AS
  SELECT st.id AS student_id
  FROM public.students st
  WHERE st.class_id = p_class_id;

  SELECT COUNT(*) INTO v_student_count FROM tmp_class_students;

  IF v_student_count = 0 THEN
    RAISE EXCEPTION 'No students in this class.';
  END IF;

  UPDATE public.results r
  SET position = NULL
  FROM public.students st
  INNER JOIN public.class_subjects cs
    ON cs.class_id = st.class_id
  WHERE r.student_id = st.id
    AND r.subject_id = cs.subject_id
    AND r.term_id = p_term_id
    AND st.class_id = p_class_id;

  FOR v_subject IN
    SELECT DISTINCT cs.subject_id
    FROM public.class_subjects cs
    WHERE cs.class_id = p_class_id
  LOOP
    v_rank := 0;
    v_prev := NULL;
    v_idx := 0;

    FOR v_student IN
      SELECT
        r.id AS result_id,
        public.result_ranking_score(r.ca_score, r.exam_score) AS score
      FROM public.results r
      INNER JOIN tmp_class_students cs ON cs.student_id = r.student_id
      WHERE r.subject_id = v_subject.subject_id
        AND r.term_id = p_term_id
      ORDER BY score DESC, r.student_id
    LOOP
      v_score := v_student.score;
      v_idx := v_idx + 1;

      IF v_prev IS NULL OR v_score IS DISTINCT FROM v_prev THEN
        v_rank := v_idx;
        v_prev := v_score;
      END IF;

      v_total := v_score;
      v_grade := CASE
        WHEN v_total >= 80 THEN 'A' WHEN v_total >= 70 THEN 'B+'
        WHEN v_total >= 60 THEN 'B' WHEN v_total >= 55 THEN 'C+'
        WHEN v_total >= 50 THEN 'C' WHEN v_total >= 45 THEN 'D+'
        WHEN v_total >= 40 THEN 'D' WHEN v_total >= 35 THEN 'E'
        ELSE 'F'
      END;
      v_remark := CASE
        WHEN v_total >= 80 THEN 'Excellent' WHEN v_total >= 70 THEN 'Very Good'
        WHEN v_total >= 60 THEN 'Good' WHEN v_total >= 50 THEN 'Credit'
        WHEN v_total >= 40 THEN 'Pass' WHEN v_total >= 35 THEN 'Pass'
        ELSE 'Fail'
      END;

      UPDATE public.results
      SET position = v_rank, grade = v_grade, remark = v_remark
      WHERE id = v_student.result_id;

      v_subject_updates := v_subject_updates + 1;
    END LOOP;
  END LOOP;

  v_rank := 0;
  v_prev := NULL;
  v_idx := 0;

  FOR v_student IN
    SELECT
      cs.student_id,
      COALESCE(agg.aggregate_total, 0)::numeric AS aggregate_total
    FROM tmp_class_students cs
    LEFT JOIN LATERAL (
      SELECT SUM(public.result_ranking_score(r.ca_score, r.exam_score)) AS aggregate_total
      FROM public.results r
      INNER JOIN public.class_subjects csub
        ON csub.subject_id = r.subject_id AND csub.class_id = p_class_id
      WHERE r.student_id = cs.student_id
        AND r.term_id = p_term_id
    ) agg ON true
    ORDER BY aggregate_total DESC, cs.student_id
  LOOP
    v_score := v_student.aggregate_total;
    v_idx := v_idx + 1;

    IF v_prev IS NULL OR v_score IS DISTINCT FROM v_prev THEN
      v_rank := v_idx;
      v_prev := v_score;
    END IF;

    v_class_ranks := v_class_ranks || jsonb_build_object(v_student.student_id::text, v_rank);
    v_class_totals := v_class_totals || jsonb_build_object(
      v_student.student_id::text,
      v_student.aggregate_total
    );
    v_class_positions := v_class_positions + 1;
  END LOOP;

  FOR v_class_student IN SELECT student_id FROM tmp_class_students
  LOOP
    SELECT tr.id, tr.status::text
    INTO v_report_id, v_report_status
    FROM public.term_report_cards tr
    WHERE tr.student_id = v_class_student.student_id
      AND tr.term_id = p_term_id
    LIMIT 1;

    IF v_report_status IN ('approved', 'published') THEN
      CONTINUE;
    END IF;

    v_subjects_json := public.build_report_subjects_json(
      v_class_student.student_id,
      p_term_id,
      p_class_id
    );

    v_class_pos_label := public.format_rank_label(
      NULLIF((v_class_ranks ->> v_class_student.student_id::text), '')::int
    );
    v_agg_total := NULLIF((v_class_totals ->> v_class_student.student_id::text), '')::numeric;

    IF v_report_id IS NULL THEN
      SELECT st.id, st.full_name, st.school_id, st.admission_number, c.name AS class_name
      INTO v_st
      FROM public.students st
      LEFT JOIN public.classes c ON c.id = st.class_id
      WHERE st.id = v_class_student.student_id;

      INSERT INTO public.term_report_cards (
        school_id,
        student_id,
        term_id,
        class_id,
        teacher_id,
        status,
        student_name,
        class_name,
        roll_number,
        subjects,
        class_position,
        total_score,
        version,
        saved_at
      )
      VALUES (
        COALESCE(v_st.school_id, v_school),
        v_class_student.student_id,
        p_term_id,
        p_class_id,
        v_uid,
        'draft',
        COALESCE(v_st.full_name, 'Student'),
        v_st.class_name,
        NULLIF(regexp_replace(COALESCE(v_st.admission_number, ''), '\D', '', 'g'), '')::integer,
        v_subjects_json,
        v_class_pos_label,
        v_agg_total,
        1,
        now()
      );

      v_reports_created := v_reports_created + 1;
    ELSE
      UPDATE public.term_report_cards
      SET
        class_id = p_class_id,
        subjects = v_subjects_json,
        class_position = v_class_pos_label,
        total_score = COALESCE(v_agg_total, total_score),
        version = COALESCE(version, 1) + 1,
        updated_at = now()
      WHERE id = v_report_id;

      v_reports_updated := v_reports_updated + 1;
    END IF;
  END LOOP;

  -- Log rankings recalculation (positions generation)
  PERFORM public.write_audit_log(
    v_school,
    'GENERATE_POSITIONS',
    'term_report_cards',
    p_class_id,
    'reports',
    p_class_id,
    NULL,
    jsonb_build_object('class_id', p_class_id, 'term_id', p_term_id),
    jsonb_build_object('message', 'Recalculated class rankings and positions')
  );

  RETURN jsonb_build_object(
    'subjectUpdates', v_subject_updates,
    'classPositions', v_class_positions,
    'reportCardsUpdated', v_reports_updated,
    'reportCardsCreated', v_reports_created,
    'eligibleStudents', v_student_count
  );
END;
$function$;

NOTIFY pgrst, 'reload schema';


-- ========== supabase/migrations/20260609170000_class_register_teacher_rls.sql ==========

-- Create helper if not exists
CREATE OR REPLACE FUNCTION public.is_class_teacher_of(_user_id uuid, _class_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.classes c
    JOIN public.teachers t ON t.id = c.class_teacher_id
    WHERE c.id = _class_id AND t.user_id = _user_id
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_class_teacher_of(uuid, uuid) TO authenticated;

-- ============================================================
-- class_registers policies
-- ============================================================

-- Drop all old policies to prevent conflicts
DROP POLICY IF EXISTS "class registers school read" ON public.class_registers;
DROP POLICY IF EXISTS "class registers teacher write" ON public.class_registers;
DROP POLICY IF EXISTS "class registers teacher update" ON public.class_registers;
DROP POLICY IF EXISTS "class registers admin delete" ON public.class_registers;

-- SELECT: school isolation + teacher owner + class teacher
CREATE POLICY "class registers school read" ON public.class_registers
  FOR SELECT TO authenticated
  USING (
    school_id = public.get_user_school_id(auth.uid())
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.teachers t
      WHERE t.user_id = auth.uid() AND t.id = class_registers.teacher_id
    )
    OR public.is_class_teacher_of(auth.uid(), class_registers.class_id)
  );

-- INSERT: teacher owner or class teacher (must belong to the school)
CREATE POLICY "class registers teacher write" ON public.class_registers
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      EXISTS (
        SELECT 1 FROM public.teachers t
        WHERE t.user_id = auth.uid()
          AND t.school_id = class_registers.school_id
          AND (
            t.id = class_registers.teacher_id
            OR public.is_class_teacher_of(auth.uid(), class_registers.class_id)
          )
      )
    )
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

-- UPDATE: teacher owner or class teacher when draft/rejected
CREATE POLICY "class registers teacher update" ON public.class_registers
  FOR UPDATE TO authenticated
  USING (
    (
      class_registers.locked = false
      AND class_registers.status IN ('draft', 'rejected')
      AND EXISTS (
        SELECT 1 FROM public.teachers t
        WHERE t.user_id = auth.uid()
          AND (
            t.id = class_registers.teacher_id
            OR public.is_class_teacher_of(auth.uid(), class_registers.class_id)
          )
      )
    )
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  )
  WITH CHECK (
    (
      class_registers.locked = false
      AND class_registers.status IN ('draft', 'rejected', 'submitted')
      AND EXISTS (
        SELECT 1 FROM public.teachers t
        WHERE t.user_id = auth.uid()
          AND (
            t.id = class_registers.teacher_id
            OR public.is_class_teacher_of(auth.uid(), class_registers.class_id)
          )
      )
    )
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

-- DELETE: only admins can delete registers
CREATE POLICY "class registers admin delete" ON public.class_registers
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );


-- ============================================================
-- register_student_entries policies
-- ============================================================

DROP POLICY IF EXISTS "register entries via register" ON public.register_student_entries;
DROP POLICY IF EXISTS "register entries select" ON public.register_student_entries;
DROP POLICY IF EXISTS "register entries insert" ON public.register_student_entries;
DROP POLICY IF EXISTS "register entries update" ON public.register_student_entries;
DROP POLICY IF EXISTS "register entries delete" ON public.register_student_entries;

-- SELECT: allowed if user can see parent register
CREATE POLICY "register entries select" ON public.register_student_entries
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.class_registers r
      WHERE r.id = register_student_entries.register_id
    )
  );

-- INSERT: allowed if not locked/draft and user is teacher/class-teacher/admin
CREATE POLICY "register entries insert" ON public.register_student_entries
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.class_registers r
      WHERE r.id = register_student_entries.register_id
        AND (
          (
            r.locked = false
            AND r.status IN ('draft', 'rejected')
            AND EXISTS (
              SELECT 1 FROM public.teachers t
              WHERE t.user_id = auth.uid()
                AND (
                  t.id = r.teacher_id
                  OR public.is_class_teacher_of(auth.uid(), r.class_id)
                )
            )
          )
          OR public.has_role(auth.uid(), 'admin'::app_role)
          OR public.has_role(auth.uid(), 'super_admin'::app_role)
        )
    )
  );

-- UPDATE: allowed if not locked/draft and user is teacher/class-teacher/admin
CREATE POLICY "register entries update" ON public.register_student_entries
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.class_registers r
      WHERE r.id = register_student_entries.register_id
        AND (
          (
            r.locked = false
            AND r.status IN ('draft', 'rejected')
            AND EXISTS (
              SELECT 1 FROM public.teachers t
              WHERE t.user_id = auth.uid()
                AND (
                  t.id = r.teacher_id
                  OR public.is_class_teacher_of(auth.uid(), r.class_id)
                )
            )
          )
          OR public.has_role(auth.uid(), 'admin'::app_role)
          OR public.has_role(auth.uid(), 'super_admin'::app_role)
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.class_registers r
      WHERE r.id = register_student_entries.register_id
        AND (
          (
            r.locked = false
            AND r.status IN ('draft', 'rejected')
            AND EXISTS (
              SELECT 1 FROM public.teachers t
              WHERE t.user_id = auth.uid()
                AND (
                  t.id = r.teacher_id
                  OR public.is_class_teacher_of(auth.uid(), r.class_id)
                )
            )
          )
          OR public.has_role(auth.uid(), 'admin'::app_role)
          OR public.has_role(auth.uid(), 'super_admin'::app_role)
        )
    )
  );

-- DELETE: allowed if not locked/draft and user is teacher/class-teacher/admin
CREATE POLICY "register entries delete" ON public.register_student_entries
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.class_registers r
      WHERE r.id = register_student_entries.register_id
        AND (
          (
            r.locked = false
            AND r.status IN ('draft', 'rejected')
            AND EXISTS (
              SELECT 1 FROM public.teachers t
              WHERE t.user_id = auth.uid()
                AND (
                  t.id = r.teacher_id
                  OR public.is_class_teacher_of(auth.uid(), r.class_id)
                )
            )
          )
          OR public.has_role(auth.uid(), 'admin'::app_role)
          OR public.has_role(auth.uid(), 'super_admin'::app_role)
        )
    )
  );


-- ========== supabase/migrations/20260610013110_ab57ad5f-27ad-47ac-a974-972e71c17795.sql ==========

ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- 1. Helper: is the given user the class teacher of the given class?
CREATE OR REPLACE FUNCTION public.is_class_teacher_of(_user_id uuid, _class_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.classes c
    JOIN public.teachers t ON t.id = c.class_teacher_id
    WHERE c.id = _class_id AND t.user_id = _user_id
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_class_teacher_of(uuid, uuid) TO authenticated;

-- 2. Admin assigns / removes class teacher with audit log
CREATE OR REPLACE FUNCTION public.assign_class_teacher(p_class_id uuid, p_teacher_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_school uuid;
  v_prev uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT (public.has_role(v_uid, 'admin'::app_role) OR public.has_role(v_uid, 'super_admin'::app_role)) THEN
    RAISE EXCEPTION 'Only administrators can assign class teachers';
  END IF;

  SELECT school_id, class_teacher_id INTO v_school, v_prev FROM public.classes WHERE id = p_class_id;
  IF v_school IS NULL THEN RAISE EXCEPTION 'Class not found'; END IF;

  IF p_teacher_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.teachers WHERE id = p_teacher_id AND school_id = v_school
  ) THEN
    RAISE EXCEPTION 'Teacher does not belong to this school';
  END IF;

  UPDATE public.classes SET class_teacher_id = p_teacher_id, updated_at = now() WHERE id = p_class_id;

  INSERT INTO public.audit_logs (school_id, action_type, entity_type, entity_id, performed_by, details, module, new_values, old_values)
  VALUES (
    v_school,
    CASE WHEN p_teacher_id IS NULL THEN 'unassign_class_teacher' ELSE 'assign_class_teacher' END,
    'class', p_class_id, v_uid,
    jsonb_build_object('previous_teacher_id', v_prev, 'new_teacher_id', p_teacher_id),
    'class_teacher',
    jsonb_build_object('class_teacher_id', p_teacher_id),
    jsonb_build_object('class_teacher_id', v_prev)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.assign_class_teacher(uuid, uuid) TO authenticated;

-- 3. Send academic recommendation (class teacher or admin)
CREATE OR REPLACE FUNCTION public.create_academic_recommendation(
  p_student_id uuid,
  p_recommendation_type text,
  p_suggestions text,
  p_strengths text DEFAULT NULL,
  p_weaknesses text DEFAULT NULL,
  p_threshold_alert boolean DEFAULT false,
  p_term_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_student record;
  v_teacher_id uuid;
  v_rec_id uuid;
  v_title text;
  v_body text;
  v_school_name text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT s.id, s.school_id, s.class_id, s.user_id, s.guardian_id, coalesce(s.full_name, p.full_name) AS full_name
  INTO v_student
  FROM public.students s
  LEFT JOIN public.profiles p ON p.id = s.user_id
  WHERE s.id = p_student_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Student not found'; END IF;

  SELECT id INTO v_teacher_id FROM public.teachers WHERE user_id = v_uid LIMIT 1;

  IF NOT (
    public.has_role(v_uid, 'admin'::app_role)
    OR public.has_role(v_uid, 'super_admin'::app_role)
    OR public.is_class_teacher_of(v_uid, v_student.class_id)
  ) THEN
    RAISE EXCEPTION 'Only the assigned class teacher or an administrator can send recommendations';
  END IF;

  INSERT INTO public.academic_recommendations (
    school_id, student_id, term_id, teacher_id, recommendation_type,
    suggestions, strengths, weaknesses, threshold_alert, created_by
  ) VALUES (
    v_student.school_id, p_student_id, p_term_id, v_teacher_id,
    coalesce(p_recommendation_type, 'general'),
    p_suggestions, p_strengths, p_weaknesses, coalesce(p_threshold_alert, false), v_uid
  ) RETURNING id INTO v_rec_id;

  SELECT school_name INTO v_school_name FROM public.schools WHERE id = v_student.school_id;

  v_title := CASE WHEN coalesce(p_threshold_alert, false)
                  THEN 'Performance alert for ' || coalesce(v_student.full_name, 'your child')
                  ELSE 'New recommendation for ' || coalesce(v_student.full_name, 'your child') END;
  v_body := coalesce(p_suggestions, 'A new academic recommendation has been issued.');

  -- Notify all linked parents/guardians
  INSERT INTO public.notifications (user_id, title, body, data, read)
  SELECT DISTINCT p.user_id, v_title, v_body,
         jsonb_build_object(
           'type', 'academic_recommendation',
           'recommendation_id', v_rec_id,
           'student_id', p_student_id,
           'school_id', v_student.school_id,
           'school_name', v_school_name,
           'threshold_alert', coalesce(p_threshold_alert, false)
         ),
         false
  FROM public.parents p
  WHERE p.user_id IS NOT NULL
    AND (
      p.id = v_student.guardian_id
      OR EXISTS (
        SELECT 1 FROM public.parent_student_links psl
        WHERE psl.parent_id = p.id AND psl.student_id = p_student_id
      )
    );

  -- Notify the student too
  IF v_student.user_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, body, data, read)
    VALUES (v_student.user_id, v_title, v_body,
            jsonb_build_object('type', 'academic_recommendation', 'recommendation_id', v_rec_id, 'student_id', p_student_id),
            false);
  END IF;

  INSERT INTO public.audit_logs (school_id, action_type, entity_type, entity_id, performed_by, details, module)
  VALUES (v_student.school_id, 'academic_recommendation_sent', 'student', p_student_id, v_uid,
          jsonb_build_object('recommendation_id', v_rec_id, 'threshold_alert', coalesce(p_threshold_alert, false), 'type', p_recommendation_type),
          'class_teacher');

  RETURN v_rec_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_academic_recommendation(uuid, text, text, text, text, boolean, uuid) TO authenticated;

-- 4. Class teacher overview RPC
CREATE OR REPLACE FUNCTION public.class_teacher_student_overview(p_class_id uuid)
RETURNS TABLE (
  student_id uuid,
  full_name text,
  admission_no text,
  attendance_percent numeric,
  present_days int,
  total_days int,
  average_score numeric,
  failing_subjects int,
  alert_low_attendance boolean,
  alert_low_performance boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  IF NOT (
    public.has_role(v_uid, 'admin'::app_role)
    OR public.has_role(v_uid, 'super_admin'::app_role)
    OR public.is_class_teacher_of(v_uid, p_class_id)
  ) THEN
    RAISE EXCEPTION 'Not authorized for this class';
  END IF;

  RETURN QUERY
  WITH roster AS (
    SELECT s.id, coalesce(s.full_name, p.full_name, 'Student') AS full_name,
           coalesce(s.admission_no, s.admission_number) AS admission_no
    FROM public.students s
    LEFT JOIN public.profiles p ON p.id = s.user_id
    WHERE s.class_id = p_class_id
  ),
  att AS (
    SELECT ar.student_id,
           count(*)::int AS total_days,
           count(*) FILTER (WHERE lower(ar.attendance_status) = 'present')::int AS present_days
    FROM public.attendance_records ar
    WHERE ar.class_id = p_class_id
    GROUP BY ar.student_id
  ),
  gr AS (
    SELECT g.student_id,
           avg(g.score)::numeric AS avg_score,
           count(*) FILTER (WHERE g.score < 50)::int AS failing
    FROM public.grades g
    JOIN public.students s ON s.id = g.student_id
    WHERE s.class_id = p_class_id
    GROUP BY g.student_id
  )
  SELECT
    r.id,
    r.full_name,
    r.admission_no,
    CASE WHEN coalesce(att.total_days, 0) > 0
         THEN round((att.present_days::numeric / att.total_days::numeric) * 100, 1)
         ELSE 0 END AS attendance_percent,
    coalesce(att.present_days, 0),
    coalesce(att.total_days, 0),
    round(coalesce(gr.avg_score, 0), 1),
    coalesce(gr.failing, 0),
    CASE WHEN coalesce(att.total_days, 0) > 0
         AND (att.present_days::numeric / att.total_days::numeric) < 0.75 THEN true ELSE false END,
    CASE WHEN coalesce(gr.avg_score, 100) < 50 OR coalesce(gr.failing, 0) >= 2 THEN true ELSE false END
  FROM roster r
  LEFT JOIN att ON att.student_id = r.id
  LEFT JOIN gr ON gr.student_id = r.id
  ORDER BY r.full_name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.class_teacher_student_overview(uuid) TO authenticated;

-- 5. Read access for class teachers
-- a) students: class teacher can view students in their assigned classes
DROP POLICY IF EXISTS "Class teacher can view their class students" ON public.students;
CREATE POLICY "Class teacher can view their class students"
ON public.students FOR SELECT
TO authenticated
USING (public.is_class_teacher_of(auth.uid(), class_id));

-- b) grades
DROP POLICY IF EXISTS "Class teacher can view their class grades" ON public.grades;
CREATE POLICY "Class teacher can view their class grades"
ON public.grades FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.students s
  WHERE s.id = grades.student_id
    AND public.is_class_teacher_of(auth.uid(), s.class_id)
));

-- c) attendance_records
DROP POLICY IF EXISTS "Class teacher can view their class attendance records" ON public.attendance_records;
CREATE POLICY "Class teacher can view their class attendance records"
ON public.attendance_records FOR SELECT
TO authenticated
USING (public.is_class_teacher_of(auth.uid(), class_id));

-- d) term_report_cards
DROP POLICY IF EXISTS "Class teacher can view their class report cards" ON public.term_report_cards;
CREATE POLICY "Class teacher can view their class report cards"
ON public.term_report_cards FOR SELECT
TO authenticated
USING (public.is_class_teacher_of(auth.uid(), class_id));

DROP POLICY IF EXISTS "Class teacher can submit their class report cards" ON public.term_report_cards;
CREATE POLICY "Class teacher can submit their class report cards"
ON public.term_report_cards FOR UPDATE
TO authenticated
USING (public.is_class_teacher_of(auth.uid(), class_id))
WITH CHECK (public.is_class_teacher_of(auth.uid(), class_id));

-- e) academic_recommendations: parents can read their kids' recommendations
DROP POLICY IF EXISTS "Parents can view recommendations for their children" ON public.academic_recommendations;
CREATE POLICY "Parents can view recommendations for their children"
ON public.academic_recommendations FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.students s
  LEFT JOIN public.parents p ON p.id = s.guardian_id
  LEFT JOIN public.parent_student_links psl ON psl.student_id = s.id
  LEFT JOIN public.parents p2 ON p2.id = psl.parent_id
  WHERE s.id = academic_recommendations.student_id
    AND (p.user_id = auth.uid() OR p2.user_id = auth.uid() OR s.user_id = auth.uid())
));

