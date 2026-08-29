-- Mirror of public/sql/apply-sms-credit-refund.sql
CREATE OR REPLACE FUNCTION public.refund_school_sms_credit(p_school_id uuid, p_count int DEFAULT 1)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_balance int;
BEGIN
  IF p_count IS NULL OR p_count < 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid count');
  END IF;
  IF public.is_platform_super_admin() THEN
    RETURN jsonb_build_object('ok', true, 'super_admin_bypass', true);
  END IF;
  SELECT sms_balance INTO v_balance FROM public.school_subscriptions
  WHERE school_id = p_school_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', true, 'legacy', true); END IF;
  UPDATE public.school_subscriptions
  SET sms_balance = coalesce(sms_balance, 0) + p_count, updated_at = now()
  WHERE school_id = p_school_id;
  RETURN jsonb_build_object('ok', true, 'balance_after', coalesce(v_balance, 0) + p_count);
END;
$$;
GRANT EXECUTE ON FUNCTION public.refund_school_sms_credit(uuid, int) TO authenticated, service_role;
