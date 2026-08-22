-- Harden activate_organization_subscription so Paystack confirm does not 400
-- after first-time payment (duplicate refs, null storage, approval column).

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
  v_storage_mb numeric;
BEGIN
  IF p_reference IS NULL OR trim(p_reference) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Missing reference');
  END IF;

  SELECT * INTO v_checkout FROM public.platform_subscription_checkouts WHERE reference = p_reference;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Checkout not found');
  END IF;

  -- Already processed this reference
  SELECT id INTO v_existing
  FROM public.organization_subscription_payments
  WHERE payment_reference = p_reference AND status = 'completed'
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    SELECT * INTO v_prior FROM public.school_subscriptions WHERE school_id = v_checkout.school_id;
    RETURN jsonb_build_object(
      'ok', true,
      'duplicate', true,
      'awaiting_approval', coalesce(v_prior.status, 'pending') = 'pending',
      'status', coalesce(v_prior.status, 'pending'),
      'admin_approval_status', CASE
        WHEN coalesce(v_prior.status, 'pending') = 'pending' THEN 'pending_verification'
        ELSE 'approved'
      END,
      'school_id', v_checkout.school_id
    );
  END IF;

  SELECT * INTO v_plan FROM public.subscription_plans WHERE id = v_checkout.plan_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Plan not found');
  END IF;

  v_period_end := CASE v_checkout.billing_cycle
    WHEN 'annual' THEN now() + interval '365 days'
    ELSE now() + interval '30 days'
  END;

  v_sms_enabled := coalesce(v_checkout.enable_sms, false);
  v_storage_mb := coalesce(v_plan.max_storage_gb, 5) * 1024;

  SELECT * INTO v_prior FROM public.school_subscriptions WHERE school_id = v_checkout.school_id;
  IF FOUND THEN
    v_is_renewal := (
      v_prior.status IN ('active', 'expired', 'locked', 'suspended', 'cancelled')
      OR (
        v_prior.plan_id IS NOT NULL
        AND v_prior.status = 'pending'
        AND v_prior.amount_paid IS NOT NULL
        AND coalesce(v_prior.amount_paid, 0) > 0
        AND v_prior.payment_reference IS NOT NULL
        AND v_prior.payment_reference IS DISTINCT FROM p_reference
      )
    );
  END IF;

  v_new_status := CASE WHEN v_is_renewal THEN 'active' ELSE 'pending' END;

  BEGIN
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
  EXCEPTION
    WHEN unique_violation THEN
      SELECT * INTO v_prior FROM public.school_subscriptions WHERE school_id = v_checkout.school_id;
      RETURN jsonb_build_object(
        'ok', true,
        'duplicate', true,
        'awaiting_approval', coalesce(v_prior.status, 'pending') = 'pending',
        'status', coalesce(v_prior.status, 'pending'),
        'school_id', v_checkout.school_id
      );
  END;

  UPDATE public.platform_subscription_checkouts
  SET consumed_at = coalesce(consumed_at, now())
  WHERE reference = p_reference;

  INSERT INTO public.school_subscriptions (
    school_id, plan_id, status, billing_cycle, started_at, expires_at,
    grace_period_ends_at, reminder_day, locked_at, amount_paid, payment_reference,
    paystack_transaction_id, storage_limit_mb, renewed_at, updated_at,
    sms_enabled, sms_enabled_at
  ) VALUES (
    v_checkout.school_id, v_checkout.plan_id, v_new_status, v_checkout.billing_cycle,
    now(), v_period_end, NULL, 0, NULL, coalesce(p_amount, v_checkout.amount),
    p_reference, p_paystack_transaction_id, v_storage_mb,
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

  IF NOT v_is_renewal THEN
    BEGIN
      UPDATE public.profiles p
      SET admin_approval_status = 'pending_verification'::public.admin_approval_status
      FROM public.user_roles ur
      WHERE ur.user_id = p.id
        AND ur.role = 'admin'::public.app_role
        AND p.school_id = v_checkout.school_id
        AND (
          p.admin_approval_status IS NULL
          OR p.admin_approval_status = 'pending_verification'::public.admin_approval_status
        );
    EXCEPTION
      WHEN undefined_column THEN NULL;
      WHEN undefined_object THEN NULL;
      WHEN invalid_text_representation THEN NULL;
    END;
  END IF;

  BEGIN
    PERFORM public.apply_subscription_plan_to_school_internal(v_checkout.school_id, v_checkout.plan_id);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'apply_subscription_plan_to_school_internal failed: %', SQLERRM;
  END;

  BEGIN
    PERFORM public.sync_school_sms_entitlement(v_checkout.school_id);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'sync_school_sms_entitlement failed: %', SQLERRM;
  END;

  BEGIN
    PERFORM public.log_subscription_audit(
      v_checkout.school_id,
      CASE
        WHEN v_is_renewal THEN 'renewal'
        ELSE 'new_subscription_pending_verification'
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
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'log_subscription_audit failed: %', SQLERRM;
  END;

  RETURN jsonb_build_object(
    'ok', true,
    'school_id', v_checkout.school_id,
    'expires_at', v_period_end,
    'sms_enabled', v_sms_enabled,
    'status', v_new_status,
    'awaiting_approval', NOT v_is_renewal,
    'admin_approval_status', CASE WHEN v_is_renewal THEN 'approved' ELSE 'pending_verification' END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.activate_organization_subscription(text, text, numeric, text) TO service_role;

NOTIFY pgrst, 'reload schema';
