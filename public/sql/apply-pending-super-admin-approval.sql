-- After first-time payment, keep org in pending_approval until Super Admin activates.
-- Renewals of previously paid orgs still activate immediately.

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
  v_prior public.school_subscriptions%ROWTYPE;
  v_is_renewal boolean := false;
  v_new_status text := 'pending';
BEGIN
  IF p_reference IS NULL OR trim(p_reference) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Missing reference');
  END IF;

  SELECT * INTO v_checkout FROM public.platform_subscription_checkouts WHERE reference = p_reference;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Checkout not found'); END IF;

  IF v_checkout.consumed_at IS NOT NULL THEN
    SELECT id INTO v_existing FROM public.organization_subscription_payments
    WHERE payment_reference = p_reference AND status = 'completed' LIMIT 1;
    IF v_existing IS NOT NULL THEN
      RETURN jsonb_build_object('ok', true, 'duplicate', true, 'awaiting_approval', false);
    END IF;
  END IF;

  SELECT * INTO v_plan FROM public.subscription_plans WHERE id = v_checkout.plan_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Plan not found'); END IF;

  v_period_end := CASE v_checkout.billing_cycle
    WHEN 'annual' THEN now() + interval '365 days'
    ELSE now() + interval '30 days'
  END;

  v_sms_enabled := coalesce(v_checkout.enable_sms, false);

  SELECT * INTO v_prior FROM public.school_subscriptions WHERE school_id = v_checkout.school_id;
  IF FOUND THEN
    -- Renewals: school already had a paid plan / active period before
    v_is_renewal := (
      v_prior.payment_reference IS NOT NULL
      OR v_prior.status IN ('active', 'expired', 'locked', 'suspended', 'cancelled')
      OR (v_prior.plan_id IS NOT NULL AND v_prior.status = 'pending' AND v_prior.amount_paid IS NOT NULL AND coalesce(v_prior.amount_paid, 0) > 0)
    );
  END IF;

  v_new_status := CASE WHEN v_is_renewal THEN 'active' ELSE 'pending' END;

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
      'sms_amount', coalesce(v_checkout.sms_amount, 0),
      'awaiting_super_admin_approval', NOT v_is_renewal
    )
  );

  UPDATE public.platform_subscription_checkouts SET consumed_at = now() WHERE reference = p_reference;

  INSERT INTO public.school_subscriptions (
    school_id, plan_id, status, billing_cycle, started_at, expires_at,
    grace_period_ends_at, reminder_day, locked_at, amount_paid, payment_reference,
    paystack_transaction_id, storage_limit_mb, renewed_at, updated_at,
    sms_enabled, sms_enabled_at
  ) VALUES (
    v_checkout.school_id, v_checkout.plan_id, v_new_status, v_checkout.billing_cycle,
    now(), v_period_end, NULL, 0, NULL, coalesce(p_amount, v_checkout.amount),
    p_reference, p_paystack_transaction_id, v_plan.max_storage_gb * 1024,
    CASE WHEN v_is_renewal THEN now() ELSE NULL END,
    now(),
    v_sms_enabled, CASE WHEN v_sms_enabled THEN now() ELSE NULL END
  ) ON CONFLICT (school_id) DO UPDATE SET
    plan_id = EXCLUDED.plan_id,
    status = EXCLUDED.status,
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
    renewed_at = CASE WHEN v_is_renewal THEN now() ELSE school_subscriptions.renewed_at END,
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
    CASE
      WHEN v_is_renewal THEN 'renewal'
      ELSE 'new_subscription_pending_approval'
    END,
    jsonb_build_object(
      'plan_id', v_checkout.plan_id,
      'billing_cycle', v_checkout.billing_cycle,
      'amount', coalesce(p_amount, v_checkout.amount),
      'package_amount', coalesce(v_checkout.package_amount, v_checkout.amount - coalesce(v_checkout.sms_amount, 0)),
      'sms_amount', coalesce(v_checkout.sms_amount, 0),
      'enable_sms', v_sms_enabled,
      'period_end', v_period_end,
      'status', v_new_status,
      'awaiting_super_admin_approval', NOT v_is_renewal
    ),
    p_reference,
    v_checkout.created_by
  );

  RETURN jsonb_build_object(
    'ok', true,
    'school_id', v_checkout.school_id,
    'expires_at', v_period_end,
    'sms_enabled', v_sms_enabled,
    'status', v_new_status,
    'awaiting_approval', NOT v_is_renewal
  );
END;
$$;

-- Access RPC: paid but not yet Super-Admin-approved → pending_approval
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

  -- Paid / plan selected, waiting for Super Admin
  IF v_sub.status = 'pending' AND v_sub.plan_id IS NOT NULL THEN
    v_access_state := 'pending_approval';
    v_can_use := false;
  ELSIF v_sub.status = 'pending' OR (v_sub.status IN ('pending', 'trial') AND v_sub.plan_id IS NULL) THEN
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

-- Super Admin: approve a paid pending organization
CREATE OR REPLACE FUNCTION public.approve_organization_subscription(p_school_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub public.school_subscriptions%ROWTYPE;
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Only Super Admins can approve accounts');
  END IF;

  IF p_school_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Missing school');
  END IF;

  SELECT * INTO v_sub FROM public.school_subscriptions WHERE school_id = p_school_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Subscription not found');
  END IF;

  IF v_sub.plan_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Organization has not completed payment / plan selection');
  END IF;

  UPDATE public.school_subscriptions
  SET
    status = 'active',
    locked_at = NULL,
    renewed_at = coalesce(renewed_at, now()),
    updated_at = now()
  WHERE school_id = p_school_id;

  PERFORM public.log_subscription_audit(
    p_school_id,
    'super_admin_approved',
    jsonb_build_object('previous_status', v_sub.status, 'plan_id', v_sub.plan_id),
    v_sub.payment_reference,
    auth.uid()
  );

  RETURN jsonb_build_object('ok', true, 'school_id', p_school_id, 'status', 'active');
END;
$$;

-- Super Admin: reject a pending organization (locks until re-reviewed)
CREATE OR REPLACE FUNCTION public.reject_organization_subscription(
  p_school_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub public.school_subscriptions%ROWTYPE;
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Only Super Admins can reject accounts');
  END IF;

  IF p_school_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Missing school');
  END IF;

  SELECT * INTO v_sub FROM public.school_subscriptions WHERE school_id = p_school_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Subscription not found');
  END IF;

  UPDATE public.school_subscriptions
  SET
    status = 'locked',
    locked_at = now(),
    updated_at = now()
  WHERE school_id = p_school_id;

  PERFORM public.log_subscription_audit(
    p_school_id,
    'super_admin_rejected',
    jsonb_build_object(
      'previous_status', v_sub.status,
      'plan_id', v_sub.plan_id,
      'reason', coalesce(nullif(trim(p_reason), ''), 'Rejected by Super Admin')
    ),
    v_sub.payment_reference,
    auth.uid()
  );

  RETURN jsonb_build_object('ok', true, 'school_id', p_school_id, 'status', 'locked');
END;
$$;

GRANT EXECUTE ON FUNCTION public.activate_organization_subscription(text, text, numeric, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_organization_subscription_access(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_organization_subscription_access(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.approve_organization_subscription(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_organization_subscription(uuid, text) TO authenticated;
