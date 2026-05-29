-- Confirm Paystack payment without Edge Function (verify via Paystack API from DB)
-- Requires: http extension (Supabase Dashboard → Database → Extensions → http → Enable)
-- Also needs paystack secret in tenant_payment_gateway_configs.paystack_secret_key

CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.confirm_paystack_payment(p_reference text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_ref text := trim(coalesce(p_reference, ''));
  v_session record;
  v_secret text;
  v_http extensions.http_response;
  v_body jsonb;
  v_txn jsonb;
  v_status text;
  v_invoice_id uuid;
  v_school_id uuid;
  v_amount numeric;
  v_channel text;
  v_method public.billing_payment_method;
  v_currency text;
  v_txn_id text;
  v_inv record;
  v_student_id uuid;
  v_parent_id uuid;
  v_new_paid numeric;
  v_balance numeric;
  v_allowed boolean := false;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Please sign in again.');
  END IF;

  IF v_ref = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Missing payment reference.');
  END IF;

  IF EXISTS (SELECT 1 FROM public.billing_payments WHERE gateway_ref = v_ref) THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true);
  END IF;

  SELECT s.invoice_id, s.school_id, s.gateway_config_id
  INTO v_session
  FROM public.payment_checkout_sessions s
  WHERE s.reference = v_ref;

  IF v_session.invoice_id IS NOT NULL THEN
    v_invoice_id := v_session.invoice_id;
    v_school_id := v_session.school_id;
  END IF;

  SELECT coalesce(
    nullif(trim(c.paystack_secret_key), ''),
    ''
  )
  INTO v_secret
  FROM public.tenant_payment_gateway_configs c
  WHERE c.school_id = coalesce(v_school_id, c.school_id)
    AND c.provider = 'paystack'
    AND c.is_enabled = true
    AND (
      v_session.gateway_config_id IS NULL
      OR c.id = v_session.gateway_config_id
    )
  ORDER BY c.is_default DESC NULLS LAST, c.updated_at DESC NULLS LAST
  LIMIT 1;

  IF v_secret = '' OR v_secret IS NULL THEN
    SELECT coalesce(nullif(trim(c.paystack_secret_key), ''), '')
    INTO v_secret
    FROM public.tenant_payment_gateway_configs c
    WHERE c.provider = 'paystack'
      AND c.is_enabled = true
      AND nullif(trim(c.paystack_secret_key), '') IS NOT NULL
    LIMIT 1;
  END IF;

  IF v_secret = '' OR v_secret IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error',
      'Paystack secret key not configured. Admin: Payment gateways → save Secret key, or deploy the paystack Edge Function.'
    );
  END IF;

  BEGIN
    SELECT * INTO v_http
    FROM extensions.http((
      'GET',
      'https://api.paystack.co/transaction/verify/' || replace(v_ref, '/', ''),
      ARRAY[extensions.http_header('Authorization', 'Bearer ' || v_secret)],
      NULL::text,
      NULL::text
    )::extensions.http_request);
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error',
      'Could not call Paystack. Enable the http extension: Supabase Dashboard → Database → Extensions → http → Enable.'
    );
  END;

  IF v_http.status IS NULL OR v_http.status < 200 OR v_http.status >= 300 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Paystack verify request failed.');
  END IF;

  BEGIN
    v_body := v_http.content::jsonb;
  EXCEPTION WHEN OTHERS THEN
    BEGIN
      v_body := convert_from(v_http.content::bytea, 'UTF8')::jsonb;
    EXCEPTION WHEN OTHERS THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Invalid Paystack response.');
    END;
  END;

  IF NOT (
    lower(coalesce(v_body->>'status', '')) IN ('true', 't', '1')
    OR (v_body->'status')::text = 'true'
  ) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error',
      coalesce(v_body->>'message', 'Payment not verified with Paystack.')
    );
  END IF;

  v_txn := v_body->'data';
  v_status := coalesce(v_txn->>'status', '');

  IF v_status <> 'success' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Payment was not successful on Paystack.');
  END IF;

  v_invoice_id := coalesce(
    v_invoice_id,
    nullif(v_txn->'metadata'->>'invoice_id', '')::uuid
  );
  v_school_id := coalesce(
    v_school_id,
    nullif(v_txn->'metadata'->>'school_id', '')::uuid
  );

  IF v_invoice_id IS NULL OR v_school_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Could not link payment to an invoice.');
  END IF;

  SELECT * INTO v_inv
  FROM public.billing_invoices
  WHERE id = v_invoice_id AND school_id = v_school_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invoice not found.');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.id = v_inv.student_id AND s.user_id = v_uid
  ) OR EXISTS (
    SELECT 1
    FROM public.students s
    JOIN public.parents p ON p.id = s.guardian_id
    WHERE s.id = v_inv.student_id AND p.user_id = v_uid
  ) OR public.has_role(v_uid, 'admin'::app_role)
    OR public.has_role(v_uid, 'super_admin'::app_role)
    OR public.has_role(v_uid, 'accountant'::app_role)
  INTO v_allowed;

  IF NOT v_allowed THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not allowed to confirm this payment.');
  END IF;

  v_amount := round((coalesce((v_txn->>'amount')::numeric, 0) / 100.0)::numeric, 2);
  IF v_amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid payment amount.');
  END IF;

  v_channel := coalesce(v_txn->>'channel', '');
  v_method := CASE
    WHEN v_channel = 'mobile_money' THEN 'mobile_money'::public.billing_payment_method
    WHEN v_channel = 'card' THEN 'card'::public.billing_payment_method
    ELSE 'bank_transfer'::public.billing_payment_method
  END;
  v_currency := coalesce(v_txn->>'currency', v_inv.currency, 'GHS');
  v_txn_id := nullif(v_txn->>'id', '');

  v_student_id := v_inv.student_id;
  SELECT st.guardian_id INTO v_parent_id FROM public.students st WHERE st.id = v_student_id;

  INSERT INTO public.billing_payments (
    school_id,
    invoice_id,
    student_id,
    parent_id,
    amount,
    currency,
    method,
    gateway,
    gateway_ref,
    paystack_transaction_id,
    payer_user_id,
    status,
    paid_at,
    payment_context,
    metadata
  ) VALUES (
    v_school_id,
    v_invoice_id,
    v_student_id,
    v_parent_id,
    v_amount,
    v_currency,
    v_method,
    'paystack',
    v_ref,
    v_txn_id,
    v_uid,
    'paid',
    now(),
    'fees',
    jsonb_build_object('confirmed_via', 'confirm_paystack_payment_rpc')
  );

  v_new_paid := coalesce(v_inv.amount_paid, 0) + v_amount;
  v_balance := greatest(0, coalesce(v_inv.total_amount, 0) - v_new_paid);

  UPDATE public.billing_invoices
  SET
    amount_paid = v_new_paid,
    balance_due = v_balance,
    status = CASE
      WHEN v_balance <= 0 THEN 'paid'::public.billing_invoice_status
      ELSE 'partially_paid'::public.billing_invoice_status
    END,
    paid_at = CASE WHEN v_balance <= 0 THEN now() ELSE paid_at END,
    updated_at = now()
  WHERE id = v_invoice_id;

  RETURN jsonb_build_object('ok', true, 'duplicate', false);
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true);
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error',
      coalesce(SQLERRM, 'Failed to record payment.')
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_paystack_payment(text) TO authenticated;

NOTIFY pgrst, 'reload schema';
