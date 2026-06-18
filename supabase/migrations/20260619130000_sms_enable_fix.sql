-- SMS enable fix: sms_enabled gates service; credits optional when add-on is active.

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
