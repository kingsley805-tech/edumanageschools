-- Platform SaaS: subscription plans, tenant entitlements, usage snapshots

DO $$ BEGIN
  CREATE TYPE public.subscription_status AS ENUM (
    'trial', 'active', 'suspended', 'expired', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- Subscription plans (product catalog)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Per-school subscription
-- ---------------------------------------------------------------------------
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

CREATE INDEX IF NOT EXISTS idx_school_subscriptions_status ON public.school_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_school_subscriptions_expires ON public.school_subscriptions(expires_at);

-- ---------------------------------------------------------------------------
-- Platform module catalog (SaaS feature keys)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_modules (
  module_key text PRIMARY KEY,
  category text NOT NULL,
  label text NOT NULL,
  description text,
  portal_module_key text,
  sort_order int NOT NULL DEFAULT 0,
  is_core boolean NOT NULL DEFAULT false
);

-- ---------------------------------------------------------------------------
-- Per-school module entitlements (permission matrix)
-- ---------------------------------------------------------------------------
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

CREATE INDEX IF NOT EXISTS idx_school_module_entitlements_school ON public.school_module_entitlements(school_id);

-- ---------------------------------------------------------------------------
-- Usage snapshots (periodic rollups for monitoring)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Seed platform modules
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Seed subscription plans
-- ---------------------------------------------------------------------------
INSERT INTO public.subscription_plans (slug, name, description, price_monthly, price_annual, max_students, max_teachers, max_storage_gb, sort_order, default_modules)
VALUES
  (
    'basic',
    'Basic Plan',
    'Core academic tracking',
    49, 490, 500, 20, 5, 10,
    '["students","teachers","attendance","report_cards"]'::jsonb
  ),
  (
    'standard',
    'Standard Plan',
    'Academic modules + parent portal + SMS',
    149, 1490, 2000, 100, 20, 20,
    '["students","teachers","parents","classes","subjects","timetable","attendance","class_registers","report_cards","academic_reports","announcements","sms","billing","fee_management","invoicing","payments"]'::jsonb
  ),
  (
    'premium',
    'Premium Plan',
    'Full ERP',
    399, 3990, NULL, NULL, NULL, 30,
    '["students","admissions","teachers","parents","classes","subjects","timetable","lesson_notes","attendance","class_registers","report_cards","academic_reports","billing","fee_management","invoicing","payments","online_payments","paystack","financial_reports","payroll","announcements","sms"]'::jsonb
  ),
  (
    'enterprise',
    'Enterprise Plan',
    'Custom modules and limits',
    0, 0, NULL, NULL, NULL, 40,
    '[]'::jsonb
  )
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  price_annual = EXCLUDED.price_annual,
  max_students = EXCLUDED.max_students,
  max_teachers = EXCLUDED.max_teachers,
  max_storage_gb = EXCLUDED.max_storage_gb,
  default_modules = EXCLUDED.default_modules;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_platform_super_admin(p_uid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(p_uid, 'super_admin'::app_role);
$$;

CREATE OR REPLACE FUNCTION public.school_subscription_enforced(p_school_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.school_subscriptions ss WHERE ss.school_id = p_school_id
  );
$$;

CREATE OR REPLACE FUNCTION public.school_has_platform_module(
  p_school_id uuid,
  p_module_key text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enforced boolean;
  v_enabled boolean;
BEGIN
  IF public.is_platform_super_admin() THEN
    RETURN true;
  END IF;

  v_enforced := public.school_subscription_enforced(p_school_id);
  IF NOT v_enforced THEN
    RETURN true;
  END IF;

  SELECT e.enabled INTO v_enabled
  FROM public.school_module_entitlements e
  WHERE e.school_id = p_school_id AND e.module_key = p_module_key;

  RETURN coalesce(v_enabled, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.school_subscription_writable(p_school_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub public.school_subscriptions%ROWTYPE;
BEGIN
  IF public.is_platform_super_admin() THEN
    RETURN true;
  END IF;

  IF NOT public.school_subscription_enforced(p_school_id) THEN
    RETURN true;
  END IF;

  SELECT * INTO v_sub FROM public.school_subscriptions WHERE school_id = p_school_id;
  IF NOT FOUND THEN
    RETURN true;
  END IF;

  IF v_sub.status IN ('active', 'trial') THEN
    RETURN true;
  END IF;

  IF v_sub.status = 'expired' AND v_sub.read_only_on_expiry THEN
    RETURN false;
  END IF;

  RETURN v_sub.status NOT IN ('suspended', 'expired', 'cancelled');
END;
$$;

-- Apply plan defaults to a school
CREATE OR REPLACE FUNCTION public.apply_subscription_plan_to_school(
  p_school_id uuid,
  p_plan_id uuid,
  p_status public.subscription_status DEFAULT 'active',
  p_expires_at timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan public.subscription_plans%ROWTYPE;
  v_mod text;
  v_modules jsonb;
BEGIN
  IF NOT public.is_platform_super_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Forbidden');
  END IF;

  SELECT * INTO v_plan FROM public.subscription_plans WHERE id = p_plan_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Plan not found');
  END IF;

  INSERT INTO public.school_subscriptions (
    school_id, plan_id, status, expires_at,
    storage_limit_mb, updated_at
  ) VALUES (
    p_school_id, p_plan_id, p_status, p_expires_at,
    v_plan.max_storage_gb * 1024, now()
  )
  ON CONFLICT (school_id) DO UPDATE SET
    plan_id = EXCLUDED.plan_id,
    status = EXCLUDED.status,
    expires_at = EXCLUDED.expires_at,
    storage_limit_mb = EXCLUDED.storage_limit_mb,
    updated_at = now();

  v_modules := v_plan.default_modules;

  UPDATE public.school_module_entitlements e
  SET enabled = false, can_read = false, can_create = false, can_edit = false, can_delete = false, can_export = false, updated_at = now()
  WHERE e.school_id = p_school_id;

  FOR v_mod IN SELECT jsonb_array_elements_text(v_modules)
  LOOP
    INSERT INTO public.school_module_entitlements (
      school_id, module_key, enabled, can_read, can_create, can_edit, can_delete, can_export, updated_at
    ) VALUES (
      p_school_id, v_mod, true, true, true, true, true, true, now()
    )
    ON CONFLICT (school_id, module_key) DO UPDATE SET
      enabled = true, can_read = true, can_create = true, can_edit = true, can_delete = true, can_export = true, updated_at = now();
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'modules_applied', jsonb_array_length(v_modules));
END;
$$;

CREATE OR REPLACE FUNCTION public.save_school_module_entitlements(
  p_school_id uuid,
  p_rows jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row jsonb;
  v_key text;
BEGIN
  IF NOT public.is_platform_super_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Forbidden');
  END IF;

  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    v_key := v_row->>'module_key';
    IF v_key IS NULL THEN
      CONTINUE;
    END IF;
    INSERT INTO public.school_module_entitlements (
      school_id, module_key, enabled, can_read, can_create, can_edit, can_delete, can_export, updated_by, updated_at
    ) VALUES (
      p_school_id,
      v_key,
      coalesce((v_row->>'enabled')::boolean, false),
      coalesce((v_row->>'can_read')::boolean, false),
      coalesce((v_row->>'can_create')::boolean, false),
      coalesce((v_row->>'can_edit')::boolean, false),
      coalesce((v_row->>'can_delete')::boolean, false),
      coalesce((v_row->>'can_export')::boolean, false),
      auth.uid(),
      now()
    )
    ON CONFLICT (school_id, module_key) DO UPDATE SET
      enabled = EXCLUDED.enabled,
      can_read = EXCLUDED.can_read,
      can_create = EXCLUDED.can_create,
      can_edit = EXCLUDED.can_edit,
      can_delete = EXCLUDED.can_delete,
      can_export = EXCLUDED.can_export,
      updated_by = EXCLUDED.updated_by,
      updated_at = now();
  END LOOP;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_platform_super_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.school_has_platform_module(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.school_subscription_writable(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_subscription_plan_to_school(uuid, uuid, public.subscription_status, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_school_module_entitlements(uuid, jsonb) TO authenticated;

-- ---------------------------------------------------------------------------
-- Tenant overview view (monitoring dashboard)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.platform_tenant_overview_v AS
SELECT
  s.id AS school_id,
  s.school_name,
  s.school_code,
  coalesce(s.is_active, true) AS is_active,
  ss.status AS subscription_status,
  sp.slug AS plan_slug,
  sp.name AS plan_name,
  ss.expires_at,
  ss.trial_ends_at,
  ss.storage_used_mb,
  ss.storage_limit_mb,
  (SELECT count(*)::int FROM public.students st WHERE st.school_id = s.id) AS student_count,
  (SELECT count(*)::int FROM public.teachers t WHERE t.school_id = s.id) AS teacher_count,
  (SELECT count(*)::int FROM public.parents p WHERE p.school_id = s.id) AS parent_count,
  (SELECT count(*)::int FROM public.profiles pr WHERE pr.school_id = s.id) AS user_count,
  s.created_at
FROM public.schools s
LEFT JOIN public.school_subscriptions ss ON ss.school_id = s.id
LEFT JOIN public.subscription_plans sp ON sp.id = ss.plan_id;

GRANT SELECT ON public.platform_tenant_overview_v TO authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_module_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_usage_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super admin manage subscription plans" ON public.subscription_plans;
CREATE POLICY "super admin manage subscription plans" ON public.subscription_plans
  FOR ALL TO authenticated
  USING (public.is_platform_super_admin())
  WITH CHECK (public.is_platform_super_admin());

DROP POLICY IF EXISTS "authenticated read subscription plans" ON public.subscription_plans;
CREATE POLICY "authenticated read subscription plans" ON public.subscription_plans
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "super admin manage school subscriptions" ON public.school_subscriptions;
CREATE POLICY "super admin manage school subscriptions" ON public.school_subscriptions
  FOR ALL TO authenticated
  USING (public.is_platform_super_admin())
  WITH CHECK (public.is_platform_super_admin());

DROP POLICY IF EXISTS "school read own subscription" ON public.school_subscriptions;
CREATE POLICY "school read own subscription" ON public.school_subscriptions
  FOR SELECT TO authenticated
  USING (school_id = public.get_user_school_id(auth.uid()));

DROP POLICY IF EXISTS "read platform modules" ON public.platform_modules;
CREATE POLICY "read platform modules" ON public.platform_modules
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "super admin manage entitlements" ON public.school_module_entitlements;
CREATE POLICY "super admin manage entitlements" ON public.school_module_entitlements
  FOR ALL TO authenticated
  USING (public.is_platform_super_admin())
  WITH CHECK (public.is_platform_super_admin());

DROP POLICY IF EXISTS "school read own entitlements" ON public.school_module_entitlements;
CREATE POLICY "school read own entitlements" ON public.school_module_entitlements
  FOR SELECT TO authenticated
  USING (school_id = public.get_user_school_id(auth.uid()));

DROP POLICY IF EXISTS "super admin usage snapshots" ON public.school_usage_snapshots;
CREATE POLICY "super admin usage snapshots" ON public.school_usage_snapshots
  FOR ALL TO authenticated
  USING (public.is_platform_super_admin())
  WITH CHECK (public.is_platform_super_admin());

NOTIFY pgrst, 'reload schema';
