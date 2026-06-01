-- Subscription reminders (in-app + outbound payload), complimentary grant for super admin
-- Run after apply-organization-subscription-billing.sql

CREATE OR REPLACE FUNCTION public.notify_school_admins_subscription(
  p_school_id uuid,
  p_title text,
  p_body text,
  p_data jsonb DEFAULT '{}'::jsonb
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int := 0;
BEGIN
  INSERT INTO public.notifications (user_id, title, body, data, read)
  SELECT p.id, p_title, p_body, p_data, false
  FROM public.profiles p
  INNER JOIN public.user_roles ur ON ur.user_id = p.id
  WHERE p.school_id = p_school_id AND ur.role = 'admin';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

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
  v_period_end timestamptz;
  v_cycle text;
BEGIN
  IF NOT public.is_platform_super_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Forbidden');
  END IF;

  SELECT * INTO v_plan FROM public.subscription_plans WHERE id = p_plan_id AND is_active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Plan not found');
  END IF;

  v_cycle := CASE WHEN p_billing_cycle = 'monthly' THEN 'monthly' ELSE 'annual' END;
  v_period_end := coalesce(
    p_expires_at,
    CASE v_cycle
      WHEN 'monthly' THEN now() + interval '30 days'
      ELSE now() + interval '365 days'
    END
  );

  INSERT INTO public.school_subscriptions (
    school_id, plan_id, status, billing_cycle, started_at, expires_at,
    grace_period_ends_at, reminder_day, locked_at, amount_paid,
    storage_limit_mb, renewed_at, updated_at
  ) VALUES (
    p_school_id, p_plan_id, 'active', v_cycle, now(), v_period_end,
    NULL, 0, NULL, 0,
    v_plan.max_storage_gb * 1024, now(), now()
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
    updated_at = now();

  PERFORM public.apply_subscription_plan_to_school_internal(p_school_id, p_plan_id);

  PERFORM public.log_subscription_audit(
    p_school_id,
    'complimentary_grant',
    jsonb_build_object(
      'plan_id', p_plan_id,
      'billing_cycle', v_cycle,
      'expires_at', v_period_end
    ),
    NULL,
    auth.uid()
  );

  RETURN jsonb_build_object('ok', true, 'expires_at', v_period_end);
END;
$$;

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
  v_notifications jsonb := '[]'::jsonb;
  v_day int;
  v_title text;
  v_body text;
  v_admin record;
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
        v_title := 'Subscription expired';
        v_body := format(
          'Your subscription for %s expired on %s. Renew within 3 days to avoid account lock.',
          v_sub.school_name,
          to_char(v_sub.expires_at, 'Mon DD, YYYY')
        );

        UPDATE public.school_subscriptions SET
          status = 'expired',
          grace_period_ends_at = v_sub.expires_at + v_grace,
          reminder_day = 1,
          updated_at = v_now
        WHERE school_id = v_sub.school_id;

        PERFORM public.notify_school_admins_subscription(
          v_sub.school_id, v_title, v_body,
          jsonb_build_object('type', 'expiry', 'school_id', v_sub.school_id)
        );
        PERFORM public.log_subscription_audit(
          v_sub.school_id, 'expiry',
          jsonb_build_object('school_name', v_sub.school_name)
        );

        FOR v_admin IN
          SELECT p.email, p.phone, p.full_name
          FROM public.profiles p
          INNER JOIN public.user_roles ur ON ur.user_id = p.id
          WHERE p.school_id = v_sub.school_id AND ur.role = 'admin'
        LOOP
          v_notifications := v_notifications || jsonb_build_object(
            'school_id', v_sub.school_id,
            'school_name', v_sub.school_name,
            'type', 'expiry',
            'day', 1,
            'email', v_admin.email,
            'phone', v_admin.phone,
            'admin_name', v_admin.full_name,
            'title', v_title,
            'body', v_body
          );
        END LOOP;

        v_expired := v_expired + 1;
      ELSIF v_now > v_sub.grace_period_ends_at THEN
        v_title := 'Account locked';
        v_body := format(
          'Your organization %s has been locked after the grace period. Renew your subscription to restore access.',
          v_sub.school_name
        );

        UPDATE public.school_subscriptions SET
          status = 'locked',
          locked_at = v_now,
          updated_at = v_now
        WHERE school_id = v_sub.school_id;

        PERFORM public.notify_school_admins_subscription(
          v_sub.school_id, v_title, v_body,
          jsonb_build_object('type', 'account_lock', 'school_id', v_sub.school_id)
        );
        PERFORM public.log_subscription_audit(
          v_sub.school_id, 'account_lock',
          jsonb_build_object('reason', 'grace_period_ended')
        );

        FOR v_admin IN
          SELECT p.email, p.phone, p.full_name
          FROM public.profiles p
          INNER JOIN public.user_roles ur ON ur.user_id = p.id
          WHERE p.school_id = v_sub.school_id AND ur.role = 'admin'
        LOOP
          v_notifications := v_notifications || jsonb_build_object(
            'school_id', v_sub.school_id,
            'school_name', v_sub.school_name,
            'type', 'account_lock',
            'email', v_admin.email,
            'phone', v_admin.phone,
            'admin_name', v_admin.full_name,
            'title', v_title,
            'body', v_body
          );
        END LOOP;

        v_locked := v_locked + 1;
      ELSIF v_sub.reminder_day < 3 THEN
        v_day := coalesce(v_sub.reminder_day, 0) + 1;
        IF v_day >= 3 THEN
          v_title := 'Final subscription reminder';
          v_body := format(
            'Final reminder: %s will be locked tomorrow if subscription payment is not received.',
            v_sub.school_name
          );
        ELSE
          v_title := format('Subscription reminder (day %s of 3)', v_day);
          v_body := format(
            'Your subscription for %s is in grace period. Please renew to keep access.',
            v_sub.school_name
          );
        END IF;

        UPDATE public.school_subscriptions SET
          reminder_day = v_day,
          updated_at = v_now
        WHERE school_id = v_sub.school_id;

        PERFORM public.notify_school_admins_subscription(
          v_sub.school_id, v_title, v_body,
          jsonb_build_object('type', 'reminder', 'day', v_day, 'school_id', v_sub.school_id)
        );
        PERFORM public.log_subscription_audit(
          v_sub.school_id, 'reminder',
          jsonb_build_object('day', v_day)
        );

        FOR v_admin IN
          SELECT p.email, p.phone, p.full_name
          FROM public.profiles p
          INNER JOIN public.user_roles ur ON ur.user_id = p.id
          WHERE p.school_id = v_sub.school_id AND ur.role = 'admin'
        LOOP
          v_notifications := v_notifications || jsonb_build_object(
            'school_id', v_sub.school_id,
            'school_name', v_sub.school_name,
            'type', 'reminder',
            'day', v_day,
            'email', v_admin.email,
            'phone', v_admin.phone,
            'admin_name', v_admin.full_name,
            'title', v_title,
            'body', v_body
          );
        END LOOP;

        v_reminded := v_reminded + 1;
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'expired', v_expired,
    'reminded', v_reminded,
    'locked', v_locked,
    'notifications', v_notifications
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.notify_school_admins_subscription(uuid, text, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.grant_complimentary_subscription(uuid, uuid, text, timestamptz) TO authenticated;

NOTIFY pgrst, 'reload schema';
