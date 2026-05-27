-- Billing Report System (ported from edubill-web-app, adapted to school-hub school_id tenancy)

DO $$ BEGIN
  CREATE TYPE public.billing_invoice_status AS ENUM ('draft', 'sent', 'viewed', 'partially_paid', 'paid', 'overdue', 'void');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.billing_payment_status AS ENUM ('pending', 'processing', 'paid', 'failed', 'refunded', 'disputed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.billing_payment_gateway AS ENUM ('paystack', 'stripe', 'flutterwave', 'manual');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.billing_payment_method AS ENUM ('card', 'mobile_money', 'bank_transfer', 'ussd', 'cash');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Invoices (school scoped, student as recipient)
CREATE TABLE IF NOT EXISTS public.billing_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  invoice_number text NOT NULL,
  student_id uuid REFERENCES public.students(id) ON DELETE SET NULL,
  issued_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status public.billing_invoice_status NOT NULL DEFAULT 'draft',
  currency text NOT NULL DEFAULT 'GHS',
  total_amount numeric(12,2) NOT NULL DEFAULT 0,
  amount_paid numeric(12,2) NOT NULL DEFAULT 0,
  balance_due numeric(12,2),
  due_date date NOT NULL,
  sent_at timestamptz,
  paid_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, invoice_number)
);

CREATE INDEX IF NOT EXISTS idx_billing_invoices_school_status ON public.billing_invoices(school_id, status);
CREATE INDEX IF NOT EXISTS idx_billing_invoices_student ON public.billing_invoices(student_id);

-- Payments
CREATE TABLE IF NOT EXISTS public.billing_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES public.billing_invoices(id) ON DELETE RESTRICT,
  gateway public.billing_payment_gateway NOT NULL DEFAULT 'manual',
  gateway_ref text,
  method public.billing_payment_method NOT NULL DEFAULT 'cash',
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'GHS',
  status public.billing_payment_status NOT NULL DEFAULT 'pending',
  paid_at timestamptz,
  payer_name text,
  payer_role text,
  payment_context text NOT NULL DEFAULT 'fees',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_payments_school_status ON public.billing_payments(school_id, status);
CREATE INDEX IF NOT EXISTS idx_billing_payments_invoice ON public.billing_payments(invoice_id);

ALTER TABLE public.billing_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_payments ENABLE ROW LEVEL SECURITY;

-- School members can read their school's billing data
DROP POLICY IF EXISTS "school members read billing invoices" ON public.billing_invoices;
CREATE POLICY "school members read billing invoices" ON public.billing_invoices
  FOR SELECT USING (school_id = public.get_user_school_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "school members read billing payments" ON public.billing_payments;
CREATE POLICY "school members read billing payments" ON public.billing_payments
  FOR SELECT USING (school_id = public.get_user_school_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'::app_role));

-- Only finance/admin staff can write (kept simple; app enforces finer permissions)
DROP POLICY IF EXISTS "admins manage billing invoices" ON public.billing_invoices;
CREATE POLICY "admins manage billing invoices" ON public.billing_invoices
  FOR ALL USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'accountant'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  )
  WITH CHECK (school_id = public.get_user_school_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "admins manage billing payments" ON public.billing_payments;
CREATE POLICY "admins manage billing payments" ON public.billing_payments
  FOR ALL USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'accountant'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  )
  WITH CHECK (school_id = public.get_user_school_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'::app_role));

-- updated_at trigger (reuse existing helper if present)
DO $$ BEGIN
  PERFORM 1 FROM pg_proc WHERE proname = 'update_updated_at_column' AND pronamespace = 'public'::regnamespace;
  IF FOUND THEN
    DROP TRIGGER IF EXISTS update_billing_invoices_updated_at ON public.billing_invoices;
    CREATE TRIGGER update_billing_invoices_updated_at
    BEFORE UPDATE ON public.billing_invoices
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

