-- Complete platform module catalog + resync counts when plan has more modules than school entitlements.

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
