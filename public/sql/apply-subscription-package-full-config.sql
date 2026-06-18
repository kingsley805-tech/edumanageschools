-- Full subscription package configuration: SMS credits, usage limits, activation hooks
-- Run in Supabase SQL Editor AFTER apply-sms-subscription-billing.sql

ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS sms_included_quantity int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sms_price_per_message numeric(12,4) NOT NULL DEFAULT 0;

ALTER TABLE public.school_subscriptions
  ADD COLUMN IF NOT EXISTS sms_balance int NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.subscription_plans.sms_included_quantity IS
  'Registration/notification SMS messages included each billing period.';
COMMENT ON COLUMN public.subscription_plans.sms_price_per_message IS
  'Charge per SMS (GHS) when balance is exhausted or for pay-as-you-go.';
COMMENT ON COLUMN public.school_subscriptions.sms_balance IS
  'Remaining SMS credits for the school (from plan inclusion).';

-- Apply included SMS credits from plan (called on purchase / renewal / complimentary grant)
CREATE OR REPLACE FUNCTION public.apply_school_sms_package_credits(p_school_id uuid, p_plan_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan public.subscription_plans%ROWTYPE;
  v_qty int;
BEGIN
  SELECT * INTO v_plan FROM public.subscription_plans WHERE id = p_plan_id;
  IF NOT FOUND THEN RETURN; END IF;

  v_qty := coalesce(v_plan.sms_included_quantity, 0);

  UPDATE public.school_subscriptions
  SET sms_balance = v_qty, updated_at = now()
  WHERE school_id = p_school_id;
END;
$$;

-- Consume SMS credits before sending (returns ok:false when insufficient)
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

  -- Paid SMS add-on: allow sends even when included credit balance is 0.
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

CREATE OR REPLACE FUNCTION public.get_school_sms_balance(p_school_id uuid)
RETURNS int
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(
    (SELECT sms_balance FROM public.school_subscriptions WHERE school_id = p_school_id),
    0
  );
$$;

-- Enforce student cap from active subscription plan
CREATE OR REPLACE FUNCTION public.enforce_subscription_student_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max int;
  v_count int;
BEGIN
  SELECT sp.max_students INTO v_max
  FROM public.school_subscriptions ss
  JOIN public.subscription_plans sp ON sp.id = ss.plan_id
  WHERE ss.school_id = NEW.school_id
    AND ss.status IN ('active', 'trial');

  IF v_max IS NULL THEN RETURN NEW; END IF;

  SELECT count(*)::int INTO v_count
  FROM public.students s
  WHERE s.school_id = NEW.school_id
    AND (TG_OP = 'INSERT' OR s.id <> NEW.id);

  IF TG_OP = 'INSERT' THEN v_count := v_count + 1; END IF;

  IF v_count > v_max THEN
    RAISE EXCEPTION 'Student limit reached (%). Upgrade your subscription plan.', v_max
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_subscription_teacher_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max int;
  v_count int;
BEGIN
  SELECT sp.max_teachers INTO v_max
  FROM public.school_subscriptions ss
  JOIN public.subscription_plans sp ON sp.id = ss.plan_id
  WHERE ss.school_id = NEW.school_id
    AND ss.status IN ('active', 'trial');

  IF v_max IS NULL THEN RETURN NEW; END IF;

  SELECT count(*)::int INTO v_count
  FROM public.teachers t
  WHERE t.school_id = NEW.school_id
    AND (TG_OP = 'INSERT' OR t.id <> NEW.id);

  IF TG_OP = 'INSERT' THEN v_count := v_count + 1; END IF;

  IF v_count > v_max THEN
    RAISE EXCEPTION 'Teacher limit reached (%). Upgrade your subscription plan.', v_max
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_subscription_student_limit ON public.students;
CREATE TRIGGER trg_enforce_subscription_student_limit
  BEFORE INSERT OR UPDATE OF school_id ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.enforce_subscription_student_limit();

DROP TRIGGER IF EXISTS trg_enforce_subscription_teacher_limit ON public.teachers;
CREATE TRIGGER trg_enforce_subscription_teacher_limit
  BEFORE INSERT OR UPDATE OF school_id ON public.teachers
  FOR EACH ROW EXECUTE FUNCTION public.enforce_subscription_teacher_limit();

-- Patch activate_organization_subscription to grant SMS credits
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
      'sms_amount', coalesce(v_checkout.sms_amount, 0),
      'sms_included_quantity', coalesce(v_plan.sms_included_quantity, 0)
    )
  );

  UPDATE public.platform_subscription_checkouts SET consumed_at = now() WHERE reference = p_reference;

  INSERT INTO public.school_subscriptions (
    school_id, plan_id, status, billing_cycle, started_at, expires_at,
    grace_period_ends_at, reminder_day, locked_at, amount_paid, payment_reference,
    paystack_transaction_id, storage_limit_mb, renewed_at, updated_at,
    sms_enabled, sms_enabled_at, sms_balance
  ) VALUES (
    v_checkout.school_id, v_checkout.plan_id, 'active', v_checkout.billing_cycle,
    now(), v_period_end, NULL, 0, NULL, coalesce(p_amount, v_checkout.amount),
    p_reference, p_paystack_transaction_id,
    CASE WHEN v_plan.max_storage_gb IS NULL THEN NULL ELSE v_plan.max_storage_gb * 1024 END,
    now(), now(),
    v_sms_enabled, CASE WHEN v_sms_enabled THEN now() ELSE NULL END,
    coalesce(v_plan.sms_included_quantity, 0)
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
    END,
    sms_balance = coalesce(v_plan.sms_included_quantity, 0);

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
      'sms_included_quantity', coalesce(v_plan.sms_included_quantity, 0),
      'period_end', v_period_end
    ),
    p_reference,
    v_checkout.created_by
  );

  RETURN jsonb_build_object(
    'ok', true,
    'school_id', v_checkout.school_id,
    'expires_at', v_period_end,
    'sms_enabled', v_sms_enabled,
    'sms_balance', coalesce(v_plan.sms_included_quantity, 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_school_sms_package_credits(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.consume_school_sms_credit(uuid, int) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_school_sms_balance(uuid) TO authenticated;

-- Complimentary grant: apply SMS credits from plan
CREATE OR REPLACE FUNCTION public.grant_complimentary_subscription(
  p_school_id uuid,
  p_plan_id uuid,
  p_billing_cycle text DEFAULT 'annual',
  p_expires_at timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan public.subscription_plans%ROWTYPE;
  v_cycle text;
  v_period_end timestamptz;
BEGIN
  IF NOT public.is_platform_super_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Forbidden');
  END IF;

  SELECT * INTO v_plan FROM public.subscription_plans WHERE id = p_plan_id AND is_active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Plan not found');
  END IF;

  v_cycle := CASE WHEN lower(coalesce(p_billing_cycle, 'annual')) = 'monthly' THEN 'monthly' ELSE 'annual' END;
  v_period_end := coalesce(
    p_expires_at,
    CASE v_cycle WHEN 'monthly' THEN now() + interval '30 days' ELSE now() + interval '365 days' END
  );

  INSERT INTO public.school_subscriptions (
    school_id, plan_id, status, billing_cycle, started_at, expires_at,
    grace_period_ends_at, reminder_day, locked_at, amount_paid,
    storage_limit_mb, renewed_at, updated_at, sms_balance
  ) VALUES (
    p_school_id, p_plan_id, 'active', v_cycle, now(), v_period_end,
    NULL, 0, NULL, 0,
    CASE WHEN v_plan.max_storage_gb IS NULL THEN NULL ELSE v_plan.max_storage_gb * 1024 END,
    now(), now(),
    coalesce(v_plan.sms_included_quantity, 0)
  )
  ON CONFLICT (school_id) DO UPDATE SET
    plan_id = EXCLUDED.plan_id,
    status = 'active',
    billing_cycle = EXCLUDED.billing_cycle,
    started_at = EXCLUDED.started_at,
    expires_at = EXCLUDED.expires_at,
    grace_period_ends_at = NULL,
    reminder_day = 0,
    locked_at = NULL,
    amount_paid = 0,
    storage_limit_mb = EXCLUDED.storage_limit_mb,
    renewed_at = now(),
    updated_at = now(),
    sms_balance = coalesce(v_plan.sms_included_quantity, 0);

  PERFORM public.apply_subscription_plan_to_school_internal(p_school_id, p_plan_id);
  PERFORM public.apply_school_sms_package_credits(p_school_id, p_plan_id);

  PERFORM public.log_subscription_audit(
    p_school_id,
    'complimentary_grant',
    jsonb_build_object(
      'plan_id', p_plan_id,
      'billing_cycle', v_cycle,
      'expires_at', v_period_end,
      'sms_included_quantity', coalesce(v_plan.sms_included_quantity, 0)
    ),
    NULL,
    auth.uid()
  );

  RETURN jsonb_build_object('ok', true, 'expires_at', v_period_end);
END;
$$;

NOTIFY pgrst, 'reload schema';
