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
-- RBAC tables (permissions / roles — staff portal access)
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
