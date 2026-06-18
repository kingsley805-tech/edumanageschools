-- SMS subscription add-on billing + Super Admin SMS management

ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS sms_addon_fee_monthly numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sms_addon_fee_annual numeric(12,2) NOT NULL DEFAULT 0;

ALTER TABLE public.platform_subscription_checkouts
  ADD COLUMN IF NOT EXISTS enable_sms boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS package_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS sms_amount numeric(12,2) NOT NULL DEFAULT 0;

ALTER TABLE public.school_subscriptions
  ADD COLUMN IF NOT EXISTS sms_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sms_enabled_at timestamptz,
  ADD COLUMN IF NOT EXISTS sms_admin_override boolean NOT NULL DEFAULT false;

-- Ensure paid SMS add-on enables the sms module entitlement
CREATE OR REPLACE FUNCTION public.sync_school_sms_entitlement(p_school_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub public.school_subscriptions%ROWTYPE;
BEGIN
  SELECT * INTO v_sub FROM public.school_subscriptions WHERE school_id = p_school_id;
  IF NOT FOUND THEN RETURN; END IF;

  IF coalesce(v_sub.sms_enabled, false) OR coalesce(v_sub.sms_admin_override, false) THEN
    INSERT INTO public.school_module_entitlements (
      school_id, module_key, enabled, can_read, can_create, can_edit, can_delete, can_export, updated_at
    ) VALUES (
      p_school_id, 'sms', true, true, true, true, true, true, now()
    )
    ON CONFLICT (school_id, module_key) DO UPDATE SET
      enabled = true, can_read = true, can_create = true, can_edit = true,
      can_delete = true, can_export = true, updated_at = now();
    PERFORM public.sync_school_rbac_to_entitlements(p_school_id);
  END IF;
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
  PERFORM public.sync_school_sms_entitlement(p_school_id);
END;
$$;

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

CREATE OR REPLACE FUNCTION public.set_platform_school_sms(
  p_school_id uuid,
  p_enabled boolean,
  p_admin_override boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_super_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Forbidden');
  END IF;

  UPDATE public.school_subscriptions
  SET
    sms_enabled = p_enabled,
    sms_admin_override = p_admin_override,
    sms_enabled_at = CASE WHEN p_enabled THEN coalesce(sms_enabled_at, now()) ELSE sms_enabled_at END,
    updated_at = now()
  WHERE school_id = p_school_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'School subscription not found');
  END IF;

  PERFORM public.sync_school_sms_entitlement(p_school_id);

  PERFORM public.log_subscription_audit(
    p_school_id,
    CASE WHEN p_enabled THEN 'sms_enabled' ELSE 'sms_disabled' END,
    jsonb_build_object('admin_override', p_admin_override),
    NULL,
    auth.uid()
  );

  RETURN jsonb_build_object('ok', true, 'sms_enabled', p_enabled);
END;
$$;

CREATE OR REPLACE VIEW public.platform_school_sms_overview_v AS
SELECT
  s.id AS school_id,
  coalesce(s.school_name, s.name) AS school_name,
  s.school_code,
  ss.status AS subscription_status,
  sp.name AS plan_name,
  coalesce(ss.sms_enabled, false) AS sms_enabled,
  coalesce(ss.sms_admin_override, false) AS sms_admin_override,
  ss.sms_enabled_at,
  ss.expires_at AS subscription_expires_at,
  (
    SELECT count(*)::int
    FROM public.sms_logs sl
    WHERE sl.school_id = s.id
      AND sl.sent_at >= (now() - interval '30 days')
  ) AS sms_sent_30d,
  (
    SELECT count(*)::int
    FROM public.sms_logs sl
    WHERE sl.school_id = s.id
      AND sl.sms_status = 'sent'
  ) AS sms_sent_total,
  (
    SELECT max(sl.sent_at)
    FROM public.sms_logs sl
    WHERE sl.school_id = s.id
  ) AS last_sms_at
FROM public.schools s
LEFT JOIN public.school_subscriptions ss ON ss.school_id = s.id
LEFT JOIN public.subscription_plans sp ON sp.id = ss.plan_id;

GRANT SELECT ON public.platform_school_sms_overview_v TO authenticated;

CREATE OR REPLACE FUNCTION public.activate_organization_subscription(
  p_reference text,
  p_paystack_transaction_id text DEFAULT NULL,
  p_amount numeric DEFAULT NULL,
  p_payment_status text DEFAULT 'success'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_checkout public.platform_subscription_checkouts%ROWTYPE;
  v_plan public.subscription_plans%ROWTYPE;
  v_period_end timestamptz;
  v_existing uuid;
  v_sms_enabled boolean;
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

  v_period_end := CASE v_checkout.billing_cycle
    WHEN 'annual' THEN now() + interval '365 days'
    ELSE now() + interval '30 days'
  END;

  v_sms_enabled := coalesce(v_checkout.enable_sms, false);

  INSERT INTO public.organization_subscription_payments (
    school_id, plan_id, billing_cycle, amount, status, payment_reference, paystack_transaction_id,
    payment_status, paid_at, period_start, period_end, created_by, metadata
  ) VALUES (
    v_checkout.school_id, v_checkout.plan_id, v_checkout.billing_cycle,
    coalesce(p_amount, v_checkout.amount), 'completed', p_reference, p_paystack_transaction_id,
    p_payment_status, now(), now(), v_period_end, v_checkout.created_by,
    jsonb_build_object(
      'billing_cycle', v_checkout.billing_cycle,
      'enable_sms', v_sms_enabled,
      'package_amount', coalesce(v_checkout.package_amount, v_checkout.amount - coalesce(v_checkout.sms_amount, 0)),
      'sms_amount', coalesce(v_checkout.sms_amount, 0)
    )
  );

  UPDATE public.platform_subscription_checkouts SET consumed_at = now() WHERE reference = p_reference;

  INSERT INTO public.school_subscriptions (
    school_id, plan_id, status, billing_cycle, started_at, expires_at,
    grace_period_ends_at, reminder_day, locked_at, amount_paid, payment_reference,
    paystack_transaction_id, storage_limit_mb, renewed_at, updated_at,
    sms_enabled, sms_enabled_at
  ) VALUES (
    v_checkout.school_id, v_checkout.plan_id, 'active', v_checkout.billing_cycle,
    now(), v_period_end, NULL, 0, NULL, coalesce(p_amount, v_checkout.amount),
    p_reference, p_paystack_transaction_id, v_plan.max_storage_gb * 1024, now(), now(),
    v_sms_enabled, CASE WHEN v_sms_enabled THEN now() ELSE NULL END
  ) ON CONFLICT (school_id) DO UPDATE SET
    plan_id = EXCLUDED.plan_id,
    status = 'active',
    billing_cycle = EXCLUDED.billing_cycle,
    started_at = EXCLUDED.started_at,
    expires_at = EXCLUDED.expires_at,
    grace_period_ends_at = NULL,
    reminder_day = 0,
    locked_at = NULL,
    amount_paid = EXCLUDED.amount_paid,
    payment_reference = EXCLUDED.payment_reference,
    paystack_transaction_id = EXCLUDED.paystack_transaction_id,
    storage_limit_mb = EXCLUDED.storage_limit_mb,
    renewed_at = now(),
    updated_at = now(),
    sms_enabled = CASE
      WHEN coalesce(school_subscriptions.sms_admin_override, false) THEN school_subscriptions.sms_enabled
      ELSE EXCLUDED.sms_enabled
    END,
    sms_enabled_at = CASE
      WHEN coalesce(school_subscriptions.sms_admin_override, false) THEN school_subscriptions.sms_enabled_at
      WHEN EXCLUDED.sms_enabled THEN coalesce(school_subscriptions.sms_enabled_at, now())
      ELSE NULL
    END;

  PERFORM public.apply_subscription_plan_to_school_internal(v_checkout.school_id, v_checkout.plan_id);
  PERFORM public.sync_school_sms_entitlement(v_checkout.school_id);

  PERFORM public.log_subscription_audit(
    v_checkout.school_id,
    CASE WHEN v_checkout.consumed_at IS NULL THEN 'new_subscription' ELSE 'renewal' END,
    jsonb_build_object(
      'plan_id', v_checkout.plan_id,
      'billing_cycle', v_checkout.billing_cycle,
      'amount', coalesce(p_amount, v_checkout.amount),
      'package_amount', coalesce(v_checkout.package_amount, v_checkout.amount - coalesce(v_checkout.sms_amount, 0)),
      'sms_amount', coalesce(v_checkout.sms_amount, 0),
      'enable_sms', v_sms_enabled,
      'period_end', v_period_end
    ),
    p_reference,
    v_checkout.created_by
  );

  RETURN jsonb_build_object(
    'ok', true,
    'school_id', v_checkout.school_id,
    'expires_at', v_period_end,
    'sms_enabled', v_sms_enabled
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_school_sms_entitlement(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.school_sms_service_active(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_platform_school_sms(uuid, boolean, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.activate_organization_subscription(text, text, numeric, text) TO service_role;
