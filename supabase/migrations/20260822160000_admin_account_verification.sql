-- Administrator account verification: explicit approval status independent of payment.
-- Payment success alone must never grant portal access.

DO $$ BEGIN
  CREATE TYPE public.admin_approval_status AS ENUM (
    'pending_verification',
    'approved',
    'rejected'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS admin_approval_status public.admin_approval_status;

-- Backfill existing school administrators
UPDATE public.profiles p
SET admin_approval_status = COALESCE(
  (
    SELECT CASE
      WHEN ss.status = 'active' THEN 'approved'::public.admin_approval_status
      WHEN ss.status = 'pending' AND ss.plan_id IS NOT NULL THEN 'pending_verification'::public.admin_approval_status
      WHEN ss.status = 'locked' AND ss.plan_id IS NOT NULL THEN 'rejected'::public.admin_approval_status
      ELSE 'approved'::public.admin_approval_status
    END
    FROM public.school_subscriptions ss
    WHERE ss.school_id = p.school_id
  ),
  'approved'::public.admin_approval_status
)
WHERE p.admin_approval_status IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = p.id
      AND ur.role = 'admin'::public.app_role
  );

-- Support contact settings (used by pending verification page and contact flows)
INSERT INTO public.system_settings (key, value)
VALUES
  ('support_phone_primary', '+233 50 368 8781'),
  ('support_phone_secondary', '+233 50 323 0804'),
  ('support_email', 'edumanagesystems@gmail.com')
ON CONFLICT (key) DO NOTHING;

