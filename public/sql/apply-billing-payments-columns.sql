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

NOTIFY pgrst, 'reload schema';
