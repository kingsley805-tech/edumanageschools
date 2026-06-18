-- Fix subscription module access after payment: resolve plan keys, grant admin RBAC, self-heal RPC, trial access.
-- Run in Supabase SQL Editor after apply-subscription-package-permissions.sql

-- Ensure every admin sidebar page has a platform_modules row (portal_module_key required for gating).
INSERT INTO public.platform_modules (module_key, category, label, portal_module_key, sort_order) VALUES
  ('dashboard', 'academic', 'Dashboard', 'dashboard', 5),
  ('students', 'academic', 'Student Management', 'students', 10),
  ('admissions', 'academic', 'Admissions', 'pending_users', 20),
  ('teachers', 'academic', 'Teachers', 'teachers', 30),
  ('parents', 'academic', 'Parents', 'parent_contacts', 40),
  ('classes', 'academic', 'Classes', 'classes', 50),
  ('subjects', 'academic', 'Subjects', 'subjects', 60),
  ('timetable', 'academic', 'Timetable', 'timetable', 70),
  ('grade_scales', 'academic', 'Grade Scales', 'grade_scales', 75),
  ('lesson_notes', 'academic', 'Lesson Notes', 'lesson_notes', 80),
  ('attendance', 'academic', 'Attendance', 'attendance', 90),
  ('class_registers', 'academic', 'Class Registers', 'class_registers', 95),
  ('results', 'academic', 'Results', 'result_scores', 120),
  ('report_cards', 'academic', 'Report Cards', 'report_cards', 130),
  ('report_archive', 'academic', 'Report Archive', 'report_archive', 135),
  ('academic_reports', 'academic', 'Academic Reports', 'academic_reports', 140),
  ('report_settings', 'academic', 'Report Settings', 'report_settings', 145),
  ('billing', 'financial', 'Billing', 'billing_overview', 200),
  ('fee_management', 'financial', 'Fee Management', 'billing_fees', 210),
  ('invoicing', 'financial', 'Invoicing', 'billing_invoices', 220),
  ('payments', 'financial', 'Payments', 'billing_payments', 230),
  ('online_payments', 'financial', 'Online Payments', 'billing_payment_gateways', 240),
  ('financial_reports', 'financial', 'Financial Reports', 'billing_reports', 260),
  ('billing_family', 'financial', 'Family Billing', 'billing_family', 265),
  ('billing_paid', 'financial', 'Paid Students', 'billing_paid', 270),
  ('billing_outstanding', 'financial', 'Outstanding Balances', 'billing_outstanding', 275),
  ('payroll', 'hr', 'Payroll', 'billing_payroll', 410),
  ('announcements', 'communication', 'Announcements', 'announcements', 340),
  ('number_generator', 'registration', 'Number Generator', 'number_generator', 350),
  ('parent_student_link', 'registration', 'Parent–Student Link', 'parent_student_link', 360),
  ('teacher_class_link', 'registration', 'Teacher–Class Link', 'teacher_class_link', 370),
  ('school_settings', 'administration', 'School Settings', 'school_settings', 900),
  ('staff_access', 'administration', 'Permission Management', 'staff_access', 910),
  ('approvals', 'administration', 'Approvals', 'approvals', 920),
  ('audit_logs', 'administration', 'Audit Logs', 'audit_logs', 930)
ON CONFLICT (module_key) DO UPDATE SET
  label = EXCLUDED.label,
  category = EXCLUDED.category,
  portal_module_key = EXCLUDED.portal_module_key,
  sort_order = EXCLUDED.sort_order;