-- Returns true when an admin user may access the school portal (Super Admin bypass elsewhere).
CREATE OR REPLACE FUNCTION public.admin_account_portal_allowed(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status public.admin_approval_status;
  v_is_admin boolean;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN true;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = p_user_id AND ur.role = 'admin'::public.app_role
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RETURN true;
  END IF;

  SELECT p.admin_approval_status INTO v_status
  FROM public.profiles p
  WHERE p.id = p_user_id;

  -- Legacy admins without explicit status remain allowed when subscription is active
  IF v_status IS NULL THEN
    RETURN true;
  END IF;

  RETURN v_status = 'approved'::public.admin_approval_status;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_admin_verification_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status public.admin_approval_status;
  v_school_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;

  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RETURN jsonb_build_object('ok', true, 'is_admin', false, 'admin_approval_status', null);
  END IF;

  SELECT p.admin_approval_status, p.school_id
  INTO v_status, v_school_id
  FROM public.profiles p
  WHERE p.id = auth.uid();

  RETURN jsonb_build_object(
    'ok', true,
    'is_admin', true,
    'admin_approval_status', v_status,
    'school_id', v_school_id,
    'portal_allowed', public.admin_account_portal_allowed(auth.uid())
  );
END;
$$;

-- Signup: new school administrators start as pending verification
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_school_id uuid;
  v_school_code text;
  v_school_name text;
  v_school_id_meta text;
  v_role public.app_role;
  v_super_admin_key text;
  v_registration_number text;
  v_gender text;
  v_phone text;
  v_admission_prefix text;
  v_full_name text;
BEGIN
  v_role := (NEW.raw_user_meta_data->>'role')::public.app_role;
  v_school_code := NULLIF(trim(NEW.raw_user_meta_data->>'school_code'), '');
  v_school_id_meta := NULLIF(trim(NEW.raw_user_meta_data->>'school_id'), '');
  v_registration_number := NULLIF(trim(NEW.raw_user_meta_data->>'registration_number'), '');
  v_gender := NULLIF(trim(NEW.raw_user_meta_data->>'gender'), '');
  v_phone := NULLIF(trim(NEW.raw_user_meta_data->>'phone'), '');
  v_admission_prefix := NULLIF(trim(NEW.raw_user_meta_data->>'admission_prefix'), '');
  v_full_name := NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), '');

  IF v_role = 'super_admin' THEN
    SELECT decrypted_secret INTO v_super_admin_key
    FROM vault.decrypted_secrets
    WHERE name = 'SUPER_ADMIN'
    LIMIT 1;

    IF NEW.raw_user_meta_data->>'admin_key' IS DISTINCT FROM v_super_admin_key THEN
      RAISE EXCEPTION 'Invalid super admin key';
    END IF;

    INSERT INTO public.profiles (id, email, full_name, school_id)
    VALUES (NEW.id, NEW.email, v_full_name, NULL);

    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, v_role);
    RETURN NEW;
  END IF;

  IF v_role = 'admin' THEN
    v_school_name := NEW.raw_user_meta_data->>'school_name';

    IF v_school_code IS NULL OR v_school_name IS NULL THEN
      RAISE EXCEPTION 'School name and school code are required';
    END IF;

    IF EXISTS (SELECT 1 FROM public.schools WHERE school_code = upper(v_school_code)) THEN
      RAISE EXCEPTION 'School code already exists. Please choose a different code.';
    END IF;

    INSERT INTO public.schools (school_code, school_name, is_active, admission_prefix)
    VALUES (
      upper(v_school_code),
      v_school_name,
      true,
      upper(coalesce(
        v_admission_prefix,
        CASE
          WHEN length(regexp_replace(coalesce(v_school_name, ''), '[^a-zA-Z]', '', 'g')) >= 3 THEN
            substring(regexp_replace(coalesce(v_school_name, ''), '[^a-zA-Z]', '', 'g') from 1 for 3)
          WHEN length(regexp_replace(coalesce(v_school_name, ''), '[^a-zA-Z0-9]', '', 'g')) >= 3 THEN
            substring(regexp_replace(coalesce(v_school_name, ''), '[^a-zA-Z0-9]', '', 'g') from 1 for 3)
          ELSE upper(left(coalesce(v_school_code, 'SCH'), 3))
        END
      ))
    )
    RETURNING id INTO v_school_id;

    INSERT INTO public.school_subscriptions (school_id, status, read_only_on_expiry, block_login_on_expiry)
    VALUES (v_school_id, 'pending', true, false);

    PERFORM public.log_subscription_audit(
      v_school_id,
      'organization_registered',
      jsonb_build_object('school_code', upper(v_school_code), 'admin_user_id', NEW.id),
      NULL,
      NEW.id
    );
  ELSE
    IF v_school_id_meta IS NOT NULL THEN
      SELECT id INTO v_school_id
      FROM public.schools
      WHERE id = v_school_id_meta::uuid
        AND is_active = true;
    END IF;

    IF v_school_id IS NULL AND v_school_code IS NOT NULL THEN
      SELECT id INTO v_school_id
      FROM public.schools
      WHERE school_code = upper(v_school_code)
        AND is_active = true;
    END IF;

    IF v_school_id IS NULL THEN
      RAISE EXCEPTION 'Could not determine school for this account. Use a valid admission number or contact your school.';
    END IF;
  END IF;

  INSERT INTO public.profiles (id, email, full_name, school_id, phone, admin_approval_status)
  VALUES (
    NEW.id,
    NEW.email,
    v_full_name,
    v_school_id,
    v_phone,
    -- Admins stay unverified until after successful payment (set in activate_organization_subscription).
    NULL
  );

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, v_role);

  IF v_role = 'student' THEN
    INSERT INTO public.students (user_id, school_id, admission_no, admission_number, gender, full_name)
    VALUES (
      NEW.id,
      v_school_id,
      v_registration_number,
      v_registration_number,
      v_gender,
      v_full_name
    );
  ELSIF v_role = 'teacher' THEN
    INSERT INTO public.teachers (user_id, school_id, employee_no)
    VALUES (NEW.id, v_school_id, v_registration_number);
  ELSIF v_role = 'parent' THEN
    INSERT INTO public.parents (user_id, school_id, phone)
    VALUES (NEW.id, v_school_id, v_phone);
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'This admission or employee number is already registered.';
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Signup failed: %', SQLERRM;
END;
$$;

-- Access RPC: paid but not yet Super-Admin-approved → pending_verification
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
  v_admin_blocked boolean := false;
