-- Lets students/parents load merchant email + amount for Paystack (works with older paystack Edge Function too)
CREATE OR REPLACE FUNCTION public.get_paystack_checkout_context(p_invoice_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_inv record;
  v_outstanding numeric;
  v_email text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Please sign in again.');
  END IF;

  SELECT
    i.id,
    i.school_id,
    i.student_id,
    i.total_amount,
    i.amount_paid,
    i.balance_due,
    i.status
  INTO v_inv
  FROM public.billing_invoices i
  WHERE i.id = p_invoice_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invoice not found.');
  END IF;

  IF v_inv.status IN ('paid', 'void') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'This invoice is already paid or cancelled.');
  END IF;

  IF NOT (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = v_inv.student_id AND s.user_id = v_uid
    )
    OR EXISTS (
      SELECT 1
      FROM public.students s
      JOIN public.parents p ON p.id = s.guardian_id
      WHERE s.id = v_inv.student_id AND p.user_id = v_uid
    )
    OR public.has_role(v_uid, 'admin'::app_role)
    OR public.has_role(v_uid, 'super_admin'::app_role)
    OR public.has_role(v_uid, 'accountant'::app_role)
    OR public.has_role(v_uid, 'parent'::app_role)
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You are not allowed to pay this invoice.');
  END IF;

  v_outstanding := coalesce(
    v_inv.balance_due,
    greatest(0, coalesce(v_inv.total_amount, 0) - coalesce(v_inv.amount_paid, 0))
  );

  IF v_outstanding <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Nothing left to pay on this invoice.');
  END IF;

  SELECT g.merchant_email
  INTO v_email
  FROM public.tenant_payment_gateway_configs g
  WHERE g.school_id = v_inv.school_id
    AND g.provider = 'paystack'
    AND g.is_enabled = true
    AND nullif(trim(g.merchant_email), '') IS NOT NULL
  ORDER BY g.is_default DESC NULLS LAST, g.updated_at DESC NULLS LAST
  LIMIT 1;

  IF v_email IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error',
      'Merchant email is missing. Admin: Payment gateways → Paystack → Merchant email → Save.'
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'email', trim(v_email),
    'amount', v_outstanding
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_paystack_checkout_context(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
