-- Fix: cast status to subscription_status enum (not text)

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
  v_school_id uuid;
  v_plan_id uuid;
  v_billing_cycle text;
  v_amount numeric;
  v_package_amount numeric;
  v_sms_amount numeric;
  v_enable_sms boolean := false;
  v_created_by uuid;
  v_period_end timestamptz;
  v_existing uuid;
  v_prior_status public.subscription_status;
  v_prior_plan uuid;
  v_prior_paid numeric;
  v_prior_ref text;
  v_is_renewal boolean := false;
  v_new_status public.subscription_status := 'pending';
  v_storage_mb numeric := 5120;
  v_max_storage numeric;
BEGIN
  BEGIN
    IF p_reference IS NULL OR trim(p_reference) = '' THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Missing reference');
    END IF;

    SELECT
      c.school_id,
      c.plan_id,
      c.billing_cycle,
      c.amount,
      c.created_by
    INTO
      v_school_id,
      v_plan_id,
      v_billing_cycle,
      v_amount,
      v_created_by
    FROM public.platform_subscription_checkouts c
    WHERE c.reference = p_reference;

    IF v_school_id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Checkout not found');
    END IF;

    BEGIN
      EXECUTE $q$
        SELECT coalesce(enable_sms, false), package_amount, coalesce(sms_amount, 0)
        FROM public.platform_subscription_checkouts
        WHERE reference = $1
      $q$
      INTO v_enable_sms, v_package_amount, v_sms_amount
      USING p_reference;
    EXCEPTION WHEN undefined_column THEN
      v_enable_sms := false;
      v_package_amount := v_amount;
      v_sms_amount := 0;
    END;

    SELECT id INTO v_existing
    FROM public.organization_subscription_payments
    WHERE payment_reference = p_reference AND status = 'completed'
    LIMIT 1;

    IF v_existing IS NOT NULL THEN
      SELECT status INTO v_prior_status
      FROM public.school_subscriptions
      WHERE school_id = v_school_id;
      RETURN jsonb_build_object(
        'ok', true,
        'duplicate', true,
        'awaiting_approval', coalesce(v_prior_status, 'pending'::public.subscription_status) = 'pending'::public.subscription_status,
        'status', coalesce(v_prior_status, 'pending'::public.subscription_status)::text,
        'admin_approval_status', CASE
          WHEN coalesce(v_prior_status, 'pending'::public.subscription_status) = 'pending'::public.subscription_status
            THEN 'pending_verification'
          ELSE 'approved'
        END,
        'school_id', v_school_id
      );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.subscription_plans WHERE id = v_plan_id) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Plan not found');
    END IF;

    SELECT max_storage_gb INTO v_max_storage
    FROM public.subscription_plans WHERE id = v_plan_id;
    v_storage_mb := coalesce(v_max_storage, 5) * 1024;

    v_period_end := CASE v_billing_cycle
      WHEN 'annual' THEN now() + interval '365 days'
      ELSE now() + interval '30 days'
    END;

    SELECT ss.status, ss.plan_id, ss.amount_paid, ss.payment_reference
    INTO v_prior_status, v_prior_plan, v_prior_paid, v_prior_ref
    FROM public.school_subscriptions ss
    WHERE ss.school_id = v_school_id;

    IF FOUND THEN
      v_is_renewal := (
        v_prior_status IN (
          'active'::public.subscription_status,
          'expired'::public.subscription_status,
          'locked'::public.subscription_status,
          'suspended'::public.subscription_status,
          'cancelled'::public.subscription_status
        )
        OR (
          v_prior_plan IS NOT NULL
          AND v_prior_status = 'pending'::public.subscription_status
          AND coalesce(v_prior_paid, 0) > 0
          AND v_prior_ref IS NOT NULL
          AND v_prior_ref IS DISTINCT FROM p_reference
        )
      );
    END IF;

    v_new_status := CASE
      WHEN v_is_renewal THEN 'active'::public.subscription_status
      ELSE 'pending'::public.subscription_status
    END;

    BEGIN
      INSERT INTO public.organization_subscription_payments (
        school_id, plan_id, billing_cycle, amount, status, payment_reference,
        paystack_transaction_id, payment_status, paid_at, period_start, period_end,
        created_by, metadata
      ) VALUES (
        v_school_id, v_plan_id, v_billing_cycle,
        coalesce(p_amount, v_amount), 'completed', p_reference, p_paystack_transaction_id,
        p_payment_status, now(), now(), v_period_end, v_created_by,
        jsonb_build_object(
          'billing_cycle', v_billing_cycle,
          'enable_sms', v_enable_sms,
          'package_amount', coalesce(v_package_amount, coalesce(p_amount, v_amount) - coalesce(v_sms_amount, 0)),
          'sms_amount', coalesce(v_sms_amount, 0),
          'awaiting_super_admin_approval', NOT v_is_renewal
        )
      );
    EXCEPTION WHEN unique_violation THEN
      SELECT status INTO v_prior_status FROM public.school_subscriptions WHERE school_id = v_school_id;
      RETURN jsonb_build_object(
        'ok', true,
        'duplicate', true,
        'awaiting_approval', coalesce(v_prior_status, 'pending'::public.subscription_status) = 'pending'::public.subscription_status,
        'status', coalesce(v_prior_status, 'pending'::public.subscription_status)::text,
        'school_id', v_school_id
      );
    END;

    UPDATE public.platform_subscription_checkouts
    SET consumed_at = coalesce(consumed_at, now())
    WHERE reference = p_reference;

    INSERT INTO public.school_subscriptions AS ss (
      school_id, plan_id, status, billing_cycle, started_at, expires_at,
      grace_period_ends_at, reminder_day, locked_at, amount_paid, payment_reference,
      paystack_transaction_id, storage_limit_mb, renewed_at, updated_at
    ) VALUES (
      v_school_id, v_plan_id, v_new_status, v_billing_cycle,
      now(), v_period_end, NULL, 0, NULL, coalesce(p_amount, v_amount),
      p_reference, p_paystack_transaction_id, v_storage_mb,
      CASE WHEN v_is_renewal THEN now() ELSE NULL END,
      now()
    )
    ON CONFLICT (school_id) DO UPDATE SET
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
      renewed_at = CASE WHEN v_is_renewal THEN now() ELSE ss.renewed_at END,
      updated_at = now();

    BEGIN
      EXECUTE $q$
        UPDATE public.school_subscriptions
        SET sms_enabled = $2,
            sms_enabled_at = CASE WHEN $2 THEN coalesce(sms_enabled_at, now()) ELSE sms_enabled_at END
        WHERE school_id = $1
      $q$
      USING v_school_id, v_enable_sms;
    EXCEPTION WHEN undefined_column THEN
      NULL;
    END;

    IF NOT v_is_renewal THEN
      BEGIN
        UPDATE public.profiles p
        SET admin_approval_status = 'pending_verification'::public.admin_approval_status
        FROM public.user_roles ur
        WHERE ur.user_id = p.id
          AND ur.role = 'admin'::public.app_role
          AND p.school_id = v_school_id;
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END IF;

    BEGIN
      PERFORM public.apply_subscription_plan_to_school_internal(v_school_id, v_plan_id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'apply plan failed: %', SQLERRM;
    END;

    BEGIN
      PERFORM public.sync_school_sms_entitlement(v_school_id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'sms sync failed: %', SQLERRM;
    END;

    BEGIN
      PERFORM public.log_subscription_audit(
        v_school_id,
        CASE WHEN v_is_renewal THEN 'renewal' ELSE 'new_subscription_pending_verification' END,
        jsonb_build_object(
          'plan_id', v_plan_id,
          'billing_cycle', v_billing_cycle,
          'amount', coalesce(p_amount, v_amount),
          'status', v_new_status::text,
          'awaiting_super_admin_approval', NOT v_is_renewal
        ),
        p_reference,
        v_created_by
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;

    RETURN jsonb_build_object(
      'ok', true,
      'school_id', v_school_id,
      'expires_at', v_period_end,
      'sms_enabled', v_enable_sms,
      'status', v_new_status::text,
      'awaiting_approval', NOT v_is_renewal,
      'admin_approval_status', CASE WHEN v_is_renewal THEN 'approved' ELSE 'pending_verification' END
    );
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.activate_organization_subscription(text, text, numeric, text) TO service_role;

NOTIFY pgrst, 'reload schema';
