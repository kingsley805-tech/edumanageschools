-- Payment transaction tracking (mirrors public/sql/apply-payment-transactions.sql)

ALTER TABLE public.billing_payments
  ADD COLUMN IF NOT EXISTS student_id uuid REFERENCES public.students(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.parents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payer_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS paystack_transaction_id text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS gateway_config_id uuid,
  ADD COLUMN IF NOT EXISTS recorded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS receipt_url text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_billing_payments_student ON public.billing_payments(student_id);
CREATE INDEX IF NOT EXISTS idx_billing_payments_parent ON public.billing_payments(parent_id);
CREATE INDEX IF NOT EXISTS idx_billing_payments_paid_at ON public.billing_payments(school_id, paid_at DESC);
CREATE INDEX IF NOT EXISTS idx_billing_payments_gateway_ref ON public.billing_payments(gateway_ref) WHERE gateway_ref IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_billing_payments_gateway_ref
  ON public.billing_payments(gateway_ref)
  WHERE gateway_ref IS NOT NULL AND gateway_ref <> '';

UPDATE public.billing_payments bp
SET student_id = bi.student_id
FROM public.billing_invoices bi
WHERE bp.invoice_id = bi.id AND bp.student_id IS NULL AND bi.student_id IS NOT NULL;

UPDATE public.billing_payments bp
SET parent_id = st.guardian_id
FROM public.billing_invoices bi
JOIN public.students st ON st.id = bi.student_id
WHERE bp.invoice_id = bi.id AND bp.parent_id IS NULL AND st.guardian_id IS NOT NULL;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column' AND pronamespace = 'public'::regnamespace) THEN
    DROP TRIGGER IF EXISTS update_billing_payments_updated_at ON public.billing_payments;
    CREATE TRIGGER update_billing_payments_updated_at
      BEFORE UPDATE ON public.billing_payments
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.billing_payment_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  payment_id uuid REFERENCES public.billing_payments(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  from_status text,
  to_status text,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_payment_activity_payment ON public.billing_payment_activity(payment_id);
CREATE INDEX IF NOT EXISTS idx_billing_payment_activity_school ON public.billing_payment_activity(school_id, created_at DESC);

ALTER TABLE public.billing_payment_activity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff read payment activity" ON public.billing_payment_activity;
CREATE POLICY "staff read payment activity" ON public.billing_payment_activity
  FOR SELECT TO authenticated
  USING (
    school_id = public.get_user_school_id(auth.uid())
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

DROP POLICY IF EXISTS "staff insert payment activity" ON public.billing_payment_activity;
CREATE POLICY "staff insert payment activity" ON public.billing_payment_activity
  FOR INSERT TO authenticated
  WITH CHECK (
    school_id = public.get_user_school_id(auth.uid())
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

DROP POLICY IF EXISTS "students read own billing payments" ON public.billing_payments;
CREATE POLICY "students read own billing payments" ON public.billing_payments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.students st
      WHERE st.id = billing_payments.student_id AND st.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.billing_invoices bi
      JOIN public.students st ON st.id = bi.student_id
      WHERE bi.id = billing_payments.invoice_id AND st.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "parents read children billing payments" ON public.billing_payments;
CREATE POLICY "parents read children billing payments" ON public.billing_payments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.parents p
      WHERE p.id = billing_payments.parent_id AND p.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.billing_invoices bi
      JOIN public.students st ON st.id = bi.student_id
      JOIN public.parents p ON p.id = st.guardian_id
      WHERE bi.id = billing_payments.invoice_id AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "students read own billing invoices" ON public.billing_invoices;
CREATE POLICY "students read own billing invoices" ON public.billing_invoices
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.students st
      WHERE st.id = billing_invoices.student_id AND st.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "parents read children billing invoices" ON public.billing_invoices;
CREATE POLICY "parents read children billing invoices" ON public.billing_invoices
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.students st
      JOIN public.parents p ON p.id = st.guardian_id
      WHERE st.id = billing_invoices.student_id AND p.user_id = auth.uid()
    )
  );

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.billing_payments;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE VIEW public.payment_transactions_v AS
SELECT
  bp.id,
  bp.school_id,
  bp.invoice_id,
  bi.invoice_number,
  bp.student_id,
  coalesce(st.full_name, '—') AS student_name,
  bp.parent_id,
  coalesce(par.full_name, '—') AS parent_name,
  bp.amount,
  bp.currency,
  bp.method AS payment_method,
  bp.gateway AS payment_gateway,
  bp.gateway_ref AS payment_reference,
  coalesce(bp.paystack_transaction_id, (bp.metadata->>'paystack_transaction_id')) AS transaction_id,
  bp.status AS payment_status,
  bp.notes,
  trim(coalesce(bp.payer_name, '') || CASE WHEN bp.payer_role IS NOT NULL AND bp.payer_role <> '' THEN ' (' || bp.payer_role || ')' ELSE '' END) AS paid_by,
  bp.payer_name,
  bp.payer_role,
  bp.payer_user_id,
  bp.paid_at AS payment_date,
  bp.created_at,
  bp.updated_at,
  bp.receipt_url,
  bp.recorded_by,
  bp.payment_context
FROM public.billing_payments bp
LEFT JOIN public.billing_invoices bi ON bi.id = bp.invoice_id
LEFT JOIN public.students st ON st.id = coalesce(bp.student_id, bi.student_id)
LEFT JOIN public.parents par ON par.id = coalesce(bp.parent_id, st.guardian_id);

GRANT SELECT ON public.payment_transactions_v TO authenticated;

CREATE OR REPLACE FUNCTION public.notify_billing_payment_recorded()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv record;
  v_student record;
  v_parent_user uuid;
  v_title text;
  v_body text;
  v_admin record;
BEGIN
  IF NEW.status IS DISTINCT FROM 'paid'::public.billing_payment_status THEN
    RETURN NEW;
  END IF;

  SELECT bi.invoice_number, bi.student_id, bi.school_id
  INTO v_inv
  FROM public.billing_invoices bi
  WHERE bi.id = NEW.invoice_id;

  SELECT st.user_id, st.full_name, st.guardian_id
  INTO v_student
  FROM public.students st
  WHERE st.id = coalesce(NEW.student_id, v_inv.student_id);

  v_title := 'Payment received';
  v_body := format(
    '%s %s paid for invoice %s (ref: %s).',
    NEW.currency,
    NEW.amount::text,
    coalesce(v_inv.invoice_number, 'invoice'),
    coalesce(NEW.gateway_ref, 'manual')
  );

  IF v_student.user_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, body, data)
    VALUES (
      v_student.user_id,
      v_title,
      v_body,
      jsonb_build_object('type', 'payment_received', 'payment_id', NEW.id, 'invoice_id', NEW.invoice_id)
    );
  END IF;

  IF v_student.guardian_id IS NOT NULL THEN
    SELECT p.user_id INTO v_parent_user FROM public.parents p WHERE p.id = v_student.guardian_id;
    IF v_parent_user IS NOT NULL AND v_parent_user IS DISTINCT FROM v_student.user_id THEN
      INSERT INTO public.notifications (user_id, title, body, data)
      VALUES (
        v_parent_user,
        v_title,
        v_body,
        jsonb_build_object('type', 'payment_received', 'payment_id', NEW.id, 'invoice_id', NEW.invoice_id)
      );
    END IF;
  END IF;

  FOR v_admin IN
    SELECT p.id AS user_id
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id
    WHERE p.school_id = NEW.school_id
      AND ur.role IN ('admin'::app_role, 'accountant'::app_role)
  LOOP
    INSERT INTO public.notifications (user_id, title, body, data)
    VALUES (
      v_admin.user_id,
      'Fee payment recorded',
      v_body,
      jsonb_build_object('type', 'payment_received_admin', 'payment_id', NEW.id, 'invoice_id', NEW.invoice_id)
    );
  END LOOP;

  INSERT INTO public.billing_payment_activity (school_id, payment_id, actor_user_id, action, to_status, metadata)
  VALUES (
    NEW.school_id,
    NEW.id,
    NEW.payer_user_id,
    'payment_recorded',
    NEW.status::text,
    jsonb_build_object('gateway', NEW.gateway, 'gateway_ref', NEW.gateway_ref, 'amount', NEW.amount)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_billing_payment_recorded ON public.billing_payments;
CREATE TRIGGER trg_notify_billing_payment_recorded
  AFTER INSERT ON public.billing_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_billing_payment_recorded();

CREATE OR REPLACE FUNCTION public.refund_billing_payment(p_payment_id uuid, p_notes text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_pay record;
  v_inv record;
  v_new_paid numeric;
  v_balance numeric;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Please sign in.');
  END IF;

  IF NOT (
    public.has_role(v_uid, 'admin'::app_role)
    OR public.has_role(v_uid, 'accountant'::app_role)
    OR public.has_role(v_uid, 'super_admin'::app_role)
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized to refund payments.');
  END IF;

  SELECT * INTO v_pay FROM public.billing_payments WHERE id = p_payment_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Payment not found.');
  END IF;

  IF v_pay.school_id IS DISTINCT FROM public.get_user_school_id(v_uid)
     AND NOT public.has_role(v_uid, 'super_admin'::app_role) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Payment is not in your school.');
  END IF;

  IF v_pay.status = 'refunded'::public.billing_payment_status THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true);
  END IF;

  UPDATE public.billing_payments
  SET status = 'refunded'::public.billing_payment_status,
      notes = coalesce(p_notes, notes),
      updated_at = now()
  WHERE id = p_payment_id;

  SELECT * INTO v_inv FROM public.billing_invoices WHERE id = v_pay.invoice_id;

  SELECT coalesce(sum(amount), 0) INTO v_new_paid
  FROM public.billing_payments
  WHERE invoice_id = v_pay.invoice_id AND status = 'paid'::public.billing_payment_status;

  v_balance := greatest(0, coalesce(v_inv.total_amount, 0) - v_new_paid);

  UPDATE public.billing_invoices
  SET
    amount_paid = v_new_paid,
    balance_due = v_balance,
    status = CASE
      WHEN v_balance <= 0 THEN 'paid'::public.billing_invoice_status
      WHEN v_new_paid > 0 THEN 'partially_paid'::public.billing_invoice_status
      ELSE 'sent'::public.billing_invoice_status
    END,
    paid_at = CASE WHEN v_balance <= 0 THEN paid_at ELSE NULL END,
    updated_at = now()
  WHERE id = v_pay.invoice_id;

  INSERT INTO public.billing_payment_activity (school_id, payment_id, actor_user_id, action, from_status, to_status, notes)
  VALUES (v_pay.school_id, p_payment_id, v_uid, 'payment_refunded', v_pay.status::text, 'refunded', p_notes);

  RETURN jsonb_build_object('ok', true, 'amount_paid', v_new_paid, 'balance_due', v_balance);
END;
$$;

GRANT EXECUTE ON FUNCTION public.refund_billing_payment(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_billing_payment(p_payment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_pay record;
  v_inv record;
  v_new_paid numeric;
  v_balance numeric;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Please sign in.');
  END IF;

  IF NOT (
    public.has_role(v_uid, 'admin'::app_role)
    OR public.has_role(v_uid, 'super_admin'::app_role)
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Only school admins can delete payment records.');
  END IF;

  SELECT * INTO v_pay FROM public.billing_payments WHERE id = p_payment_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Payment not found.');
  END IF;

  IF v_pay.school_id IS DISTINCT FROM public.get_user_school_id(v_uid)
     AND NOT public.has_role(v_uid, 'super_admin'::app_role) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Payment is not in your school.');
  END IF;

  INSERT INTO public.billing_payment_activity (school_id, payment_id, actor_user_id, action, from_status, metadata)
  VALUES (v_pay.school_id, p_payment_id, v_uid, 'payment_deleted', v_pay.status::text, jsonb_build_object('amount', v_pay.amount, 'gateway_ref', v_pay.gateway_ref));

  DELETE FROM public.billing_payments WHERE id = p_payment_id;

  SELECT * INTO v_inv FROM public.billing_invoices WHERE id = v_pay.invoice_id;

  SELECT coalesce(sum(amount), 0) INTO v_new_paid
  FROM public.billing_payments
  WHERE invoice_id = v_pay.invoice_id AND status = 'paid'::public.billing_payment_status;

  v_balance := greatest(0, coalesce(v_inv.total_amount, 0) - v_new_paid);

  UPDATE public.billing_invoices
  SET
    amount_paid = v_new_paid,
    balance_due = v_balance,
    status = CASE
      WHEN v_balance <= 0 THEN 'paid'::public.billing_invoice_status
      WHEN v_new_paid > 0 THEN 'partially_paid'::public.billing_invoice_status
      ELSE 'sent'::public.billing_invoice_status
    END,
    paid_at = CASE WHEN v_balance <= 0 THEN paid_at ELSE NULL END,
    updated_at = now()
  WHERE id = v_pay.invoice_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_billing_payment(uuid) TO authenticated;
