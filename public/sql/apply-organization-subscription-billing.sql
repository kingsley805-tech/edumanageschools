-- Organization subscription billing: mandatory payment after signup, grace period, audit log
-- Run in Supabase SQL Editor after apply-platform-saas-control.sql

-- ---------------------------------------------------------------------------
-- Extend subscription_status enum
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  ALTER TYPE public.subscription_status ADD VALUE IF NOT EXISTS 'pending';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE public.subscription_status ADD VALUE IF NOT EXISTS 'locked';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- Extend school_subscriptions
-- ---------------------------------------------------------------------------
ALTER TABLE public.school_subscriptions
  ADD COLUMN IF NOT EXISTS billing_cycle text CHECK (billing_cycle IS NULL OR billing_cycle IN ('monthly', 'annual')),
  ADD COLUMN IF NOT EXISTS grace_period_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_day int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS amount_paid numeric(12,2),
  ADD COLUMN IF NOT EXISTS payment_reference text,
  ADD COLUMN IF NOT EXISTS paystack_transaction_id text;

-- ---------------------------------------------------------------------------
-- Subscription payments (platform SaaS billing)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organization_subscription_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.subscription_plans(id) ON DELETE RESTRICT,
  billing_cycle text NOT NULL CHECK (billing_cycle IN ('monthly', 'annual')),
  amount numeric(12,2) NOT NULL,
  currency text NOT NULL DEFAULT 'GHS',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  payment_reference text NOT NULL,
  paystack_transaction_id text,
  payment_status text,
  paid_at timestamptz,
  period_start timestamptz,
  period_end timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_org_sub_payments_reference
  ON public.organization_subscription_payments(payment_reference);

