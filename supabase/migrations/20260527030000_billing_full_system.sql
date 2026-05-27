-- Full billing system (edubill-web-app port, school_id tenancy)

-- Extend billing invoices (term, line-item totals)
ALTER TABLE public.billing_invoices
  ADD COLUMN IF NOT EXISTS term_id uuid REFERENCES public.terms(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS subtotal numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_amount numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount numeric(12,2) NOT NULL DEFAULT 0;

-- Invoice line items
CREATE TABLE IF NOT EXISTS public.billing_invoice_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.billing_invoices(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity numeric(10,2) NOT NULL DEFAULT 1,
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  fee_item_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_invoice_line_items_invoice ON public.billing_invoice_line_items(invoice_id);

ALTER TABLE public.billing_invoice_line_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "school read billing line items" ON public.billing_invoice_line_items;
CREATE POLICY "school read billing line items" ON public.billing_invoice_line_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.billing_invoices i
      WHERE i.id = invoice_id
        AND (i.school_id = public.get_user_school_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'::app_role))
    )
  );

DROP POLICY IF EXISTS "finance manage billing line items" ON public.billing_invoice_line_items;
CREATE POLICY "finance manage billing line items" ON public.billing_invoice_line_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.billing_invoices i
      WHERE i.id = invoice_id
        AND (
          public.has_role(auth.uid(), 'admin'::app_role)
          OR public.has_role(auth.uid(), 'accountant'::app_role)
          OR public.has_role(auth.uid(), 'super_admin'::app_role)
        )
    )
  );

-- Fee categories
CREATE TABLE IF NOT EXISTS public.fee_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, name)
);

ALTER TABLE public.fee_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "school read fee categories" ON public.fee_categories;
CREATE POLICY "school read fee categories" ON public.fee_categories
  FOR SELECT USING (school_id = public.get_user_school_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "finance manage fee categories" ON public.fee_categories;
CREATE POLICY "finance manage fee categories" ON public.fee_categories
  FOR ALL USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'accountant'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  )
  WITH CHECK (school_id = public.get_user_school_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'::app_role));

-- Fee items (per term + category)
CREATE TABLE IF NOT EXISTS public.fee_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.fee_categories(id) ON DELETE CASCADE,
  term_id uuid NOT NULL REFERENCES public.terms(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'GHS',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fee_items_school ON public.fee_items(school_id);
CREATE INDEX IF NOT EXISTS idx_fee_items_term ON public.fee_items(term_id);

ALTER TABLE public.fee_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "school read fee items" ON public.fee_items;
CREATE POLICY "school read fee items" ON public.fee_items
  FOR SELECT USING (school_id = public.get_user_school_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "finance manage fee items" ON public.fee_items;
CREATE POLICY "finance manage fee items" ON public.fee_items
  FOR ALL USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'accountant'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  )
  WITH CHECK (school_id = public.get_user_school_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'::app_role));

-- Fee assignments (class or student)
CREATE TABLE IF NOT EXISTS public.fee_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  fee_item_id uuid NOT NULL REFERENCES public.fee_items(id) ON DELETE CASCADE,
  class_id uuid REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id uuid REFERENCES public.students(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fee_assignments_target_check CHECK (
    (class_id IS NOT NULL AND student_id IS NULL)
    OR (class_id IS NULL AND student_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_fee_assignments_unique_class_fee
  ON public.fee_assignments(fee_item_id, class_id) WHERE class_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_fee_assignments_unique_student_fee
  ON public.fee_assignments(fee_item_id, student_id) WHERE student_id IS NOT NULL;

ALTER TABLE public.fee_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "school read fee assignments" ON public.fee_assignments;
CREATE POLICY "school read fee assignments" ON public.fee_assignments
  FOR SELECT USING (school_id = public.get_user_school_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "finance manage fee assignments" ON public.fee_assignments;
CREATE POLICY "finance manage fee assignments" ON public.fee_assignments
  FOR ALL USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'accountant'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  )
  WITH CHECK (school_id = public.get_user_school_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'::app_role));

-- Reverse sent invoice (no payments recorded)
CREATE OR REPLACE FUNCTION public.reverse_billing_sent_invoice(p_invoice_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school uuid;
  v_status text;
  v_paid numeric;
BEGIN
  SELECT school_id, status::text, amount_paid INTO v_school, v_status, v_paid
  FROM public.billing_invoices WHERE id = p_invoice_id;
  IF v_school IS NULL THEN RAISE EXCEPTION 'Invoice not found'; END IF;
  IF NOT (
    public.is_school_admin(auth.uid(), v_school)
    OR public.has_role(auth.uid(), 'accountant'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF v_status NOT IN ('sent', 'viewed') OR COALESCE(v_paid, 0) > 0 THEN
    RAISE EXCEPTION 'Only sent/viewed invoices with no payments can be reversed';
  END IF;
  UPDATE public.billing_invoices SET status = 'draft', sent_at = NULL, updated_at = now()
  WHERE id = p_invoice_id;
END;
$$;

-- Reassign invoice to another student
CREATE OR REPLACE FUNCTION public.reassign_billing_invoice(
  p_invoice_id uuid,
  p_student_id uuid,
  p_term_id uuid DEFAULT NULL,
  p_due_date date DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school uuid;
  v_paid numeric;
  v_status text;
BEGIN
  SELECT school_id, amount_paid, status::text INTO v_school, v_paid, v_status
  FROM public.billing_invoices WHERE id = p_invoice_id;
  IF v_school IS NULL THEN RAISE EXCEPTION 'Invoice not found'; END IF;
  IF NOT (
    public.is_school_admin(auth.uid(), v_school)
    OR public.has_role(auth.uid(), 'accountant'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF COALESCE(v_paid, 0) > 0 OR v_status IN ('paid', 'void', 'partially_paid') THEN
    RAISE EXCEPTION 'Cannot reassign paid or void invoices';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.students s WHERE s.id = p_student_id AND s.school_id = v_school) THEN
    RAISE EXCEPTION 'Student not in this school';
  END IF;
  UPDATE public.billing_invoices
  SET
    student_id = p_student_id,
    term_id = COALESCE(p_term_id, term_id),
    due_date = COALESCE(p_due_date, due_date),
    updated_at = now()
  WHERE id = p_invoice_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reverse_billing_sent_invoice(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reassign_billing_invoice(uuid, uuid, uuid, date) TO authenticated;
