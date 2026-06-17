-- Platform SaaS: subscription plans, tenant entitlements, usage snapshots

DO $$ BEGIN
  CREATE TYPE public.subscription_status AS ENUM (
    'trial', 'active', 'suspended', 'expired', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  price_monthly numeric(12,2) NOT NULL DEFAULT 0,
  price_annual numeric(12,2) NOT NULL DEFAULT 0,
  max_students int,
  max_teachers int,
  max_storage_gb int,
  is_custom boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  default_modules jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.subscription_plans TO anon, authenticated;
GRANT ALL ON public.subscription_plans TO service_role;

CREATE TABLE IF NOT EXISTS public.school_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL UNIQUE REFERENCES public.schools(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.subscription_plans(id) ON DELETE SET NULL,
  status public.subscription_status NOT NULL DEFAULT 'trial',
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  trial_ends_at timestamptz,
  renewed_at timestamptz,
  read_only_on_expiry boolean NOT NULL DEFAULT true,
  block_login_on_expiry boolean NOT NULL DEFAULT false,
  storage_used_mb numeric(12,2) NOT NULL DEFAULT 0,
  storage_limit_mb numeric(12,2),
  monthly_revenue numeric(12,2) NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_subscriptions TO authenticated;
GRANT ALL ON public.school_subscriptions TO service_role;

CREATE INDEX IF NOT EXISTS idx_school_subscriptions_status ON public.school_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_school_subscriptions_expires ON public.school_subscriptions(expires_at);

CREATE TABLE IF NOT EXISTS public.platform_modules (
  module_key text PRIMARY KEY,
  category text NOT NULL,
  label text NOT NULL,
  description text,
  portal_module_key text,
  sort_order int NOT NULL DEFAULT 0,
  is_core boolean NOT NULL DEFAULT false
);
GRANT SELECT ON public.platform_modules TO anon, authenticated;
GRANT ALL ON public.platform_modules TO service_role;

CREATE TABLE IF NOT EXISTS public.school_module_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  module_key text NOT NULL REFERENCES public.platform_modules(module_key) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  can_read boolean NOT NULL DEFAULT false,
  can_create boolean NOT NULL DEFAULT false,
  can_edit boolean NOT NULL DEFAULT false,
  can_delete boolean NOT NULL DEFAULT false,
  can_export boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (school_id, module_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_module_entitlements TO authenticated;
GRANT ALL ON public.school_module_entitlements TO service_role;

CREATE INDEX IF NOT EXISTS idx_school_module_entitlements_school ON public.school_module_entitlements(school_id);

CREATE TABLE IF NOT EXISTS public.school_usage_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  snapshot_date date NOT NULL DEFAULT CURRENT_DATE,
  student_count int NOT NULL DEFAULT 0,
  teacher_count int NOT NULL DEFAULT 0,
  parent_count int NOT NULL DEFAULT 0,
  user_count int NOT NULL DEFAULT 0,
  login_count_30d int NOT NULL DEFAULT 0,
  storage_mb numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, snapshot_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_usage_snapshots TO authenticated;
GRANT ALL ON public.school_usage_snapshots TO service_role;

INSERT INTO public.platform_modules (module_key, category, label, portal_module_key, sort_order) VALUES
  ('students', 'academic', 'Student Management', 'students', 10),
  ('admissions', 'academic', 'Admissions', 'pending_users', 20),
  ('teachers', 'academic', 'Teachers', 'teachers', 30),
  ('parents', 'academic', 'Parents', 'parent_contacts', 40),
  ('classes', 'academic', 'Classes', 'classes', 50),
  ('subjects', 'academic', 'Subjects', 'subjects', 60),
  ('timetable', 'academic', 'Timetable', 'timetable', 70),
  ('lesson_notes', 'academic', 'Lesson Notes', 'lesson_notes', 80),
  ('attendance', 'academic', 'Attendance', 'attendance', 90),
  ('class_registers', 'academic', 'Class Registers', 'class_registers', 95),
  ('assignments', 'academic', 'Assignments', NULL, 100),
  ('examinations', 'academic', 'Examinations', NULL, 110),
  ('results', 'academic', 'Results', 'result_scores', 120),
  ('report_cards', 'academic', 'Report Cards', 'report_cards', 130),
  ('academic_reports', 'academic', 'Academic Reports', 'academic_reports', 140),
  ('billing', 'financial', 'Billing', 'billing_overview', 200),
  ('fee_management', 'financial', 'Fee Management', 'billing_fees', 210),
  ('invoicing', 'financial', 'Invoicing', 'billing_invoices', 220),
  ('payments', 'financial', 'Payments', 'billing_payments', 230),
  ('online_payments', 'financial', 'Online Payments', 'billing_payment_gateways', 240),
  ('paystack', 'financial', 'Paystack', 'billing_payment_gateways', 250),
  ('financial_reports', 'financial', 'Financial Reports', 'billing_reports', 260),
  ('sms', 'communication', 'SMS', NULL, 300),
  ('email', 'communication', 'Email', NULL, 310),
  ('notifications', 'communication', 'Notifications', NULL, 320),
  ('parent_messaging', 'communication', 'Parent Messaging', NULL, 330),
  ('announcements', 'communication', 'Announcements', 'announcements', 340),
  ('staff_management', 'hr', 'Staff Management', 'teachers', 400),
  ('payroll', 'hr', 'Payroll', 'billing_payroll', 410),
  ('leave_management', 'hr', 'Leave Management', NULL, 420),
  ('staff_attendance', 'hr', 'Staff Attendance', NULL, 430),
  ('library', 'library', 'Library Management', NULL, 500),
  ('transport', 'transport', 'Transport', NULL, 600),
  ('hostel', 'hostel', 'Hostel', NULL, 700),
  ('inventory', 'inventory', 'Inventory', NULL, 800),
  ('elearning', 'learning', 'E-Learning', NULL, 900),
  ('cbt_exams', 'learning', 'CBT Exams', NULL, 910)
ON CONFLICT (module_key) DO UPDATE SET
  label = EXCLUDED.label,
  category = EXCLUDED.category,
  portal_module_key = EXCLUDED.portal_module_key,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.subscription_plans (slug, name, description, price_monthly, price_annual, max_students, max_teachers, max_storage_gb, sort_order, default_modules)
VALUES
  ('basic','Basic Plan','Core academic tracking',49,490,500,20,5,10,
    '["students","teachers","attendance","report_cards"]'::jsonb),
  ('standard','Standard Plan','Academic modules + parent portal + SMS',149,1490,2000,100,20,20,
    '["students","teachers","parents","classes","subjects","timetable","attendance","class_registers","report_cards","academic_reports","announcements","sms","billing","fee_management","invoicing","payments"]'::jsonb),
  ('premium','Premium Plan','Full ERP',399,3990,NULL,NULL,NULL,30,
    '["students","admissions","teachers","parents","classes","subjects","timetable","lesson_notes","attendance","class_registers","report_cards","academic_reports","billing","fee_management","invoicing","payments","online_payments","paystack","financial_reports","payroll","announcements","sms"]'::jsonb),
  ('enterprise','Enterprise Plan','Custom modules and limits',0,0,NULL,NULL,NULL,40,'[]'::jsonb)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name, description = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly, price_annual = EXCLUDED.price_annual,
  max_students = EXCLUDED.max_students, max_teachers = EXCLUDED.max_teachers,
  max_storage_gb = EXCLUDED.max_storage_gb, default_modules = EXCLUDED.default_modules;

CREATE OR REPLACE FUNCTION public.is_platform_super_admin(p_uid uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.has_role(p_uid, 'super_admin'::app_role); $$;

CREATE OR REPLACE FUNCTION public.school_subscription_enforced(p_school_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.school_subscriptions ss WHERE ss.school_id = p_school_id); $$;

CREATE OR REPLACE FUNCTION public.save_school_module_entitlements(p_school_id uuid, p_rows jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row jsonb; v_key text;
BEGIN
  IF NOT public.is_platform_super_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Forbidden');
  END IF;
  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
    v_key := v_row->>'module_key';
    IF v_key IS NULL THEN CONTINUE; END IF;
    INSERT INTO public.school_module_entitlements (
      school_id, module_key, enabled, can_read, can_create, can_edit, can_delete, can_export, updated_by, updated_at
    ) VALUES (
      p_school_id, v_key,
      coalesce((v_row->>'enabled')::boolean, false),
      coalesce((v_row->>'can_read')::boolean, false),
      coalesce((v_row->>'can_create')::boolean, false),
      coalesce((v_row->>'can_edit')::boolean, false),
      coalesce((v_row->>'can_delete')::boolean, false),
      coalesce((v_row->>'can_export')::boolean, false),
      auth.uid(), now()
    )
    ON CONFLICT (school_id, module_key) DO UPDATE SET
      enabled = EXCLUDED.enabled, can_read = EXCLUDED.can_read, can_create = EXCLUDED.can_create,
      can_edit = EXCLUDED.can_edit, can_delete = EXCLUDED.can_delete, can_export = EXCLUDED.can_export,
      updated_by = EXCLUDED.updated_by, updated_at = now();
  END LOOP;
  RETURN jsonb_build_object('ok', true);
END; $$;

GRANT EXECUTE ON FUNCTION public.is_platform_super_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_school_module_entitlements(uuid, jsonb) TO authenticated;

CREATE OR REPLACE VIEW public.platform_tenant_overview_v AS
SELECT s.id AS school_id, s.school_name, s.school_code,
  coalesce(s.is_active, true) AS is_active,
  ss.status AS subscription_status, sp.slug AS plan_slug, sp.name AS plan_name,
  ss.expires_at, ss.trial_ends_at, ss.storage_used_mb, ss.storage_limit_mb,
  (SELECT count(*)::int FROM public.students st WHERE st.school_id = s.id) AS student_count,
  (SELECT count(*)::int FROM public.teachers t WHERE t.school_id = s.id) AS teacher_count,
  (SELECT count(*)::int FROM public.parents p WHERE p.school_id = s.id) AS parent_count,
  (SELECT count(*)::int FROM public.profiles pr WHERE pr.school_id = s.id) AS user_count,
  s.created_at
FROM public.schools s
LEFT JOIN public.school_subscriptions ss ON ss.school_id = s.id
LEFT JOIN public.subscription_plans sp ON sp.id = ss.plan_id;
GRANT SELECT ON public.platform_tenant_overview_v TO authenticated;

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_module_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_usage_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super admin manage subscription plans" ON public.subscription_plans;
CREATE POLICY "super admin manage subscription plans" ON public.subscription_plans FOR ALL TO authenticated
  USING (public.is_platform_super_admin()) WITH CHECK (public.is_platform_super_admin());
DROP POLICY IF EXISTS "authenticated read subscription plans" ON public.subscription_plans;
CREATE POLICY "authenticated read subscription plans" ON public.subscription_plans FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "super admin manage school subscriptions" ON public.school_subscriptions;
CREATE POLICY "super admin manage school subscriptions" ON public.school_subscriptions FOR ALL TO authenticated
  USING (public.is_platform_super_admin()) WITH CHECK (public.is_platform_super_admin());
DROP POLICY IF EXISTS "school read own subscription" ON public.school_subscriptions;
CREATE POLICY "school read own subscription" ON public.school_subscriptions FOR SELECT TO authenticated
  USING (school_id = public.get_user_school_id(auth.uid()));

DROP POLICY IF EXISTS "read platform modules" ON public.platform_modules;
CREATE POLICY "read platform modules" ON public.platform_modules FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "super admin manage entitlements" ON public.school_module_entitlements;
CREATE POLICY "super admin manage entitlements" ON public.school_module_entitlements FOR ALL TO authenticated
  USING (public.is_platform_super_admin()) WITH CHECK (public.is_platform_super_admin());
DROP POLICY IF EXISTS "school read own entitlements" ON public.school_module_entitlements;
CREATE POLICY "school read own entitlements" ON public.school_module_entitlements FOR SELECT TO authenticated
  USING (school_id = public.get_user_school_id(auth.uid()));

DROP POLICY IF EXISTS "super admin usage snapshots" ON public.school_usage_snapshots;
CREATE POLICY "super admin usage snapshots" ON public.school_usage_snapshots FOR ALL TO authenticated
  USING (public.is_platform_super_admin()) WITH CHECK (public.is_platform_super_admin());

-- Extend enum
DO $$ BEGIN ALTER TYPE public.subscription_status ADD VALUE IF NOT EXISTS 'pending'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE public.subscription_status ADD VALUE IF NOT EXISTS 'locked'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.school_subscriptions
  ADD COLUMN IF NOT EXISTS billing_cycle text CHECK (billing_cycle IS NULL OR billing_cycle IN ('monthly', 'annual')),
  ADD COLUMN IF NOT EXISTS grace_period_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_day int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS amount_paid numeric(12,2),
  ADD COLUMN IF NOT EXISTS payment_reference text,
  ADD COLUMN IF NOT EXISTS paystack_transaction_id text;

CREATE TABLE IF NOT EXISTS public.organization_subscription_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.subscription_plans(id) ON DELETE RESTRICT,
  billing_cycle text NOT NULL CHECK (billing_cycle IN ('monthly', 'annual')),
  amount numeric(12,2) NOT NULL,
  currency text NOT NULL DEFAULT 'GHS',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  payment_reference text NOT NULL,
  paystack_transaction_id text,
  payment_status text,
  paid_at timestamptz,
  period_start timestamptz,
  period_end timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.organization_subscription_payments TO authenticated;
GRANT ALL ON public.organization_subscription_payments TO service_role;
CREATE UNIQUE INDEX IF NOT EXISTS idx_org_sub_payments_reference ON public.organization_subscription_payments(payment_reference);
CREATE INDEX IF NOT EXISTS idx_org_sub_payments_school ON public.organization_subscription_payments(school_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.subscription_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  payment_reference text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.subscription_audit_log TO authenticated;
GRANT ALL ON public.subscription_audit_log TO service_role;
CREATE INDEX IF NOT EXISTS idx_subscription_audit_school ON public.subscription_audit_log(school_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.platform_subscription_checkouts (
  reference text PRIMARY KEY,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.subscription_plans(id) ON DELETE RESTRICT,
  billing_cycle text NOT NULL CHECK (billing_cycle IN ('monthly', 'annual')),
  amount numeric(12,2) NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  consumed_at timestamptz
);
GRANT SELECT, INSERT, UPDATE ON public.platform_subscription_checkouts TO authenticated;
GRANT ALL ON public.platform_subscription_checkouts TO service_role;

CREATE OR REPLACE FUNCTION public.log_subscription_audit(
  p_school_id uuid, p_action text, p_details jsonb DEFAULT '{}'::jsonb,
  p_payment_reference text DEFAULT NULL, p_user_id uuid DEFAULT auth.uid()
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.subscription_audit_log (school_id, user_id, action, details, payment_reference)
  VALUES (p_school_id, p_user_id, p_action, coalesce(p_details, '{}'::jsonb), p_payment_reference);
END; $$;

CREATE OR REPLACE FUNCTION public.get_organization_subscription_access(p_school_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_sub public.school_subscriptions%ROWTYPE;
  v_now timestamptz := now();
  v_days_remaining int;
  v_access_state text;
  v_can_use boolean := false;
  v_expiring_days int := 7;
BEGIN
  IF p_school_id IS NULL THEN
    RETURN jsonb_build_object('has_subscription_row', false, 'access_state', 'legacy', 'can_use_platform', true);
  END IF;
  SELECT * INTO v_sub FROM public.school_subscriptions WHERE school_id = p_school_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('has_subscription_row', false, 'access_state', 'legacy', 'can_use_platform', true);
  END IF;
  v_days_remaining := CASE WHEN v_sub.expires_at IS NULL THEN NULL
    ELSE greatest(0, (date(v_sub.expires_at) - date(v_now))::int) END;
  IF v_sub.status = 'pending' OR (v_sub.status IN ('pending', 'trial') AND v_sub.plan_id IS NULL) THEN
    v_access_state := 'pending_payment'; v_can_use := false;
  ELSIF v_sub.status = 'locked' OR v_sub.status = 'suspended' THEN
    v_access_state := 'locked'; v_can_use := false;
  ELSIF v_sub.status IN ('active') AND (v_sub.expires_at IS NULL OR v_sub.expires_at > v_now) THEN
    IF v_days_remaining IS NOT NULL AND v_days_remaining <= v_expiring_days THEN
      v_access_state := 'expiring_soon';
    ELSE v_access_state := 'active'; END IF;
    v_can_use := true;
  ELSIF v_sub.status = 'expired' OR (v_sub.expires_at IS NOT NULL AND v_sub.expires_at <= v_now) THEN
    IF v_sub.grace_period_ends_at IS NOT NULL AND v_now <= v_sub.grace_period_ends_at THEN
      v_access_state := 'expired_grace';
      v_can_use := coalesce(v_sub.read_only_on_expiry, true) = false;
    ELSE v_access_state := 'locked'; v_can_use := false; END IF;
  ELSIF v_sub.status = 'cancelled' THEN
    v_access_state := 'locked'; v_can_use := false;
  ELSE v_access_state := 'pending_payment'; v_can_use := false; END IF;
  RETURN jsonb_build_object(
    'has_subscription_row', true, 'access_state', v_access_state,
    'can_use_platform', v_can_use, 'status', v_sub.status, 'plan_id', v_sub.plan_id,
    'billing_cycle', v_sub.billing_cycle, 'started_at', v_sub.started_at,
    'expires_at', v_sub.expires_at, 'grace_period_ends_at', v_sub.grace_period_ends_at,
    'reminder_day', v_sub.reminder_day, 'days_remaining', v_days_remaining,
    'locked_at', v_sub.locked_at);
END; $$;

CREATE OR REPLACE FUNCTION public.apply_subscription_plan_to_school_internal(p_school_id uuid, p_plan_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_plan public.subscription_plans%ROWTYPE; v_mod text; v_modules jsonb;
BEGIN
  SELECT * INTO v_plan FROM public.subscription_plans WHERE id = p_plan_id;
  IF NOT FOUND THEN RETURN; END IF;
  v_modules := v_plan.default_modules;
  UPDATE public.school_module_entitlements e
  SET enabled = false, can_read = false, can_create = false, can_edit = false,
      can_delete = false, can_export = false, updated_at = now()
  WHERE e.school_id = p_school_id;
  FOR v_mod IN SELECT jsonb_array_elements_text(v_modules) LOOP
    INSERT INTO public.school_module_entitlements (
      school_id, module_key, enabled, can_read, can_create, can_edit, can_delete, can_export, updated_at
    ) VALUES (p_school_id, v_mod, true, true, true, true, true, true, now())
    ON CONFLICT (school_id, module_key) DO UPDATE SET
      enabled = true, can_read = true, can_create = true, can_edit = true,
      can_delete = true, can_export = true, updated_at = now();
  END LOOP;
END; $$;

CREATE OR REPLACE FUNCTION public.apply_subscription_plan_to_school(
  p_school_id uuid, p_plan_id uuid,
  p_status public.subscription_status DEFAULT 'active',
  p_expires_at timestamptz DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_plan public.subscription_plans%ROWTYPE;
BEGIN
  IF NOT public.is_platform_super_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Forbidden');
  END IF;
  SELECT * INTO v_plan FROM public.subscription_plans WHERE id = p_plan_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Plan not found'); END IF;
  INSERT INTO public.school_subscriptions (school_id, plan_id, status, expires_at, storage_limit_mb, updated_at)
  VALUES (p_school_id, p_plan_id, p_status, p_expires_at, v_plan.max_storage_gb * 1024, now())
  ON CONFLICT (school_id) DO UPDATE SET
    plan_id = EXCLUDED.plan_id, status = EXCLUDED.status, expires_at = EXCLUDED.expires_at,
    storage_limit_mb = EXCLUDED.storage_limit_mb, updated_at = now();
  PERFORM public.apply_subscription_plan_to_school_internal(p_school_id, p_plan_id);
  RETURN jsonb_build_object('ok', true);
END; $$;

CREATE OR REPLACE FUNCTION public.activate_organization_subscription(
  p_reference text, p_paystack_transaction_id text DEFAULT NULL,
  p_amount numeric DEFAULT NULL, p_payment_status text DEFAULT 'success'
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_checkout public.platform_subscription_checkouts%ROWTYPE;
  v_plan public.subscription_plans%ROWTYPE;
  v_period_end timestamptz; v_existing uuid;
BEGIN
  IF p_reference IS NULL OR trim(p_reference) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Missing reference');
  END IF;
  SELECT * INTO v_checkout FROM public.platform_subscription_checkouts WHERE reference = p_reference;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Checkout not found'); END IF;
  IF v_checkout.consumed_at IS NOT NULL THEN
    SELECT id INTO v_existing FROM public.organization_subscription_payments
    WHERE payment_reference = p_reference AND status = 'completed' LIMIT 1;
    IF v_existing IS NOT NULL THEN RETURN jsonb_build_object('ok', true, 'duplicate', true); END IF;
  END IF;
  SELECT * INTO v_plan FROM public.subscription_plans WHERE id = v_checkout.plan_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Plan not found'); END IF;
  v_period_end := CASE v_checkout.billing_cycle WHEN 'annual' THEN now() + interval '365 days' ELSE now() + interval '30 days' END;
  INSERT INTO public.organization_subscription_payments (
    school_id, plan_id, billing_cycle, amount, status, payment_reference, paystack_transaction_id,
    payment_status, paid_at, period_start, period_end, created_by, metadata
  ) VALUES (
    v_checkout.school_id, v_checkout.plan_id, v_checkout.billing_cycle,
    coalesce(p_amount, v_checkout.amount), 'completed', p_reference, p_paystack_transaction_id,
    p_payment_status, now(), now(), v_period_end, v_checkout.created_by,
    jsonb_build_object('billing_cycle', v_checkout.billing_cycle));
  UPDATE public.platform_subscription_checkouts SET consumed_at = now() WHERE reference = p_reference;
  INSERT INTO public.school_subscriptions (
    school_id, plan_id, status, billing_cycle, started_at, expires_at,
    grace_period_ends_at, reminder_day, locked_at, amount_paid, payment_reference,
    paystack_transaction_id, storage_limit_mb, renewed_at, updated_at
  ) VALUES (
    v_checkout.school_id, v_checkout.plan_id, 'active', v_checkout.billing_cycle,
    now(), v_period_end, NULL, 0, NULL, coalesce(p_amount, v_checkout.amount),
    p_reference, p_paystack_transaction_id, v_plan.max_storage_gb * 1024, now(), now()
  ) ON CONFLICT (school_id) DO UPDATE SET
    plan_id = EXCLUDED.plan_id, status = 'active', billing_cycle = EXCLUDED.billing_cycle,
    started_at = EXCLUDED.started_at, expires_at = EXCLUDED.expires_at,
    grace_period_ends_at = NULL, reminder_day = 0, locked_at = NULL,
    amount_paid = EXCLUDED.amount_paid, payment_reference = EXCLUDED.payment_reference,
    paystack_transaction_id = EXCLUDED.paystack_transaction_id,
    storage_limit_mb = EXCLUDED.storage_limit_mb, renewed_at = now(), updated_at = now();
  PERFORM public.apply_subscription_plan_to_school_internal(v_checkout.school_id, v_checkout.plan_id);
  PERFORM public.log_subscription_audit(v_checkout.school_id,
    CASE WHEN v_checkout.consumed_at IS NULL THEN 'new_subscription' ELSE 'renewal' END,
    jsonb_build_object('plan_id', v_checkout.plan_id, 'billing_cycle', v_checkout.billing_cycle,
      'amount', coalesce(p_amount, v_checkout.amount), 'period_end', v_period_end),
    p_reference, v_checkout.created_by);
  RETURN jsonb_build_object('ok', true, 'school_id', v_checkout.school_id, 'expires_at', v_period_end);
END; $$;

CREATE OR REPLACE FUNCTION public.school_subscription_writable(p_school_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_access jsonb;
BEGIN
  IF public.is_platform_super_admin() THEN RETURN true; END IF;
  v_access := public.get_organization_subscription_access(p_school_id);
  IF (v_access->>'access_state') = 'legacy' THEN RETURN true; END IF;
  RETURN coalesce((v_access->>'can_use_platform')::boolean, false);
END; $$;

CREATE OR REPLACE FUNCTION public.school_has_platform_module(p_school_id uuid, p_module_key text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_enforced boolean; v_enabled boolean; v_access jsonb;
BEGIN
  IF public.is_platform_super_admin() THEN RETURN true; END IF;
  v_access := public.get_organization_subscription_access(p_school_id);
  IF (v_access->>'has_subscription_row')::boolean = true
     AND coalesce((v_access->>'can_use_platform')::boolean, false) = false THEN RETURN false; END IF;
  v_enforced := public.school_subscription_enforced(p_school_id);
  IF NOT v_enforced THEN RETURN true; END IF;
  SELECT e.enabled INTO v_enabled FROM public.school_module_entitlements e
  WHERE e.school_id = p_school_id AND e.module_key = p_module_key;
  RETURN coalesce(v_enabled, false);
END; $$;

ALTER TABLE public.organization_subscription_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_subscription_checkouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "school admin read own subscription payments" ON public.organization_subscription_payments;
CREATE POLICY "school admin read own subscription payments" ON public.organization_subscription_payments FOR SELECT TO authenticated
  USING (school_id IN (SELECT p.school_id FROM public.profiles p WHERE p.id = auth.uid()) OR public.is_platform_super_admin());

DROP POLICY IF EXISTS "school admin read own subscription audit" ON public.subscription_audit_log;
CREATE POLICY "school admin read own subscription audit" ON public.subscription_audit_log FOR SELECT TO authenticated
  USING (school_id IN (SELECT p.school_id FROM public.profiles p WHERE p.id = auth.uid()) OR public.is_platform_super_admin());

DROP POLICY IF EXISTS "school admin read own checkouts" ON public.platform_subscription_checkouts;
CREATE POLICY "school admin read own checkouts" ON public.platform_subscription_checkouts FOR SELECT TO authenticated
  USING (school_id IN (SELECT p.school_id FROM public.profiles p WHERE p.id = auth.uid()) OR public.is_platform_super_admin());

GRANT EXECUTE ON FUNCTION public.get_organization_subscription_access(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_subscription_audit(uuid, text, jsonb, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.activate_organization_subscription(text, text, numeric, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.school_subscription_writable(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.school_has_platform_module(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_subscription_plan_to_school(uuid, uuid, public.subscription_status, timestamptz) TO authenticated;

-- Admin signup handler: no admin key required, creates pending subscription
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_school_id uuid; v_school_code text; v_school_name text; v_school_id_meta text;
  v_role public.app_role; v_super_admin_key text; v_registration_number text;
  v_gender text; v_phone text; v_admission_prefix text; v_full_name text;
BEGIN
  v_role := (NEW.raw_user_meta_data->>'role')::public.app_role;
  v_school_code := NULLIF(trim(NEW.raw_user_meta_data->>'school_code'), '');
  v_school_id_meta := NULLIF(trim(NEW.raw_user_meta_data->>'school_id'), '');
  v_registration_number := NULLIF(trim(NEW.raw_user_meta_data->>'registration_number'), '');
  v_gender := NULLIF(trim(NEW.raw_user_meta_data->>'gender'), '');
  v_phone := NULLIF(trim(NEW.raw_user_meta_data->>'phone'), '');
  v_admission_prefix := NULLIF(trim(NEW.raw_user_meta_data->>'admission_prefix'), '');
  v_full_name := NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), '');

  IF v_role = 'super_admin' THEN
    SELECT decrypted_secret INTO v_super_admin_key FROM vault.decrypted_secrets WHERE name = 'SUPER_ADMIN' LIMIT 1;
    IF NEW.raw_user_meta_data->>'admin_key' IS DISTINCT FROM v_super_admin_key THEN
      RAISE EXCEPTION 'Invalid super admin key'; END IF;
    INSERT INTO public.profiles (id, email, full_name, school_id) VALUES (NEW.id, NEW.email, v_full_name, NULL);
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, v_role);
    RETURN NEW;
  END IF;

  IF v_role = 'admin' THEN
    v_school_name := NEW.raw_user_meta_data->>'school_name';
    IF v_school_code IS NULL OR v_school_name IS NULL THEN
      RAISE EXCEPTION 'School name and school code are required'; END IF;
    IF EXISTS (SELECT 1 FROM public.schools WHERE school_code = upper(v_school_code)) THEN
      RAISE EXCEPTION 'School code already exists. Please choose a different code.'; END IF;
    INSERT INTO public.schools (school_code, school_name, is_active, admission_prefix)
    VALUES (upper(v_school_code), v_school_name, true,
      upper(coalesce(v_admission_prefix,
        CASE WHEN length(regexp_replace(coalesce(v_school_name, ''), '[^a-zA-Z]', '', 'g')) >= 3 THEN
          substring(regexp_replace(coalesce(v_school_name, ''), '[^a-zA-Z]', '', 'g') from 1 for 3)
        WHEN length(regexp_replace(coalesce(v_school_name, ''), '[^a-zA-Z0-9]', '', 'g')) >= 3 THEN
          substring(regexp_replace(coalesce(v_school_name, ''), '[^a-zA-Z0-9]', '', 'g') from 1 for 3)
        ELSE upper(left(coalesce(v_school_code, 'SCH'), 3)) END)))
    RETURNING id INTO v_school_id;
    INSERT INTO public.school_subscriptions (school_id, status, read_only_on_expiry, block_login_on_expiry)
    VALUES (v_school_id, 'pending', true, false);
    PERFORM public.log_subscription_audit(v_school_id, 'organization_registered',
      jsonb_build_object('school_code', upper(v_school_code), 'admin_user_id', NEW.id), NULL, NEW.id);
  ELSE
    IF v_school_id_meta IS NOT NULL THEN
      SELECT id INTO v_school_id FROM public.schools WHERE id = v_school_id_meta::uuid AND is_active = true; END IF;
    IF v_school_id IS NULL AND v_school_code IS NOT NULL THEN
      SELECT id INTO v_school_id FROM public.schools WHERE school_code = upper(v_school_code) AND is_active = true; END IF;
    IF v_school_id IS NULL THEN
      RAISE EXCEPTION 'Could not determine school for this account. Use a valid admission number or contact your school.'; END IF;
  END IF;

  INSERT INTO public.profiles (id, email, full_name, school_id, phone) VALUES (NEW.id, NEW.email, v_full_name, v_school_id, v_phone);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, v_role);

  IF v_role = 'student' THEN
    INSERT INTO public.students (user_id, school_id, admission_no, admission_number, gender, full_name)
    VALUES (NEW.id, v_school_id, v_registration_number, v_registration_number, v_gender, v_full_name);
  ELSIF v_role = 'teacher' THEN
    INSERT INTO public.teachers (user_id, school_id, employee_no) VALUES (NEW.id, v_school_id, v_registration_number);
  ELSIF v_role = 'parent' THEN
    INSERT INTO public.parents (user_id, school_id, phone) VALUES (NEW.id, v_school_id, v_phone);
  END IF;
  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN RAISE EXCEPTION 'This admission or employee number is already registered.';
  WHEN OTHERS THEN RAISE EXCEPTION 'Signup failed: %', SQLERRM;
END; $$;

-- Reminders + complimentary grant
CREATE OR REPLACE FUNCTION public.notify_school_admins_subscription(
  p_school_id uuid, p_title text, p_body text, p_data jsonb DEFAULT '{}'::jsonb
) RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count int := 0;
BEGIN
  INSERT INTO public.notifications (user_id, title, body, data, read)
  SELECT p.id, p_title, p_body, p_data, false FROM public.profiles p
  INNER JOIN public.user_roles ur ON ur.user_id = p.id
  WHERE p.school_id = p_school_id AND ur.role = 'admin';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END; $$;

CREATE OR REPLACE FUNCTION public.grant_complimentary_subscription(
  p_school_id uuid, p_plan_id uuid, p_billing_cycle text DEFAULT 'annual',
  p_expires_at timestamptz DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_plan public.subscription_plans%ROWTYPE; v_period_end timestamptz; v_cycle text;
BEGIN
  IF NOT public.is_platform_super_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Forbidden'); END IF;
  SELECT * INTO v_plan FROM public.subscription_plans WHERE id = p_plan_id AND is_active = true;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Plan not found'); END IF;
  v_cycle := CASE WHEN p_billing_cycle = 'monthly' THEN 'monthly' ELSE 'annual' END;
  v_period_end := coalesce(p_expires_at,
    CASE v_cycle WHEN 'monthly' THEN now() + interval '30 days' ELSE now() + interval '365 days' END);
  INSERT INTO public.school_subscriptions (
    school_id, plan_id, status, billing_cycle, started_at, expires_at,
    grace_period_ends_at, reminder_day, locked_at, amount_paid,
    storage_limit_mb, renewed_at, updated_at
  ) VALUES (p_school_id, p_plan_id, 'active', v_cycle, now(), v_period_end,
    NULL, 0, NULL, 0, v_plan.max_storage_gb * 1024, now(), now())
  ON CONFLICT (school_id) DO UPDATE SET
    plan_id = EXCLUDED.plan_id, status = 'active', billing_cycle = EXCLUDED.billing_cycle,
    started_at = EXCLUDED.started_at, expires_at = EXCLUDED.expires_at,
    grace_period_ends_at = NULL, reminder_day = 0, locked_at = NULL,
    amount_paid = 0, storage_limit_mb = EXCLUDED.storage_limit_mb,
    renewed_at = now(), updated_at = now();
  PERFORM public.apply_subscription_plan_to_school_internal(p_school_id, p_plan_id);
  PERFORM public.log_subscription_audit(p_school_id, 'complimentary_grant',
    jsonb_build_object('plan_id', p_plan_id, 'billing_cycle', v_cycle, 'expires_at', v_period_end), NULL, auth.uid());
  RETURN jsonb_build_object('ok', true, 'expires_at', v_period_end);
END; $$;

CREATE OR REPLACE FUNCTION public.run_subscription_lifecycle_batch()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_sub record; v_now timestamptz := now(); v_grace interval := interval '3 days';
  v_locked int := 0; v_reminded int := 0; v_expired int := 0;
  v_notifications jsonb := '[]'::jsonb; v_day int; v_title text; v_body text; v_admin record;
BEGIN
  FOR v_sub IN
    SELECT ss.*, s.school_name FROM public.school_subscriptions ss
    JOIN public.schools s ON s.id = ss.school_id
    WHERE ss.status IN ('active', 'expired')
       OR (ss.expires_at IS NOT NULL AND ss.expires_at <= v_now AND ss.status <> 'locked')
  LOOP
    IF v_sub.expires_at IS NOT NULL AND v_sub.expires_at <= v_now THEN
      IF v_sub.grace_period_ends_at IS NULL THEN
        v_title := 'Subscription expired';
        v_body := format('Your subscription for %s expired on %s. Renew within 3 days to avoid account lock.',
          v_sub.school_name, to_char(v_sub.expires_at, 'Mon DD, YYYY'));
        UPDATE public.school_subscriptions SET status = 'expired',
          grace_period_ends_at = v_sub.expires_at + v_grace, reminder_day = 1, updated_at = v_now
        WHERE school_id = v_sub.school_id;
        PERFORM public.notify_school_admins_subscription(v_sub.school_id, v_title, v_body,
          jsonb_build_object('type', 'expiry', 'school_id', v_sub.school_id));
        PERFORM public.log_subscription_audit(v_sub.school_id, 'expiry',
          jsonb_build_object('school_name', v_sub.school_name));
        FOR v_admin IN SELECT p.email, p.phone, p.full_name FROM public.profiles p
          INNER JOIN public.user_roles ur ON ur.user_id = p.id
          WHERE p.school_id = v_sub.school_id AND ur.role = 'admin'
        LOOP
          v_notifications := v_notifications || jsonb_build_object(
            'school_id', v_sub.school_id, 'school_name', v_sub.school_name,
            'type', 'expiry', 'day', 1, 'email', v_admin.email, 'phone', v_admin.phone,
            'admin_name', v_admin.full_name, 'title', v_title, 'body', v_body);
        END LOOP;
        v_expired := v_expired + 1;
      ELSIF v_now > v_sub.grace_period_ends_at THEN
        v_title := 'Account locked';
        v_body := format('Your organization %s has been locked after the grace period. Renew your subscription to restore access.', v_sub.school_name);
        UPDATE public.school_subscriptions SET status = 'locked', locked_at = v_now, updated_at = v_now
        WHERE school_id = v_sub.school_id;
        PERFORM public.notify_school_admins_subscription(v_sub.school_id, v_title, v_body,
          jsonb_build_object('type', 'account_lock', 'school_id', v_sub.school_id));
        PERFORM public.log_subscription_audit(v_sub.school_id, 'account_lock',
          jsonb_build_object('reason', 'grace_period_ended'));
        FOR v_admin IN SELECT p.email, p.phone, p.full_name FROM public.profiles p
          INNER JOIN public.user_roles ur ON ur.user_id = p.id
          WHERE p.school_id = v_sub.school_id AND ur.role = 'admin'
        LOOP
          v_notifications := v_notifications || jsonb_build_object(
            'school_id', v_sub.school_id, 'school_name', v_sub.school_name,
            'type', 'account_lock', 'email', v_admin.email, 'phone', v_admin.phone,
            'admin_name', v_admin.full_name, 'title', v_title, 'body', v_body);
        END LOOP;
        v_locked := v_locked + 1;
      ELSIF v_sub.reminder_day < 3 THEN
        v_day := coalesce(v_sub.reminder_day, 0) + 1;
        IF v_day >= 3 THEN
          v_title := 'Final subscription reminder';
          v_body := format('Final reminder: %s will be locked tomorrow if subscription payment is not received.', v_sub.school_name);
        ELSE
          v_title := format('Subscription reminder (day %s of 3)', v_day);
          v_body := format('Your subscription for %s is in grace period. Please renew to keep access.', v_sub.school_name);
        END IF;
        UPDATE public.school_subscriptions SET reminder_day = v_day, updated_at = v_now
        WHERE school_id = v_sub.school_id;
        PERFORM public.notify_school_admins_subscription(v_sub.school_id, v_title, v_body,
          jsonb_build_object('type', 'reminder', 'day', v_day, 'school_id', v_sub.school_id));
        PERFORM public.log_subscription_audit(v_sub.school_id, 'reminder', jsonb_build_object('day', v_day));
        FOR v_admin IN SELECT p.email, p.phone, p.full_name FROM public.profiles p
          INNER JOIN public.user_roles ur ON ur.user_id = p.id
          WHERE p.school_id = v_sub.school_id AND ur.role = 'admin'
        LOOP
          v_notifications := v_notifications || jsonb_build_object(
            'school_id', v_sub.school_id, 'school_name', v_sub.school_name,
            'type', 'reminder', 'day', v_day, 'email', v_admin.email, 'phone', v_admin.phone,
            'admin_name', v_admin.full_name, 'title', v_title, 'body', v_body);
        END LOOP;
        v_reminded := v_reminded + 1;
      END IF;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('ok', true, 'expired', v_expired, 'reminded', v_reminded,
    'locked', v_locked, 'notifications', v_notifications);
END; $$;

GRANT EXECUTE ON FUNCTION public.notify_school_admins_subscription(uuid, text, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.grant_complimentary_subscription(uuid, uuid, text, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.run_subscription_lifecycle_batch() TO service_role;

-- Grant-all-modules helper (super admin one-click)
CREATE OR REPLACE FUNCTION public.grant_all_school_module_entitlements(p_school_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_platform_super_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Forbidden'); END IF;
  INSERT INTO public.school_module_entitlements (
    school_id, module_key, enabled, can_read, can_create, can_edit, can_delete, can_export, updated_by, updated_at
  ) SELECT p_school_id, pm.module_key, true, true, true, true, true, true, auth.uid(), now()
  FROM public.platform_modules pm
  ON CONFLICT (school_id, module_key) DO UPDATE SET
    enabled = true, can_read = true, can_create = true, can_edit = true,
    can_delete = true, can_export = true, updated_by = auth.uid(), updated_at = now();
  RETURN jsonb_build_object('ok', true);
END; $$;
GRANT EXECUTE ON FUNCTION public.grant_all_school_module_entitlements(uuid) TO authenticated;

-- Backfill: grant ALL modules to every existing school so admins get full access
INSERT INTO public.school_module_entitlements (
  school_id, module_key, enabled, can_read, can_create, can_edit, can_delete, can_export, updated_at
) SELECT s.id, pm.module_key, true, true, true, true, true, true, now()
FROM public.schools s CROSS JOIN public.platform_modules pm
ON CONFLICT (school_id, module_key) DO UPDATE SET
  enabled = true, can_read = true, can_create = true, can_edit = true,
  can_delete = true, can_export = true, updated_at = now();

NOTIFY pgrst, 'reload schema';