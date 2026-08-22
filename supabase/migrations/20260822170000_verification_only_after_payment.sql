-- Verification page only after payment. Signup must stay on subscription / pending_payment.

-- Clear premature pending_verification for unpaid admins
UPDATE public.profiles p
SET admin_approval_status = NULL
WHERE p.admin_approval_status = 'pending_verification'::public.admin_approval_status
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = p.id AND ur.role = 'admin'::public.app_role
  )
  AND EXISTS (
    SELECT 1 FROM public.school_subscriptions ss
    WHERE ss.school_id = p.school_id
      AND ss.plan_id IS NULL
  );

-- Signup: do not mark admins pending_verification until payment succeeds
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
  VALUES (NEW.id, NEW.email, v_full_name, v_school_id, v_phone, NULL);

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

NOTIFY pgrst, 'reload schema';
