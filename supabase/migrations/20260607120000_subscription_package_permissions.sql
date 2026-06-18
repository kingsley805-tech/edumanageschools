-- Subscription package permission management: full portal catalog, RBAC sync, plan reapply

-- ---------------------------------------------------------------------------
-- Expand platform module catalog (maps to portal RBAC pages)
-- ---------------------------------------------------------------------------
INSERT INTO public.platform_modules (module_key, category, label, portal_module_key, sort_order) VALUES
  ('dashboard', 'academic', 'Dashboard', 'dashboard', 5),
  ('grade_scales', 'academic', 'Grade Scales', 'grade_scales', 75),
  ('report_archive', 'academic', 'Report Archive', 'report_archive', 135),
  ('report_settings', 'academic', 'Report Settings', 'report_settings', 145),
  ('billing_family', 'financial', 'Family Billing', 'billing_family', 265),
  ('billing_paid', 'financial', 'Paid Students', 'billing_paid', 270),
  ('billing_outstanding', 'financial', 'Outstanding Balances', 'billing_outstanding', 275),
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

-- Do not overwrite custom plan modules here — configure packages in Platform → Subscription Plans.

-- ---------------------------------------------------------------------------
-- Strip staff role permissions for portal modules not in the school's package
-- ---------------------------------------------------------------------------
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

  DELETE FROM public.role_permissions rp
  USING public.roles r, public.permissions p
  WHERE rp.role_id = r.id
    AND rp.permission_id = p.id
    AND r.school_id = p_school_id
    AND p.code LIKE 'portal.%'
    AND NOT (split_part(p.code, '.', 2) = ANY (v_enabled_keys));
END;
$$;

-- ---------------------------------------------------------------------------
-- Apply plan modules to a school (internal — payment + super-admin flows)
-- ---------------------------------------------------------------------------
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
  v_modules jsonb;
BEGIN
  SELECT * INTO v_plan FROM public.subscription_plans WHERE id = p_plan_id;
  IF NOT FOUND THEN RETURN; END IF;

  v_modules := v_plan.default_modules;

  UPDATE public.school_module_entitlements e
  SET enabled = false, can_read = false, can_create = false, can_edit = false,
      can_delete = false, can_export = false, updated_at = now()
  WHERE e.school_id = p_school_id;

  FOR v_mod IN SELECT jsonb_array_elements_text(v_modules)
  LOOP
    INSERT INTO public.school_module_entitlements (
      school_id, module_key, enabled, can_read, can_create, can_edit, can_delete, can_export, updated_at
    ) VALUES (
      p_school_id, v_mod, true, true, true, true, true, true, now()
    )
    ON CONFLICT (school_id, module_key) DO UPDATE SET
      enabled = true, can_read = true, can_create = true, can_edit = true,
      can_delete = true, can_export = true, updated_at = now();
  END LOOP;

  PERFORM public.sync_school_rbac_to_entitlements(p_school_id);
END;
$$;

-- ---------------------------------------------------------------------------
-- Reapply plan modules to all schools on a plan (after Super Admin edits package)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reapply_subscription_plan_modules(p_plan_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int := 0;
  v_school uuid;
BEGIN
  IF NOT public.is_platform_super_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Forbidden');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.subscription_plans WHERE id = p_plan_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Plan not found');
  END IF;

  FOR v_school IN
    SELECT ss.school_id
    FROM public.school_subscriptions ss
    WHERE ss.plan_id = p_plan_id
      AND ss.status IN ('active', 'trial', 'pending')
  LOOP
    PERFORM public.apply_subscription_plan_to_school_internal(v_school, p_plan_id);
    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'schools_updated', v_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_school_rbac_to_entitlements(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reapply_subscription_plan_modules(uuid) TO authenticated;

-- Sync staff RBAC when Super Admin manually edits tenant entitlement matrix
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

  PERFORM public.sync_school_rbac_to_entitlements(p_school_id);

  RETURN jsonb_build_object('ok', true);
END;
$$;
