-- Fix: Super Admin "Grant all modules" must persist and reflect on school admin portal.
-- 1) entitlements_override prevents auto-heal from re-applying a limited plan over full access
-- 2) grant_all_school_module_entitlements syncs RBAC and sets override flag

ALTER TABLE public.school_subscriptions
  ADD COLUMN IF NOT EXISTS entitlements_override boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.school_subscriptions.entitlements_override IS
  'When true, skip automatic plan re-sync that would reduce module entitlements (set by grant_all_school_module_entitlements).';

CREATE OR REPLACE FUNCTION public.grant_all_school_module_entitlements(p_school_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_super_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Forbidden');
  END IF;

  INSERT INTO public.school_module_entitlements (
    school_id,
    module_key,
    enabled,
    can_read,
    can_create,
    can_edit,
    can_delete,
    can_export,
    updated_by,
    updated_at
  )
  SELECT
    p_school_id,
    pm.module_key,
    true,
    true,
    true,
    true,
    true,
    true,
    auth.uid(),
    now()
  FROM public.platform_modules pm
  ON CONFLICT (school_id, module_key) DO UPDATE SET
    enabled = true,
    can_read = true,
    can_create = true,
    can_edit = true,
    can_delete = true,
    can_export = true,
    updated_by = auth.uid(),
    updated_at = now();

  PERFORM public.sync_school_rbac_to_entitlements(p_school_id);

  UPDATE public.school_subscriptions
  SET entitlements_override = true,
      updated_at = now()
  WHERE school_id = p_school_id;

  RETURN jsonb_build_object('ok', true, 'entitlements_override', true);
END;
$$;

-- Manual plan sync / refresh clears override so plan defaults apply again
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

  UPDATE public.school_subscriptions
  SET entitlements_override = false,
      updated_at = now()
  WHERE school_id = p_school_id;

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

  -- Respect Super Admin full-access grant; do not downgrade entitlements automatically
  IF coalesce(v_sub.entitlements_override, false) THEN
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
      'entitlements_override', true,
      'enabled_count', v_enabled_count,
      'skipped', 'Full access override active'
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

GRANT EXECUTE ON FUNCTION public.grant_all_school_module_entitlements(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_organization_subscription_modules(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
