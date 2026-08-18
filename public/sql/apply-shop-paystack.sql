-- Shop Paystack payments + product image storage

ALTER TABLE public.payment_checkout_sessions
  ALTER COLUMN invoice_id DROP NOT NULL;

ALTER TABLE public.payment_checkout_sessions
  ADD COLUMN IF NOT EXISTS shop_order_id uuid REFERENCES public.shop_orders(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_payment_checkout_sessions_shop_order
  ON public.payment_checkout_sessions (shop_order_id)
  WHERE shop_order_id IS NOT NULL;

ALTER TABLE public.shop_orders
  ADD COLUMN IF NOT EXISTS paystack_reference text,
  ADD COLUMN IF NOT EXISTS paystack_transaction_id text;

CREATE INDEX IF NOT EXISTS idx_shop_orders_paystack_ref
  ON public.shop_orders (paystack_reference)
  WHERE paystack_reference IS NOT NULL;

-- Checkout context for shop orders (same gateway as school fees)
CREATE OR REPLACE FUNCTION public.get_shop_paystack_checkout_context(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_order record;
  v_email text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Please sign in again.');
  END IF;

  SELECT
    o.id,
    o.school_id,
    o.order_number,
    o.total,
    o.payment_status,
    o.buyer_user_id
  INTO v_order
  FROM public.shop_orders o
  WHERE o.id = p_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Order not found.');
  END IF;

  IF v_order.payment_status = 'paid' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'This order is already paid.');
  END IF;

  IF v_order.buyer_user_id IS DISTINCT FROM v_uid
     AND NOT public.has_role(v_uid, 'admin'::app_role)
     AND NOT public.has_role(v_uid, 'super_admin'::app_role)
     AND NOT public.has_role(v_uid, 'accountant'::app_role) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not allowed to pay for this order.');
  END IF;

  IF public.get_user_school_id(v_uid) IS DISTINCT FROM v_order.school_id
     AND NOT public.has_role(v_uid, 'super_admin'::app_role) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Access denied.');
  END IF;

  SELECT coalesce(nullif(trim(g.merchant_email), ''), nullif(trim(g.public_key), ''))
  INTO v_email
  FROM public.tenant_payment_gateway_configs g
  WHERE g.school_id = v_order.school_id
    AND g.provider = 'paystack'
    AND g.is_enabled = true
  ORDER BY g.is_default DESC NULLS LAST, g.updated_at DESC NULLS LAST
  LIMIT 1;

  IF v_email IS NULL OR v_email = '' THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error',
      'Paystack is not configured. Admin: Payment gateways → enable Paystack and save keys.'
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'email', v_email,
    'amount', greatest(0, v_order.total),
    'order_number', v_order.order_number
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_shop_paystack_checkout_context(uuid) TO authenticated;

-- Confirm shop Paystack payment (verify via Paystack API from DB)
CREATE OR REPLACE FUNCTION public.confirm_shop_paystack_payment(p_reference text)
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
  v_order_id uuid;
  v_school_id uuid;
  v_amount numeric;
  v_txn_id text;
  v_order record;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Please sign in again.');
  END IF;

  IF v_ref = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Missing payment reference.');
  END IF;

  SELECT s.shop_order_id, s.school_id, s.gateway_config_id
  INTO v_session
  FROM public.payment_checkout_sessions s
  WHERE s.reference = v_ref;

  IF v_session.shop_order_id IS NOT NULL THEN
    v_order_id := v_session.shop_order_id;
    v_school_id := v_session.school_id;
  END IF;

  SELECT coalesce(nullif(trim(c.paystack_secret_key), ''), '')
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
    RETURN jsonb_build_object(
      'ok', false,
      'error',
      'Paystack secret key not configured. Admin: Payment gateways → save Secret key.'
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
      'Could not call Paystack. Enable the http extension in Supabase.'
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

  v_order_id := coalesce(
    v_order_id,
    nullif(v_txn->'metadata'->>'shop_order_id', '')::uuid
  );
  v_school_id := coalesce(
    v_school_id,
    nullif(v_txn->'metadata'->>'school_id', '')::uuid
  );

  IF v_order_id IS NULL OR v_school_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Could not link payment to a shop order.');
  END IF;

  SELECT * INTO v_order
  FROM public.shop_orders
  WHERE id = v_order_id AND school_id = v_school_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Shop order not found.');
  END IF;

  IF v_order.payment_status = 'paid' OR v_order.paystack_reference = v_ref THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true);
  END IF;

  IF v_order.buyer_user_id IS DISTINCT FROM v_uid
     AND NOT public.has_role(v_uid, 'admin'::app_role)
     AND NOT public.has_role(v_uid, 'super_admin'::app_role)
     AND NOT public.has_role(v_uid, 'accountant'::app_role) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not allowed to confirm this payment.');
  END IF;

  v_amount := round((coalesce((v_txn->>'amount')::numeric, 0) / 100.0)::numeric, 2);
  IF v_amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid payment amount.');
  END IF;

  v_txn_id := nullif(v_txn->>'id', '');

  UPDATE public.shop_orders
  SET
    payment_status = 'paid',
    paid_at = now(),
    paystack_reference = v_ref,
    paystack_transaction_id = v_txn_id,
    fulfillment_status = CASE
      WHEN fulfillment_status = 'pending' THEN 'processing'
      ELSE fulfillment_status
    END,
    updated_at = now()
  WHERE id = v_order_id;

  RETURN jsonb_build_object('ok', true, 'order_id', v_order_id, 'order_number', v_order.order_number);
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_shop_paystack_payment(text) TO authenticated;

-- Product images bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'shop-products',
  'shop-products',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS shop_products_storage_read ON storage.objects;
CREATE POLICY shop_products_storage_read ON storage.objects FOR SELECT
  USING (bucket_id = 'shop-products');

DROP POLICY IF EXISTS shop_products_storage_insert ON storage.objects;
CREATE POLICY shop_products_storage_insert ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'shop-products'
    AND (
      public.has_role(auth.uid(), 'super_admin'::app_role)
      OR (
        (storage.foldername(name))[1] = public.get_user_school_id(auth.uid())::text
        AND (
          public.has_role(auth.uid(), 'admin'::app_role)
          OR public.has_role(auth.uid(), 'accountant'::app_role)
        )
      )
    )
  );

DROP POLICY IF EXISTS shop_products_storage_update ON storage.objects;
CREATE POLICY shop_products_storage_update ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'shop-products'
    AND (
      public.has_role(auth.uid(), 'super_admin'::app_role)
      OR (
        (storage.foldername(name))[1] = public.get_user_school_id(auth.uid())::text
        AND (
          public.has_role(auth.uid(), 'admin'::app_role)
          OR public.has_role(auth.uid(), 'accountant'::app_role)
        )
      )
    )
  );

DROP POLICY IF EXISTS shop_products_storage_delete ON storage.objects;
CREATE POLICY shop_products_storage_delete ON storage.objects FOR DELETE
  USING (
    bucket_id = 'shop-products'
    AND (
      public.has_role(auth.uid(), 'super_admin'::app_role)
      OR (
        (storage.foldername(name))[1] = public.get_user_school_id(auth.uid())::text
        AND (
          public.has_role(auth.uid(), 'admin'::app_role)
          OR public.has_role(auth.uid(), 'accountant'::app_role)
        )
      )
    )
  );