BEGIN
  IF p_school_id IS NULL THEN
    RETURN jsonb_build_object(
      'has_subscription_row', false,
      'access_state', 'legacy',
      'can_use_platform', true
    );
  END IF;

  IF auth.uid() IS NOT NULL
     AND public.has_role(auth.uid(), 'admin'::public.app_role)
     AND NOT public.admin_account_portal_allowed(auth.uid()) THEN
    v_admin_blocked := true;
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

  IF v_admin_blocked THEN
    -- Unpaid admins must complete subscription first (not verification).
    IF v_sub.plan_id IS NULL THEN
      RETURN jsonb_build_object(
        'has_subscription_row', true,
        'access_state', 'pending_payment',
        'can_use_platform', false,
        'admin_approval_status', (
          SELECT p.admin_approval_status::text FROM public.profiles p WHERE p.id = auth.uid()
        ),
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
    END IF;

    SELECT CASE p.admin_approval_status
      WHEN 'rejected'::public.admin_approval_status THEN 'rejected'
      ELSE 'pending_verification'
    END
    INTO v_access_state
    FROM public.profiles p
    WHERE p.id = auth.uid();

    RETURN jsonb_build_object(
      'has_subscription_row', true,
      'access_state', coalesce(v_access_state, 'pending_verification'),
      'can_use_platform', false,
      'admin_approval_status', (
        SELECT p.admin_approval_status::text FROM public.profiles p WHERE p.id = auth.uid()
      ),
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
  END IF;

  IF v_sub.status = 'pending' AND v_sub.plan_id IS NOT NULL THEN
    v_access_state := 'pending_verification';
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
    'admin_approval_status', (
      SELECT p.admin_approval_status::text FROM public.profiles p WHERE p.id = auth.uid()
    ),
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

  IF auth.uid() IS NOT NULL
     AND public.has_role(auth.uid(), 'admin'::public.app_role)
     AND NOT public.admin_account_portal_allowed(auth.uid()) THEN
    RETURN false;
  END IF;

  v_access := public.get_organization_subscription_access(p_school_id);
  IF (v_access->>'access_state') = 'legacy' THEN RETURN true; END IF;
  RETURN coalesce((v_access->>'can_use_platform')::boolean, false);
END;
$$;

-- Super Admin: approve organization and all its administrators
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

  UPDATE public.profiles p
  SET admin_approval_status = 'approved'::public.admin_approval_status
  FROM public.user_roles ur
  WHERE ur.user_id = p.id
    AND ur.role = 'admin'::public.app_role
    AND p.school_id = p_school_id;

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

-- Super Admin: reject organization administrators
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

  UPDATE public.profiles p
  SET admin_approval_status = 'rejected'::public.admin_approval_status
  FROM public.user_roles ur
  WHERE ur.user_id = p.id
    AND ur.role = 'admin'::public.app_role
    AND p.school_id = p_school_id;

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

-- First-time payment: keep org pending until Super Admin approves; set admin pending_verification
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

  IF NOT v_is_renewal THEN
    UPDATE public.profiles p
    SET admin_approval_status = 'pending_verification'::public.admin_approval_status
    FROM public.user_roles ur
    WHERE ur.user_id = p.id
      AND ur.role = 'admin'::public.app_role
      AND p.school_id = v_checkout.school_id
      AND (p.admin_approval_status IS NULL OR p.admin_approval_status = 'pending_verification'::public.admin_approval_status);
  END IF;

  PERFORM public.apply_subscription_plan_to_school_internal(v_checkout.school_id, v_checkout.plan_id);
  PERFORM public.sync_school_sms_entitlement(v_checkout.school_id);

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

CREATE OR REPLACE VIEW public.platform_tenant_overview_v AS
SELECT
  s.id AS school_id,
  s.school_name,
  s.school_code,
  coalesce(s.is_active, true) AS is_active,
  ss.status AS subscription_status,
  sp.slug AS plan_slug,
  sp.name AS plan_name,
  ss.expires_at,
  ss.trial_ends_at,
  ss.storage_used_mb,
  ss.storage_limit_mb,
  (SELECT count(*)::int FROM public.students st WHERE st.school_id = s.id) AS student_count,
  (SELECT count(*)::int FROM public.teachers t WHERE t.school_id = s.id) AS teacher_count,
  (SELECT count(*)::int FROM public.parents p WHERE p.school_id = s.id) AS parent_count,
  (SELECT count(*)::int FROM public.profiles pr WHERE pr.school_id = s.id) AS user_count,
  s.created_at,
  (
    SELECT p.email
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id
    WHERE p.school_id = s.id AND ur.role = 'admin'::public.app_role
    ORDER BY p.created_at ASC NULLS LAST
    LIMIT 1
  ) AS primary_admin_email,
  (
    SELECT p.full_name
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id
    WHERE p.school_id = s.id AND ur.role = 'admin'::public.app_role
    ORDER BY p.created_at ASC NULLS LAST
    LIMIT 1
  ) AS primary_admin_name,
  (
    SELECT p.phone
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id
    WHERE p.school_id = s.id AND ur.role = 'admin'::public.app_role
    ORDER BY p.created_at ASC NULLS LAST
    LIMIT 1
  ) AS primary_admin_phone,
  (
    SELECT p.admin_approval_status::text
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id
    WHERE p.school_id = s.id AND ur.role = 'admin'::public.app_role
    ORDER BY p.created_at ASC NULLS LAST
    LIMIT 1
  ) AS admin_approval_status,
  EXISTS (
    SELECT 1 FROM public.organization_subscription_payments osp
    WHERE osp.school_id = s.id AND osp.status = 'completed'
  ) AS payment_completed
FROM public.schools s
LEFT JOIN public.school_subscriptions ss ON ss.school_id = s.id
LEFT JOIN public.subscription_plans sp ON sp.id = ss.plan_id;

GRANT EXECUTE ON FUNCTION public.admin_account_portal_allowed(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_admin_verification_status() TO authenticated;

NOTIFY pgrst, 'reload schema';