CREATE INDEX IF NOT EXISTS idx_org_sub_payments_school
  ON public.organization_subscription_payments(school_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Subscription audit log
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subscription_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  payment_reference text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscription_audit_school
  ON public.subscription_audit_log(school_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Pending checkout sessions (platform billing)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_subscription_checkouts (
  reference text PRIMARY KEY,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.subscription_plans(id) ON DELETE RESTRICT,
  billing_cycle text NOT NULL CHECK (billing_cycle IN ('monthly', 'annual')),
  amount numeric(12,2) NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  consumed_at timestamptz
);

-- ---------------------------------------------------------------------------
-- Audit helper
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_subscription_audit(
  p_school_id uuid,
  p_action text,
  p_details jsonb DEFAULT '{}'::jsonb,
  p_payment_reference text DEFAULT NULL,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.subscription_audit_log (school_id, user_id, action, details, payment_reference)
  VALUES (p_school_id, p_user_id, p_action, coalesce(p_details, '{}'::jsonb), p_payment_reference);
END;
$$;

-- ---------------------------------------------------------------------------
-- Access state for UI + guards
-- ---------------------------------------------------------------------------
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
  ELSIF v_sub.status IN ('active') AND (v_sub.expires_at IS NULL OR v_sub.expires_at > v_now) THEN
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

-- ---------------------------------------------------------------------------
-- Activate subscription after payment (service role / webhook)
-- ---------------------------------------------------------------------------
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
BEGIN
  IF p_reference IS NULL OR trim(p_reference) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Missing reference');
  END IF;

  SELECT * INTO v_checkout
  FROM public.platform_subscription_checkouts
  WHERE reference = p_reference;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Checkout not found');
  END IF;

  IF v_checkout.consumed_at IS NOT NULL THEN
    SELECT id INTO v_existing
    FROM public.organization_subscription_payments
    WHERE payment_reference = p_reference AND status = 'completed'
    LIMIT 1;
    IF v_existing IS NOT NULL THEN
      RETURN jsonb_build_object('ok', true, 'duplicate', true);
    END IF;
  END IF;

  SELECT * INTO v_plan FROM public.subscription_plans WHERE id = v_checkout.plan_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Plan not found');
  END IF;

  v_period_end := CASE v_checkout.billing_cycle
    WHEN 'annual' THEN now() + interval '365 days'
    ELSE now() + interval '30 days'
  END;

  INSERT INTO public.organization_subscription_payments (
    school_id, plan_id, billing_cycle, amount, status,
    payment_reference, paystack_transaction_id, payment_status,
    paid_at, period_start, period_end, created_by, metadata
  ) VALUES (
    v_checkout.school_id,
    v_checkout.plan_id,
    v_checkout.billing_cycle,
    coalesce(p_amount, v_checkout.amount),
    'completed',
    p_reference,
    p_paystack_transaction_id,
    p_payment_status,
    now(),
    now(),
    v_period_end,
    v_checkout.created_by,
    jsonb_build_object('billing_cycle', v_checkout.billing_cycle)
  );

  UPDATE public.platform_subscription_checkouts
  SET consumed_at = now()
  WHERE reference = p_reference;

  INSERT INTO public.school_subscriptions (
    school_id, plan_id, status, billing_cycle, started_at, expires_at,
    grace_period_ends_at, reminder_day, locked_at,
    amount_paid, payment_reference, paystack_transaction_id,
    storage_limit_mb, renewed_at, updated_at
  ) VALUES (
    v_checkout.school_id,
    v_checkout.plan_id,
    'active',
    v_checkout.billing_cycle,
    now(),
    v_period_end,
    NULL,
    0,
    NULL,
    coalesce(p_amount, v_checkout.amount),
    p_reference,
    p_paystack_transaction_id,
    v_plan.max_storage_gb * 1024,
    now(),
    now()
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
    amount_paid = EXCLUDED.amount_paid,
    payment_reference = EXCLUDED.payment_reference,
    paystack_transaction_id = EXCLUDED.paystack_transaction_id,
    storage_limit_mb = EXCLUDED.storage_limit_mb,
    renewed_at = now(),
    updated_at = now();

  -- Apply plan module entitlements (same logic as super-admin apply)
  PERFORM public.apply_subscription_plan_to_school_internal(
    v_checkout.school_id,
    v_checkout.plan_id
  );

  PERFORM public.log_subscription_audit(
    v_checkout.school_id,
    CASE WHEN v_checkout.consumed_at IS NULL THEN 'new_subscription' ELSE 'renewal' END,
    jsonb_build_object(
      'plan_id', v_checkout.plan_id,
      'billing_cycle', v_checkout.billing_cycle,
      'amount', coalesce(p_amount, v_checkout.amount),
      'period_end', v_period_end
    ),
    p_reference,
    v_checkout.created_by
  );

  RETURN jsonb_build_object('ok', true, 'school_id', v_checkout.school_id, 'expires_at', v_period_end);
END;
$$;

-- Internal: apply modules without super-admin check (called from activate)
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
END;
$$;

-- Refactor super-admin apply to use internal
CREATE OR REPLACE FUNCTION public.apply_subscription_plan_to_school(
  p_school_id uuid,
  p_plan_id uuid,
  p_status public.subscription_status DEFAULT 'active',
  p_expires_at timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan public.subscription_plans%ROWTYPE;
BEGIN
  IF NOT public.is_platform_super_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Forbidden');
  END IF;

  SELECT * INTO v_plan FROM public.subscription_plans WHERE id = p_plan_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Plan not found');
  END IF;

  INSERT INTO public.school_subscriptions (
    school_id, plan_id, status, expires_at, storage_limit_mb, updated_at
  ) VALUES (
    p_school_id, p_plan_id, p_status, p_expires_at, v_plan.max_storage_gb * 1024, now()
  )
  ON CONFLICT (school_id) DO UPDATE SET
    plan_id = EXCLUDED.plan_id,
    status = EXCLUDED.status,
    expires_at = EXCLUDED.expires_at,
    storage_limit_mb = EXCLUDED.storage_limit_mb,
    updated_at = now();

  PERFORM public.apply_subscription_plan_to_school_internal(p_school_id, p_plan_id);

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ---------------------------------------------------------------------------
-- Subscription writable / access (updated)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.school_subscription_writable(p_school_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_access jsonb;
BEGIN
  IF public.is_platform_super_admin() THEN RETURN true; END IF;
  v_access := public.get_organization_subscription_access(p_school_id);
  IF (v_access->>'access_state') = 'legacy' THEN RETURN true; END IF;
  RETURN coalesce((v_access->>'can_use_platform')::boolean, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.school_has_platform_module(
  p_school_id uuid,
  p_module_key text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enforced boolean;
  v_enabled boolean;
  v_access jsonb;
BEGIN
  IF public.is_platform_super_admin() THEN RETURN true; END IF;

  v_access := public.get_organization_subscription_access(p_school_id);
  IF (v_access->>'has_subscription_row')::boolean = true
     AND coalesce((v_access->>'can_use_platform')::boolean, false) = false THEN
    RETURN false;
  END IF;

  v_enforced := public.school_subscription_enforced(p_school_id);
  IF NOT v_enforced THEN RETURN true; END IF;

  SELECT e.enabled INTO v_enabled
  FROM public.school_module_entitlements e
  WHERE e.school_id = p_school_id AND e.module_key = p_module_key;

  RETURN coalesce(v_enabled, false);
END;
$$;

-- ---------------------------------------------------------------------------
-- Lifecycle batch: expiry reminders + lock (run daily via pg_cron or edge)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.run_subscription_lifecycle_batch()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub record;
  v_now timestamptz := now();
  v_grace interval := interval '3 days';
  v_locked int := 0;
  v_reminded int := 0;
  v_expired int := 0;
BEGIN
  FOR v_sub IN
    SELECT ss.*, s.school_name
    FROM public.school_subscriptions ss
    JOIN public.schools s ON s.id = ss.school_id
    WHERE ss.status IN ('active', 'expired')
       OR (ss.expires_at IS NOT NULL AND ss.expires_at <= v_now AND ss.status <> 'locked')
  LOOP
    IF v_sub.expires_at IS NOT NULL AND v_sub.expires_at <= v_now THEN
      IF v_sub.grace_period_ends_at IS NULL THEN
        UPDATE public.school_subscriptions SET
          status = 'expired',
          grace_period_ends_at = v_sub.expires_at + v_grace,
          reminder_day = 1,
          updated_at = v_now
        WHERE school_id = v_sub.school_id;
        PERFORM public.log_subscription_audit(v_sub.school_id, 'expiry', jsonb_build_object('school_name', v_sub.school_name));
        v_expired := v_expired + 1;
      ELSIF v_now > v_sub.grace_period_ends_at THEN
        UPDATE public.school_subscriptions SET
          status = 'locked',
          locked_at = v_now,
          updated_at = v_now
        WHERE school_id = v_sub.school_id;
        PERFORM public.log_subscription_audit(v_sub.school_id, 'account_lock', jsonb_build_object('reason', 'grace_period_ended'));
        v_locked := v_locked + 1;
      ELSIF v_sub.reminder_day < 3 THEN
        UPDATE public.school_subscriptions SET
          reminder_day = coalesce(v_sub.reminder_day, 0) + 1,
          updated_at = v_now
        WHERE school_id = v_sub.school_id;
        PERFORM public.log_subscription_audit(
          v_sub.school_id,
          'reminder',
          jsonb_build_object('day', coalesce(v_sub.reminder_day, 0) + 1)
        );
        v_reminded := v_reminded + 1;
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'expired', v_expired, 'reminded', v_reminded, 'locked', v_locked);
END;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.organization_subscription_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_subscription_checkouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "school admin read own subscription payments" ON public.organization_subscription_payments;
CREATE POLICY "school admin read own subscription payments" ON public.organization_subscription_payments
  FOR SELECT TO authenticated
  USING (
    school_id IN (SELECT p.school_id FROM public.profiles p WHERE p.id = auth.uid())
    OR public.is_platform_super_admin()
  );

DROP POLICY IF EXISTS "school admin read own subscription audit" ON public.subscription_audit_log;
CREATE POLICY "school admin read own subscription audit" ON public.subscription_audit_log
  FOR SELECT TO authenticated
  USING (
    school_id IN (SELECT p.school_id FROM public.profiles p WHERE p.id = auth.uid())
    OR public.is_platform_super_admin()
  );

DROP POLICY IF EXISTS "school admin read own checkouts" ON public.platform_subscription_checkouts;
CREATE POLICY "school admin read own checkouts" ON public.platform_subscription_checkouts
  FOR SELECT TO authenticated
  USING (
    school_id IN (SELECT p.school_id FROM public.profiles p WHERE p.id = auth.uid())
    OR public.is_platform_super_admin()
  );

GRANT EXECUTE ON FUNCTION public.get_organization_subscription_access(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_subscription_audit(uuid, text, jsonb, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.activate_organization_subscription(text, text, numeric, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.run_subscription_lifecycle_batch() TO service_role;

NOTIFY pgrst, 'reload schema';
