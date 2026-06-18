-- Initialize platform subscription Paystack checkout from the database (package + SMS total).
-- Use when the paystack Edge Function is not redeployed yet.
-- Requires: http extension (Dashboard → Database → Extensions → http → Enable)
-- Requires: platform_payment_gateway.secret_key (Super Admin → Platform payment gateway)
-- Run after apply-sms-subscription-billing.sql

CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.init_platform_subscription_checkout(
  p_plan_id uuid,
  p_billing_cycle text DEFAULT 'monthly',
  p_enable_sms boolean DEFAULT false,
  p_package_amount numeric DEFAULT NULL,
  p_sms_amount numeric DEFAULT NULL,
  p_total_amount numeric DEFAULT NULL,
  p_callback_url text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_school_id uuid;
  v_email text;
  v_full_name text;
  v_plan public.subscription_plans%ROWTYPE;
  v_billing_cycle text := CASE WHEN lower(trim(coalesce(p_billing_cycle, ''))) = 'annual' THEN 'annual' ELSE 'monthly' END;
  v_plan_package numeric;
  v_plan_sms numeric;
  v_package_amount numeric;
  v_sms_amount numeric;
  v_amount numeric;
  v_enable_sms boolean := coalesce(p_enable_sms, false);
  v_secret text;
  v_reference text;
  v_callback text;
  v_payload jsonb;
  v_http extensions.http_response;
  v_body jsonb;
  v_auth_url text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('error', 'Please sign in again.');
  END IF;

  IF NOT public.has_role(v_uid, 'admin'::app_role) THEN
    RETURN jsonb_build_object('error', 'Forbidden');
  END IF;

  SELECT p.school_id, nullif(trim(p.email), ''), nullif(trim(p.full_name), '')
  INTO v_school_id, v_email, v_full_name
  FROM public.profiles p
  WHERE p.id = v_uid;

  IF v_school_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Organization not found');
  END IF;

  IF v_email IS NULL THEN
    SELECT nullif(trim(u.email), '') INTO v_email FROM auth.users u WHERE u.id = v_uid;
  END IF;

  IF v_email IS NULL THEN
    RETURN jsonb_build_object('error', 'Admin email is required for payment');
  END IF;

  SELECT * INTO v_plan FROM public.subscription_plans WHERE id = p_plan_id AND is_active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Plan not found');
  END IF;

  v_plan_package := CASE v_billing_cycle
    WHEN 'annual' THEN coalesce(v_plan.price_annual, 0)
    ELSE coalesce(v_plan.price_monthly, 0)
  END;
  v_plan_sms := CASE v_billing_cycle
    WHEN 'annual' THEN coalesce(v_plan.sms_addon_fee_annual, 0)
    ELSE coalesce(v_plan.sms_addon_fee_monthly, 0)
  END;

  v_package_amount := CASE
    WHEN p_package_amount IS NOT NULL AND p_package_amount >= 0 THEN p_package_amount
    ELSE v_plan_package
  END;

  v_sms_amount := 0;
  IF p_sms_amount IS NOT NULL AND p_sms_amount > 0 THEN
    v_sms_amount := p_sms_amount;
  ELSIF v_enable_sms AND v_plan_sms > 0 THEN
    v_sms_amount := v_plan_sms;
  END IF;

  v_amount := v_package_amount + v_sms_amount;
  IF p_total_amount IS NOT NULL AND p_total_amount >= v_package_amount THEN
    v_amount := p_total_amount;
    v_sms_amount := greatest(0, v_amount - v_package_amount);
  END IF;

  v_enable_sms := v_enable_sms OR v_sms_amount > 0;

  IF v_enable_sms AND v_sms_amount <= 0 THEN
    RETURN jsonb_build_object('error', 'SMS add-on is enabled but no SMS fee is configured');
  END IF;

  IF v_amount < v_package_amount OR v_amount <= 0 THEN
    RETURN jsonb_build_object('error', 'Invalid checkout total');
  END IF;

  SELECT nullif(trim(secret_key), '') INTO v_secret
  FROM public.platform_payment_gateway
  WHERE provider = 'paystack' AND coalesce(is_enabled, true) = true
  LIMIT 1;

  IF v_secret IS NULL THEN
    RETURN jsonb_build_object(
      'error',
      'Platform Paystack is not configured. Super Admin: Platform → Payment gateway → save Secret key.'
    );
  END IF;

  v_reference := 'ORG-SUB-' || substr(replace(v_school_id::text, '-', ''), 1, 8) || '-' ||
    floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint;
  v_callback := coalesce(nullif(trim(p_callback_url), ''), '/admin/subscription');

  BEGIN
    INSERT INTO public.platform_subscription_checkouts (
      reference, school_id, plan_id, billing_cycle, amount,
      package_amount, sms_amount, enable_sms, created_by
    ) VALUES (
      v_reference, v_school_id, p_plan_id, v_billing_cycle, v_amount,
      v_package_amount, v_sms_amount, v_enable_sms, v_uid
    );
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM ILIKE '%column%' THEN
        INSERT INTO public.platform_subscription_checkouts (
          reference, school_id, plan_id, billing_cycle, amount, created_by
        ) VALUES (
          v_reference, v_school_id, p_plan_id, v_billing_cycle, v_amount, v_uid
        );
      ELSE
        RAISE;
      END IF;
  END;

  v_payload := jsonb_build_object(
    'email', v_email,
    'amount', round(v_amount * 100)::bigint,
    'currency', 'GHS',
    'reference', v_reference,
    'callback_url', v_callback,
    'metadata', jsonb_build_object(
      'payment_context', 'platform_subscription',
      'school_id', v_school_id,
      'plan_id', p_plan_id,
      'billing_cycle', v_billing_cycle,
      'enable_sms', v_enable_sms,
      'package_amount', v_package_amount,
      'sms_amount', v_sms_amount,
      'total_amount', v_amount,
      'payer_user_id', v_uid,
      'payer_name', coalesce(v_full_name, v_email)
    )
  );

  BEGIN
    SELECT * INTO v_http FROM extensions.http((
      'POST',
      'https://api.paystack.co/transaction/initialize',
      ARRAY[
        extensions.http_header('Authorization', 'Bearer ' || v_secret),
        extensions.http_header('Content-Type', 'application/json')
      ],
      'application/json',
      v_payload::text
    )::extensions.http_request);
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'error',
      'Could not call Paystack. Enable the http extension: Supabase Dashboard → Database → Extensions → http → Enable.'
    );
  END;

  IF v_http.status IS NULL OR v_http.status < 200 OR v_http.status >= 300 THEN
    RETURN jsonb_build_object('error', 'Paystack initialization failed');
  END IF;

  BEGIN
    v_body := v_http.content::jsonb;
  EXCEPTION WHEN OTHERS THEN
    BEGIN
      v_body := convert_from(v_http.content::bytea, 'UTF8')::jsonb;
    EXCEPTION WHEN OTHERS THEN
      RETURN jsonb_build_object('error', 'Invalid Paystack response.');
    END;
  END;

  IF coalesce(v_body->>'status', 'false') <> 'true' THEN
    RETURN jsonb_build_object('error', coalesce(v_body->>'message', 'Paystack initialization failed'));
  END IF;

  v_auth_url := v_body->'data'->>'authorization_url';

  RETURN jsonb_build_object(
    'authorization_url', v_auth_url,
    'reference', coalesce(v_body->'data'->>'reference', v_reference),
    'package_amount', v_package_amount,
    'sms_amount', v_sms_amount,
    'total_amount', v_amount,
    'enable_sms', v_enable_sms
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.init_platform_subscription_checkout(
  uuid, text, boolean, numeric, numeric, numeric, text
) TO authenticated;
