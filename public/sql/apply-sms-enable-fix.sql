-- SMS works when Parent SMS Notifications (sms_enabled) is on at checkout or via Super Admin.
-- Run in Supabase SQL Editor after apply-sms-subscription-billing.sql and apply-subscription-package-full-config.sql

CREATE OR REPLACE FUNCTION public.school_sms_service_active(p_school_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub public.school_subscriptions%ROWTYPE;
BEGIN
  IF public.is_platform_super_admin() THEN RETURN true; END IF;

  SELECT * INTO v_sub FROM public.school_subscriptions WHERE school_id = p_school_id;
  IF NOT FOUND THEN RETURN true; END IF;

  IF coalesce(v_sub.sms_admin_override, false) OR coalesce(v_sub.sms_enabled, false) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.consume_school_sms_credit(
  p_school_id uuid,
  p_count int DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance int;
  v_sms_enabled boolean := false;
  v_sms_override boolean := false;
BEGIN
  IF p_count IS NULL OR p_count < 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid count');
  END IF;

  IF public.is_platform_super_admin() THEN
    RETURN jsonb_build_object('ok', true, 'super_admin_bypass', true);
  END IF;

  SELECT sms_balance, coalesce(sms_enabled, false), coalesce(sms_admin_override, false)
  INTO v_balance, v_sms_enabled, v_sms_override
  FROM public.school_subscriptions
  WHERE school_id = p_school_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', true, 'legacy', true);
  END IF;

  IF v_sms_enabled OR v_sms_override THEN
    IF coalesce(v_balance, 0) >= p_count THEN
      UPDATE public.school_subscriptions
      SET sms_balance = sms_balance - p_count, updated_at = now()
      WHERE school_id = p_school_id;
      RETURN jsonb_build_object('ok', true, 'balance_after', v_balance - p_count);
    END IF;
    RETURN jsonb_build_object('ok', true, 'unmetered', true, 'balance', coalesce(v_balance, 0));
  END IF;

  IF coalesce(v_balance, 0) < p_count THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Insufficient SMS balance',
      'balance', coalesce(v_balance, 0),
      'required', p_count
    );
  END IF;

  UPDATE public.school_subscriptions
  SET sms_balance = sms_balance - p_count, updated_at = now()
  WHERE school_id = p_school_id;

  RETURN jsonb_build_object('ok', true, 'balance_after', v_balance - p_count);
END;
$$;

-- Re-apply plan modules without dropping SMS when sms_enabled is true.
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

NOTIFY pgrst, 'reload schema';

-- Repair a school that paid with SMS enabled (run as super admin or set school id):
-- UPDATE public.school_subscriptions SET sms_enabled = true, sms_enabled_at = now() WHERE school_id = 'YOUR-SCHOOL-UUID';
-- SELECT public.sync_school_sms_entitlement('YOUR-SCHOOL-UUID');
