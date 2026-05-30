-- Fix: column "student_id" of relation "billing_payments" does not exist
-- Run in Supabase SQL editor before Paystack checkout / manual payments.

ALTER TABLE public.billing_payments
  ADD COLUMN IF NOT EXISTS student_id uuid REFERENCES public.students(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.parents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payer_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS paystack_transaction_id text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS recorded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS receipt_url text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_billing_payments_student ON public.billing_payments(student_id);
CREATE INDEX IF NOT EXISTS idx_billing_payments_parent ON public.billing_payments(parent_id);

UPDATE public.billing_payments bp
SET student_id = bi.student_id
FROM public.billing_invoices bi
WHERE bp.invoice_id = bi.id
  AND bp.student_id IS NULL
  AND bi.student_id IS NOT NULL;

UPDATE public.billing_payments bp
SET parent_id = st.guardian_id
FROM public.billing_invoices bi
JOIN public.students st ON st.id = bi.student_id
WHERE bp.invoice_id = bi.id
  AND bp.parent_id IS NULL
  AND st.guardian_id IS NOT NULL;

-- Portal read access (parents / students) — required for payment history GET
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
    OR EXISTS (
      SELECT 1 FROM public.billing_invoices bi
      JOIN public.parent_student_links psl ON psl.student_id = bi.student_id
      JOIN public.parents p ON p.id = psl.parent_id
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
    OR EXISTS (
      SELECT 1 FROM public.parent_student_links psl
      JOIN public.parents p ON p.id = psl.parent_id
      WHERE psl.student_id = billing_invoices.student_id AND p.user_id = auth.uid()
    )
  );

NOTIFY pgrst, 'reload schema';
