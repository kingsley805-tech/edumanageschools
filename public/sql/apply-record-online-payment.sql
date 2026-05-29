-- Record an online payment on an invoice (fallback when paystack Edge Function fails)
-- Admin/accountant only — use after verifying payment in Paystack dashboard.

CREATE OR REPLACE FUNCTION public.record_online_payment_for_invoice(
  p_invoice_id uuid,
  p_amount numeric,
  p_gateway_ref text,
  p_method text DEFAULT 'card'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_inv record;
  v_new_paid numeric;
  v_balance numeric;
  v_method public.billing_payment_method;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Please sign in.');
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Amount must be greater than zero.');
  END IF;

  IF p_gateway_ref IS NULL OR trim(p_gateway_ref) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Payment reference is required.');
  END IF;

  IF NOT (
    public.has_role(v_uid, 'admin'::app_role)
    OR public.has_role(v_uid, 'super_admin'::app_role)
    OR public.has_role(v_uid, 'accountant'::app_role)
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Only school finance staff can record payments this way.');
  END IF;

  SELECT id, school_id, total_amount, amount_paid, balance_due, status, currency
  INTO v_inv
  FROM public.billing_invoices
  WHERE id = p_invoice_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invoice not found.');
  END IF;

  IF v_inv.school_id IS DISTINCT FROM public.get_user_school_id(v_uid)
     AND NOT public.has_role(v_uid, 'super_admin'::app_role) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invoice is not in your school.');
  END IF;

  IF EXISTS (SELECT 1 FROM public.billing_payments WHERE gateway_ref = trim(p_gateway_ref)) THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true);
  END IF;

  v_method := CASE
    WHEN lower(trim(p_method)) IN ('card', 'mobile_money', 'bank_transfer', 'ussd', 'cash') THEN
      lower(trim(p_method))::public.billing_payment_method
    ELSE 'card'::public.billing_payment_method
  END;

  INSERT INTO public.billing_payments (
    school_id, invoice_id, student_id, parent_id, amount, currency, method, gateway, gateway_ref, status, paid_at, payment_context, recorded_by
  ) VALUES (
    v_inv.school_id,
    v_inv.id,
    v_inv.student_id,
    (SELECT st.guardian_id FROM public.students st WHERE st.id = v_inv.student_id),
    p_amount,
    coalesce(v_inv.currency, 'GHS'),
    v_method,
    'paystack',
    trim(p_gateway_ref),
    'paid',
    now(),
    'fees',
    v_uid
  );

  v_new_paid := coalesce(v_inv.amount_paid, 0) + p_amount;
  v_balance := greatest(0, coalesce(v_inv.total_amount, 0) - v_new_paid);

  UPDATE public.billing_invoices
  SET
    amount_paid = v_new_paid,
    balance_due = v_balance,
    status = CASE WHEN v_balance <= 0 THEN 'paid'::public.billing_invoice_status ELSE 'partially_paid'::public.billing_invoice_status END,
    paid_at = CASE WHEN v_balance <= 0 THEN now() ELSE paid_at END,
    updated_at = now()
  WHERE id = v_inv.id;

  RETURN jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'amount_paid', v_new_paid,
    'balance_due', v_balance
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_online_payment_for_invoice(uuid, numeric, text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