CREATE OR REPLACE FUNCTION public.resolve_platform_module_key(p_key text)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT coalesce(
    (
      SELECT pm.module_key
      FROM public.platform_modules pm
      WHERE pm.module_key = p_key
      ORDER BY pm.sort_order
      LIMIT 1
    ),
    (
      SELECT pm.module_key
      FROM public.platform_modules pm
      WHERE pm.portal_module_key = p_key
      ORDER BY CASE WHEN pm.module_key = p_key THEN 0 ELSE 1 END, pm.sort_order
      LIMIT 1
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.sync_school_rbac_to_entitlements(p_school_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enabled_keys text[];
  v_exempt text[] := ARRAY['organization_subscription', 'account_settings'];
BEGIN
  SELECT coalesce(array_agg(DISTINCT pm.portal_module_key), ARRAY[]::text[])
  INTO v_enabled_keys
  FROM public.school_module_entitlements e
  JOIN public.platform_modules pm ON pm.module_key = e.module_key
  WHERE e.school_id = p_school_id
    AND e.enabled = true
    AND pm.portal_module_key IS NOT NULL;

  v_enabled_keys := v_enabled_keys || v_exempt;

  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT DISTINCT r.id, p.id
  FROM public.roles r
  JOIN public.permissions p ON p.code LIKE 'portal.%'
  WHERE r.school_id = p_school_id
    AND r.slug IN ('school_admin', 'admin')
    AND split_part(p.code, '.', 2) = ANY (v_enabled_keys)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT DISTINCT r.id, p.id
  FROM public.roles r
  JOIN public.permissions p ON p.code LIKE 'portal.%'
  WHERE r.school_id IS NULL
    AND r.slug = 'school_admin'
    AND split_part(p.code, '.', 2) = ANY (v_enabled_keys)
  ON CONFLICT DO NOTHING;

  DELETE FROM public.role_permissions rp
  USING public.roles r, public.permissions p
  WHERE rp.role_id = r.id
    AND rp.permission_id = p.id
    AND r.school_id = p_school_id
    AND p.code LIKE 'portal.%'
    AND NOT (split_part(p.code, '.', 2) = ANY (v_enabled_keys));
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_subscription_plan_to_school_internal(
  p_school_id uuid,
  p_plan_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan public.subscription_plans%ROWTYPE;
  v_mod text;
  v_resolved text;
  v_modules jsonb;
BEGIN
  SELECT * INTO v_plan FROM public.subscription_plans WHERE id = p_plan_id;
  IF NOT FOUND THEN RETURN; END IF;

  v_modules := v_plan.default_modules;

  UPDATE public.school_module_entitlements e
  SET enabled = false, can_read = false, can_create = false, can_edit = false,
      can_delete = false, can_export = false, updated_at = now()
  WHERE e.school_id = p_school_id;

  FOR v_mod IN SELECT DISTINCT jsonb_array_elements_text(v_modules)
  LOOP
    v_resolved := public.resolve_platform_module_key(v_mod);
    IF v_resolved IS NULL THEN
      CONTINUE;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.platform_modules pm WHERE pm.module_key = v_resolved
    ) THEN
      CONTINUE;
    END IF;

    INSERT INTO public.school_module_entitlements (
      school_id, module_key, enabled, can_read, can_create, can_edit, can_delete, can_export, updated_at
    ) VALUES (
      p_school_id, v_resolved, true, true, true, true, true, true, now()
    )
    ON CONFLICT (school_id, module_key) DO UPDATE SET
      enabled = true, can_read = true, can_create = true, can_edit = true,
      can_delete = true, can_export = true, updated_at = now();
  END LOOP;

  PERFORM public.sync_school_rbac_to_entitlements(p_school_id);
  PERFORM public.sync_school_sms_entitlement(p_school_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_organization_subscription_modules(p_school_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school_id uuid := p_school_id;
  v_sub public.school_subscriptions%ROWTYPE;
  v_plan_modules jsonb;
  v_plan_module_count int := 0;
  v_enabled_count int := 0;
BEGIN
  IF v_school_id IS NULL THEN
    SELECT p.school_id INTO v_school_id
    FROM public.profiles p
    WHERE p.id = auth.uid();
  END IF;

  IF v_school_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'School not found');
  END IF;

  IF NOT public.is_platform_super_admin()
     AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Forbidden');
  END IF;

  IF public.has_role(auth.uid(), 'admin'::app_role)
     AND NOT public.is_platform_super_admin() THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.school_id = v_school_id
    ) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Forbidden');
    END IF;
  END IF;

  SELECT * INTO v_sub FROM public.school_subscriptions WHERE school_id = v_school_id;
  IF NOT FOUND OR v_sub.plan_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No subscription plan on file');
  END IF;

  IF v_sub.status NOT IN ('active', 'trial') THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Subscription is not active',
      'status', v_sub.status
    );
  END IF;

  SELECT default_modules INTO v_plan_modules
  FROM public.subscription_plans
  WHERE id = v_sub.plan_id;

  IF v_plan_modules IS NOT NULL AND jsonb_typeof(v_plan_modules) = 'array' THEN
    v_plan_module_count := jsonb_array_length(v_plan_modules);
  END IF;

  PERFORM public.apply_subscription_plan_to_school_internal(v_school_id, v_sub.plan_id);
  PERFORM public.sync_school_sms_entitlement(v_school_id);

  SELECT count(*)::int INTO v_enabled_count
  FROM public.school_module_entitlements e
  JOIN public.platform_modules pm ON pm.module_key = e.module_key
  WHERE e.school_id = v_school_id
    AND e.enabled = true
    AND pm.portal_module_key IS NOT NULL;

  RETURN jsonb_build_object(
    'ok', true,
    'school_id', v_school_id,
    'plan_id', v_sub.plan_id,
    'status', v_sub.status,
    'plan_module_count', v_plan_module_count,
    'enabled_count', v_enabled_count
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_organization_subscription_access(p_school_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub public.school_subscriptions%ROWTYPE;
  v_now timestamptz := now();
  v_days_remaining int;
  v_access_state text;
  v_can_use boolean := false;
  v_expiring_days int := 7;
BEGIN
  IF p_school_id IS NULL THEN
    RETURN jsonb_build_object(
      'has_subscription_row', false,
      'access_state', 'legacy',
      'can_use_platform', true
    );
  END IF;

  SELECT * INTO v_sub FROM public.school_subscriptions WHERE school_id = p_school_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'has_subscription_row', false,
      'access_state', 'legacy',
      'can_use_platform', true
    );
  END IF;

  v_days_remaining := CASE
    WHEN v_sub.expires_at IS NULL THEN NULL
    ELSE greatest(0, (date(v_sub.expires_at) - date(v_now))::int)
  END;

  IF v_sub.status = 'pending' OR (v_sub.status IN ('pending', 'trial') AND v_sub.plan_id IS NULL) THEN
    v_access_state := 'pending_payment';
    v_can_use := false;
  ELSIF v_sub.status = 'locked' OR v_sub.status = 'suspended' THEN
    v_access_state := 'locked';
    v_can_use := false;
  ELSIF v_sub.status IN ('active', 'trial')
    AND v_sub.plan_id IS NOT NULL
    AND (v_sub.expires_at IS NULL OR v_sub.expires_at > v_now) THEN
    IF v_days_remaining IS NOT NULL AND v_days_remaining <= v_expiring_days THEN
      v_access_state := 'expiring_soon';
    ELSE
      v_access_state := 'active';
    END IF;
    v_can_use := true;
  ELSIF v_sub.status = 'expired' OR (v_sub.expires_at IS NOT NULL AND v_sub.expires_at <= v_now) THEN
    IF v_sub.grace_period_ends_at IS NOT NULL AND v_now <= v_sub.grace_period_ends_at THEN
      v_access_state := 'expired_grace';
      v_can_use := coalesce(v_sub.read_only_on_expiry, true) = false;
    ELSE
      v_access_state := 'locked';
      v_can_use := false;
    END IF;
  ELSIF v_sub.status = 'cancelled' THEN
    v_access_state := 'locked';
    v_can_use := false;
  ELSE
    v_access_state := 'pending_payment';
    v_can_use := false;
  END IF;

  RETURN jsonb_build_object(
    'has_subscription_row', true,
    'access_state', v_access_state,
    'can_use_platform', v_can_use,
    'status', v_sub.status,
    'plan_id', v_sub.plan_id,
    'billing_cycle', v_sub.billing_cycle,
    'started_at', v_sub.started_at,
    'expires_at', v_sub.expires_at,
    'grace_period_ends_at', v_sub.grace_period_ends_at,
    'reminder_day', v_sub.reminder_day,
    'days_remaining', v_days_remaining,
    'locked_at', v_sub.locked_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_platform_module_key(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_organization_subscription_modules(uuid) TO authenticated;

-- One-shot repair for schools that paid but modules were not applied:
-- SELECT public.sync_organization_subscription_modules(NULL);
