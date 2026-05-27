-- Multi-Child Consolidated Billing Engine
-- Family ledger: billing_accounts -> account_invoices -> account_invoice_items
-- Payment waterfall via allocate_account_payment()

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.billing_account_status AS ENUM ('active', 'suspended', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.fee_scope AS ENUM ('global', 'grade', 'student');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.account_invoice_status AS ENUM (
    'draft', 'issued', 'partially_paid', 'paid', 'void', 'overdue'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.account_payment_status AS ENUM (
    'pending', 'completed', 'failed', 'refunded'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.billing_job_status AS ENUM ('queued', 'running', 'completed', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- Extend fee_categories (priority for payment waterfall)
-- ---------------------------------------------------------------------------
ALTER TABLE public.fee_categories
  ADD COLUMN IF NOT EXISTS code text,
  ADD COLUMN IF NOT EXISTS default_priority smallint NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

UPDATE public.fee_categories
SET code = upper(regexp_replace(name, '[^a-zA-Z0-9]+', '_', 'g'))
WHERE code IS NULL;

-- ---------------------------------------------------------------------------
-- Billing accounts (family ledger)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.billing_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  account_no text NOT NULL,
  primary_parent_id uuid NOT NULL REFERENCES public.parents(id),
  display_name text,
  status public.billing_account_status NOT NULL DEFAULT 'active',
  balance_due numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'GHS',
  payment_method_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, account_no)
);

CREATE INDEX IF NOT EXISTS idx_billing_accounts_school ON public.billing_accounts(school_id);
CREATE INDEX IF NOT EXISTS idx_billing_accounts_parent ON public.billing_accounts(primary_parent_id);

CREATE TABLE IF NOT EXISTS public.billing_account_students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_account_id uuid NOT NULL REFERENCES public.billing_accounts(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  is_primary boolean NOT NULL DEFAULT true,
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_to date,
  UNIQUE (billing_account_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_bas_student ON public.billing_account_students(student_id);
CREATE INDEX IF NOT EXISTS idx_bas_account ON public.billing_account_students(billing_account_id);

-- ---------------------------------------------------------------------------
-- Fee templates (global / grade / student scope)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fee_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  fee_category_id uuid NOT NULL REFERENCES public.fee_categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  scope public.fee_scope NOT NULL,
  class_id uuid REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id uuid REFERENCES public.students(id) ON DELETE CASCADE,
  academic_term text NOT NULL,
  term_id uuid REFERENCES public.terms(id) ON DELETE SET NULL,
  due_day_of_month smallint,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fee_templates_scope_check CHECK (
    (scope = 'global' AND class_id IS NULL AND student_id IS NULL)
    OR (scope = 'grade' AND class_id IS NOT NULL AND student_id IS NULL)
    OR (scope = 'student' AND student_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_fee_templates_school_term ON public.fee_templates(school_id, academic_term);
CREATE INDEX IF NOT EXISTS idx_fee_templates_class ON public.fee_templates(class_id) WHERE class_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fee_templates_student ON public.fee_templates(student_id) WHERE student_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Consolidated invoices (per family account)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.account_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  billing_account_id uuid NOT NULL REFERENCES public.billing_accounts(id) ON DELETE CASCADE,
  invoice_no text NOT NULL,
  academic_term text NOT NULL,
  term_id uuid REFERENCES public.terms(id) ON DELETE SET NULL,
  total_amount numeric(12,2) NOT NULL DEFAULT 0,
  total_paid numeric(12,2) NOT NULL DEFAULT 0,
  status public.account_invoice_status NOT NULL DEFAULT 'draft',
  due_date date NOT NULL,
  issued_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, invoice_no)
);

CREATE INDEX IF NOT EXISTS idx_account_invoices_account ON public.account_invoices(billing_account_id);
CREATE INDEX IF NOT EXISTS idx_account_invoices_school_term ON public.account_invoices(school_id, academic_term);

CREATE TABLE IF NOT EXISTS public.account_invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.account_invoices(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  fee_category_id uuid NOT NULL REFERENCES public.fee_categories(id),
  fee_template_id uuid REFERENCES public.fee_templates(id) ON DELETE SET NULL,
  description text,
  amount numeric(12,2) NOT NULL,
  amount_paid numeric(12,2) NOT NULL DEFAULT 0,
  due_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (invoice_id, student_id, fee_category_id, fee_template_id)
);

CREATE INDEX IF NOT EXISTS idx_account_invoice_items_invoice ON public.account_invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_account_invoice_items_student ON public.account_invoice_items(student_id);

-- ---------------------------------------------------------------------------
-- Payments + allocations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.account_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  billing_account_id uuid NOT NULL REFERENCES public.billing_accounts(id),
  invoice_id uuid REFERENCES public.account_invoices(id) ON DELETE SET NULL,
  payer_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  unallocated_amount numeric(12,2) NOT NULL DEFAULT 0,
  payment_provider text,
  provider_reference text,
  status public.account_payment_status NOT NULL DEFAULT 'pending',
  allocation_mode text NOT NULL DEFAULT 'auto' CHECK (allocation_mode IN ('auto', 'manual')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_account_payments_account ON public.account_payments(billing_account_id);
CREATE INDEX IF NOT EXISTS idx_account_payments_invoice ON public.account_payments(invoice_id);

CREATE TABLE IF NOT EXISTS public.payment_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES public.account_payments(id) ON DELETE CASCADE,
  invoice_item_id uuid NOT NULL REFERENCES public.account_invoice_items(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  allocated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_allocations_payment ON public.payment_allocations(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_item ON public.payment_allocations(invoice_item_id);

-- ---------------------------------------------------------------------------
-- Allocation rules + audit + jobs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.billing_allocation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  rule_order smallint NOT NULL,
  rule_type text NOT NULL CHECK (rule_type IN ('overdue_first', 'category_priority', 'proportional')),
  is_enabled boolean NOT NULL DEFAULT true,
  UNIQUE (school_id, rule_order)
);

CREATE TABLE IF NOT EXISTS public.financial_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  action text NOT NULL,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  old_balance numeric(12,2),
  new_balance numeric(12,2),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_financial_audit_school ON public.financial_audit_log(school_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.billing_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  job_type text NOT NULL DEFAULT 'generate_term_invoices',
  academic_term text NOT NULL,
  term_id uuid REFERENCES public.terms(id) ON DELETE SET NULL,
  status public.billing_job_status NOT NULL DEFAULT 'queued',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  progress jsonb NOT NULL DEFAULT '{"processed":0,"total":0,"invoices_created":0}'::jsonb,
  error_message text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_jobs_school_status ON public.billing_jobs(school_id, status);

-- Immutable audit log
DROP RULE IF EXISTS financial_audit_log_no_update ON public.financial_audit_log;
CREATE RULE financial_audit_log_no_update AS ON UPDATE TO public.financial_audit_log DO INSTEAD NOTHING;
DROP RULE IF EXISTS financial_audit_log_no_delete ON public.financial_audit_log;
CREATE RULE financial_audit_log_no_delete AS ON DELETE TO public.financial_audit_log DO INSTEAD NOTHING;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.write_financial_audit_log(
  p_school_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_action text,
  p_actor_user_id uuid,
  p_old_balance numeric,
  p_new_balance numeric,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.financial_audit_log (
    school_id, entity_type, entity_id, action, actor_user_id,
    old_balance, new_balance, metadata
  ) VALUES (
    p_school_id, p_entity_type, p_entity_id, p_action, p_actor_user_id,
    p_old_balance, p_new_balance, COALESCE(p_metadata, '{}'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_account_invoice_totals(p_invoice_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total numeric(12,2);
  v_paid numeric(12,2);
  v_due date;
  v_status public.account_invoice_status;
BEGIN
  SELECT COALESCE(SUM(amount), 0), COALESCE(SUM(amount_paid), 0)
  INTO v_total, v_paid
  FROM public.account_invoice_items WHERE invoice_id = p_invoice_id;

  SELECT due_date, status INTO v_due, v_status
  FROM public.account_invoices WHERE id = p_invoice_id;

  IF v_status = 'void' THEN RETURN; END IF;

  IF v_paid >= v_total AND v_total > 0 THEN
    v_status := 'paid';
  ELSIF v_paid > 0 THEN
    v_status := 'partially_paid';
  ELSIF v_due < CURRENT_DATE AND v_total > v_paid THEN
    v_status := 'overdue';
  ELSIF v_status IN ('paid', 'partially_paid', 'overdue') AND v_paid = 0 THEN
    v_status := 'issued';
  END IF;

  UPDATE public.account_invoices
  SET total_amount = v_total, total_paid = v_paid, status = v_status, updated_at = now()
  WHERE id = p_invoice_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_billing_account_balance(p_billing_account_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance numeric(12,2);
  v_school_id uuid;
BEGIN
  SELECT ba.school_id INTO v_school_id FROM public.billing_accounts ba WHERE ba.id = p_billing_account_id;

  SELECT COALESCE(SUM(ii.amount - ii.amount_paid), 0)
  INTO v_balance
  FROM public.account_invoice_items ii
  JOIN public.account_invoices i ON i.id = ii.invoice_id
  WHERE i.billing_account_id = p_billing_account_id
    AND i.status NOT IN ('void', 'draft');

  UPDATE public.billing_accounts
  SET balance_due = v_balance, updated_at = now()
  WHERE id = p_billing_account_id;
END;
$$;

CREATE OR REPLACE FUNCTION public._apply_allocation_to_item(
  p_payment_id uuid,
  p_invoice_item_id uuid,
  p_amount numeric,
  p_actor_user_id uuid,
  p_school_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_paid numeric(12,2);
  v_new_paid numeric(12,2);
  v_invoice_id uuid;
BEGIN
  IF p_amount <= 0 THEN RETURN; END IF;

  SELECT amount_paid, invoice_id INTO v_old_paid, v_invoice_id
  FROM public.account_invoice_items
  WHERE id = p_invoice_item_id
  FOR UPDATE;

  v_new_paid := v_old_paid + p_amount;

  IF v_new_paid > (SELECT amount FROM public.account_invoice_items WHERE id = p_invoice_item_id) + 0.01 THEN
    RAISE EXCEPTION 'Allocation exceeds line item amount';
  END IF;

  INSERT INTO public.payment_allocations (payment_id, invoice_item_id, amount, allocated_by)
  VALUES (p_payment_id, p_invoice_item_id, p_amount, p_actor_user_id);

  UPDATE public.account_invoice_items
  SET amount_paid = v_new_paid
  WHERE id = p_invoice_item_id;

  PERFORM public.write_financial_audit_log(
    p_school_id, 'account_invoice_item', p_invoice_item_id,
    'payment_allocated', p_actor_user_id, v_old_paid, v_new_paid,
    jsonb_build_object('payment_id', p_payment_id, 'amount', p_amount)
  );

  PERFORM public.refresh_account_invoice_totals(v_invoice_id);
END;
$$;

-- Payment allocation: overdue -> category priority -> proportional
CREATE OR REPLACE FUNCTION public.allocate_account_payment(
  p_payment_id uuid,
  p_manual_allocations jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment record;
  v_remaining numeric(12,2);
  v_item record;
  v_apply numeric(12,2);
  v_results jsonb := '[]'::jsonb;
  v_total_outstanding numeric(12,2);
  v_alloc record;
  v_manual_sum numeric(12,2);
BEGIN
  SELECT * INTO v_payment FROM public.account_payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment not found'; END IF;
  IF v_payment.status <> 'completed' THEN
    RAISE EXCEPTION 'Payment must be completed before allocation';
  END IF;

  v_remaining := v_payment.amount;

  -- Manual allocation path
  IF p_manual_allocations IS NOT NULL AND jsonb_array_length(p_manual_allocations) > 0 THEN
    SELECT COALESCE(SUM((elem->>'amount')::numeric), 0) INTO v_manual_sum
    FROM jsonb_array_elements(p_manual_allocations) AS elem;

    IF abs(v_manual_sum - v_payment.amount) > 0.02 THEN
      RAISE EXCEPTION 'Manual allocations must sum to payment amount (got %, expected %)', v_manual_sum, v_payment.amount;
    END IF;

    FOR v_alloc IN
      SELECT (elem->>'invoice_item_id')::uuid AS item_id, (elem->>'amount')::numeric AS amt
      FROM jsonb_array_elements(p_manual_allocations) AS elem
    LOOP
      PERFORM public._apply_allocation_to_item(
        p_payment_id, v_alloc.item_id, v_alloc.amt, auth.uid(), v_payment.school_id
      );
      v_results := v_results || jsonb_build_array(
        jsonb_build_object('invoice_item_id', v_alloc.item_id, 'amount', v_alloc.amt, 'mode', 'manual')
      );
    END LOOP;

    UPDATE public.account_payments SET unallocated_amount = 0, allocation_mode = 'manual' WHERE id = p_payment_id;
    PERFORM public.refresh_billing_account_balance(v_payment.billing_account_id);
    RETURN jsonb_build_object('allocations', v_results, 'unallocated', 0);
  END IF;

  -- PASS 1: Overdue (oldest due_date first)
  FOR v_item IN
    SELECT ii.id, ii.amount, ii.amount_paid, ii.due_date
    FROM public.account_invoice_items ii
    JOIN public.account_invoices i ON i.id = ii.invoice_id
    WHERE i.billing_account_id = v_payment.billing_account_id
      AND i.status NOT IN ('void', 'draft')
      AND ii.amount > ii.amount_paid
      AND ii.due_date < CURRENT_DATE
    ORDER BY ii.due_date ASC, ii.created_at ASC
    FOR UPDATE OF ii
  LOOP
    EXIT WHEN v_remaining <= 0;
    v_apply := LEAST(v_remaining, v_item.amount - v_item.amount_paid);
    PERFORM public._apply_allocation_to_item(
      p_payment_id, v_item.id, v_apply, NULL, v_payment.school_id
    );
    v_remaining := v_remaining - v_apply;
    v_results := v_results || jsonb_build_array(
      jsonb_build_object('invoice_item_id', v_item.id, 'amount', v_apply, 'pass', 'overdue')
    );
  END LOOP;

  -- PASS 2: Category priority (non-overdue)
  FOR v_item IN
    SELECT ii.id, ii.amount, ii.amount_paid
    FROM public.account_invoice_items ii
    JOIN public.account_invoices i ON i.id = ii.invoice_id
    JOIN public.fee_categories fc ON fc.id = ii.fee_category_id
    WHERE i.billing_account_id = v_payment.billing_account_id
      AND i.status NOT IN ('void', 'draft')
      AND ii.amount > ii.amount_paid
      AND ii.due_date >= CURRENT_DATE
    ORDER BY fc.default_priority ASC, ii.due_date ASC, ii.created_at ASC
    FOR UPDATE OF ii
  LOOP
    EXIT WHEN v_remaining <= 0;
    v_apply := LEAST(v_remaining, v_item.amount - v_item.amount_paid);
    PERFORM public._apply_allocation_to_item(
      p_payment_id, v_item.id, v_apply, NULL, v_payment.school_id
    );
    v_remaining := v_remaining - v_apply;
    v_results := v_results || jsonb_build_array(
      jsonb_build_object('invoice_item_id', v_item.id, 'amount', v_apply, 'pass', 'priority')
    );
  END LOOP;

  -- PASS 3: Proportional split on remaining open items
  IF v_remaining > 0 THEN
    SELECT COALESCE(SUM(ii.amount - ii.amount_paid), 0) INTO v_total_outstanding
    FROM public.account_invoice_items ii
    JOIN public.account_invoices i ON i.id = ii.invoice_id
    WHERE i.billing_account_id = v_payment.billing_account_id
      AND i.status NOT IN ('void', 'draft')
      AND ii.amount > ii.amount_paid;

    IF v_total_outstanding > 0 THEN
      FOR v_item IN
        SELECT ii.id, ii.amount, ii.amount_paid,
          (ii.amount - ii.amount_paid) / v_total_outstanding AS share
        FROM public.account_invoice_items ii
        JOIN public.account_invoices i ON i.id = ii.invoice_id
        WHERE i.billing_account_id = v_payment.billing_account_id
          AND i.status NOT IN ('void', 'draft')
          AND ii.amount > ii.amount_paid
        ORDER BY ii.created_at ASC
        FOR UPDATE OF ii
      LOOP
        EXIT WHEN v_remaining <= 0.01;
        v_apply := LEAST(
          v_remaining,
          ROUND(v_payment.amount * v_item.share, 2),
          v_item.amount - v_item.amount_paid
        );
        IF v_apply > 0 THEN
          PERFORM public._apply_allocation_to_item(
            p_payment_id, v_item.id, v_apply, NULL, v_payment.school_id
          );
          v_remaining := v_remaining - v_apply;
          v_results := v_results || jsonb_build_array(
            jsonb_build_object('invoice_item_id', v_item.id, 'amount', v_apply, 'pass', 'proportional')
          );
        END IF;
      END LOOP;
    END IF;
  END IF;

  UPDATE public.account_payments SET unallocated_amount = GREATEST(v_remaining, 0) WHERE id = p_payment_id;
  PERFORM public.refresh_billing_account_balance(v_payment.billing_account_id);

  RETURN jsonb_build_object('allocations', v_results, 'unallocated', GREATEST(v_remaining, 0));
END;
$$;

-- Record payment and auto-allocate
CREATE OR REPLACE FUNCTION public.record_account_payment(
  p_school_id uuid,
  p_billing_account_id uuid,
  p_invoice_id uuid,
  p_amount numeric,
  p_allocation_mode text DEFAULT 'auto',
  p_manual_allocations jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment_id uuid;
  v_result jsonb;
BEGIN
  IF p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;

  IF NOT (
    public.is_school_admin(auth.uid(), p_school_id)
    OR public.has_role(auth.uid(), 'accountant'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  INSERT INTO public.account_payments (
    school_id, billing_account_id, invoice_id, payer_user_id,
    amount, unallocated_amount, status, allocation_mode
  ) VALUES (
    p_school_id, p_billing_account_id, p_invoice_id, auth.uid(),
    p_amount, p_amount, 'completed', COALESCE(p_allocation_mode, 'auto')
  )
  RETURNING id INTO v_payment_id;

  v_result := public.allocate_account_payment(v_payment_id, p_manual_allocations);

  RETURN jsonb_build_object('payment_id', v_payment_id, 'allocation', v_result);
END;
$$;

-- Backfill billing accounts from guardian_id
CREATE OR REPLACE FUNCTION public.backfill_billing_accounts_for_school(p_school_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_created int := 0;
  v_linked int := 0;
  v_parent record;
  v_account_id uuid;
  v_st record;
BEGIN
  FOR v_parent IN
    SELECT DISTINCT p.id AS parent_id, p.user_id
    FROM public.parents p
    JOIN public.students s ON s.guardian_id = p.id
    WHERE s.school_id = p_school_id AND p.id IS NOT NULL
  LOOP
    SELECT id INTO v_account_id
    FROM public.billing_accounts
    WHERE school_id = p_school_id AND primary_parent_id = v_parent.parent_id
    LIMIT 1;

    IF v_account_id IS NULL THEN
      INSERT INTO public.billing_accounts (
        school_id, account_no, primary_parent_id, display_name, currency
      ) VALUES (
        p_school_id,
        'BA-' || to_char(now(), 'YYYY') || '-' || lpad((floor(random() * 99999))::int::text, 5, '0'),
        v_parent.parent_id,
        (SELECT full_name FROM public.profiles WHERE id = v_parent.user_id),
        'GHS'
      )
      RETURNING id INTO v_account_id;
      v_created := v_created + 1;
    END IF;

    FOR v_st IN
      SELECT s.id FROM public.students s
      WHERE s.school_id = p_school_id AND s.guardian_id = v_parent.parent_id
    LOOP
      INSERT INTO public.billing_account_students (billing_account_id, student_id)
      VALUES (v_account_id, v_st.id)
      ON CONFLICT (billing_account_id, student_id) DO NOTHING;
      v_linked := v_linked + 1;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object('accounts_created', v_created, 'links_ensured', v_linked);
END;
$$;

-- Seed default fee categories with priorities
CREATE OR REPLACE FUNCTION public.seed_billing_fee_categories(p_school_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.fee_categories (school_id, code, name, default_priority, description)
  SELECT p_school_id, v.code, v.name, v.prio, v.desc
  FROM (VALUES
    ('TUITION', 'Tuition', 1, 'School tuition fees'),
    ('BOOKS', 'Books', 2, 'Books and learning materials'),
    ('PTA', 'PTA', 3, 'Parent-Teacher Association levy'),
    ('TRANSPORT', 'Bus / Transport', 4, 'Transportation fees')
  ) AS v(code, name, prio, desc)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.fee_categories fc
    WHERE fc.school_id = p_school_id AND fc.name = v.name
  );
END;
$$;

-- Resolve billing account for student (create if missing)
CREATE OR REPLACE FUNCTION public.ensure_student_billing_account(
  p_student_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student record;
  v_account_id uuid;
BEGIN
  SELECT s.id, s.school_id, s.guardian_id INTO v_student
  FROM public.students s WHERE s.id = p_student_id;

  IF v_student.id IS NULL THEN RAISE EXCEPTION 'Student not found'; END IF;
  IF v_student.guardian_id IS NULL THEN
    RAISE EXCEPTION 'Student has no guardian; link parent first';
  END IF;

  SELECT bas.billing_account_id INTO v_account_id
  FROM public.billing_account_students bas
  WHERE bas.student_id = p_student_id
  LIMIT 1;

  IF v_account_id IS NOT NULL THEN RETURN v_account_id; END IF;

  SELECT id INTO v_account_id FROM public.billing_accounts
  WHERE school_id = v_student.school_id AND primary_parent_id = v_student.guardian_id
  LIMIT 1;

  IF v_account_id IS NULL THEN
    INSERT INTO public.billing_accounts (
      school_id, account_no, primary_parent_id, currency
    ) VALUES (
      v_student.school_id,
      'BA-' || to_char(now(), 'YYYY') || '-' || lpad((floor(random() * 99999))::int::text, 5, '0'),
      v_student.guardian_id,
      'GHS'
    )
    RETURNING id INTO v_account_id;
  END IF;

  INSERT INTO public.billing_account_students (billing_account_id, student_id)
  VALUES (v_account_id, p_student_id)
  ON CONFLICT (billing_account_id, student_id) DO NOTHING;

  RETURN v_account_id;
END;
$$;

-- Process one chunk of billing job (200 students)
CREATE OR REPLACE FUNCTION public.process_billing_job_chunk(
  p_job_id uuid,
  p_chunk_size int DEFAULT 200
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job record;
  v_processed int := 0;
  v_invoices_created int := 0;
  v_student record;
  v_template record;
  v_account_id uuid;
  v_invoice_id uuid;
  v_due_date date;
  v_line_amount numeric(12,2);
  v_items_by_account jsonb := '{}'::jsonb;
  v_offset int;
  v_total int;
BEGIN
  SELECT * INTO v_job FROM public.billing_jobs WHERE id = p_job_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Job not found'; END IF;
  IF v_job.status = 'completed' THEN
    RETURN v_job.progress;
  END IF;

  IF v_job.status = 'queued' THEN
    UPDATE public.billing_jobs SET status = 'running', started_at = now() WHERE id = p_job_id;
  END IF;

  v_offset := COALESCE((v_job.progress->>'processed')::int, 0);
  v_total := COALESCE((v_job.progress->>'total')::int, 0);

  IF v_total = 0 THEN
    SELECT count(*)::int INTO v_total
    FROM public.students s
    WHERE s.school_id = v_job.school_id
      AND s.guardian_id IS NOT NULL;
    UPDATE public.billing_jobs
    SET progress = jsonb_set(progress, '{total}', to_jsonb(v_total))
    WHERE id = p_job_id;
  END IF;

  v_due_date := COALESCE(
    (SELECT end_date FROM public.terms WHERE id = v_job.term_id),
    (CURRENT_DATE + interval '30 days')::date
  );

  FOR v_student IN
    SELECT s.id, s.class_id, s.guardian_id, s.school_id
    FROM public.students s
    WHERE s.school_id = v_job.school_id
      AND s.guardian_id IS NOT NULL
    ORDER BY s.id
    OFFSET v_offset
    LIMIT p_chunk_size
  LOOP
    v_account_id := public.ensure_student_billing_account(v_student.id);

    -- Find or create draft/issued invoice for this account + term
    SELECT id INTO v_invoice_id
    FROM public.account_invoices
    WHERE billing_account_id = v_account_id
      AND academic_term = v_job.academic_term
      AND status NOT IN ('void', 'paid')
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_invoice_id IS NULL THEN
      INSERT INTO public.account_invoices (
        school_id, billing_account_id, invoice_no, academic_term, term_id,
        due_date, status, issued_at
      ) VALUES (
        v_job.school_id,
        v_account_id,
        'FAM-' || to_char(now(), 'YYYY') || '-' || upper(substr(md5(random()::text), 1, 8)),
        v_job.academic_term,
        v_job.term_id,
        v_due_date,
        'issued',
        now()
      )
      RETURNING id INTO v_invoice_id;
      v_invoices_created := v_invoices_created + 1;
    END IF;

    FOR v_template IN
      SELECT ft.*
      FROM public.fee_templates ft
      WHERE ft.school_id = v_job.school_id
        AND ft.academic_term = v_job.academic_term
        AND ft.is_active = true
        AND (
          ft.scope = 'global'
          OR (ft.scope = 'grade' AND ft.class_id = v_student.class_id)
          OR (ft.scope = 'student' AND ft.student_id = v_student.id)
        )
    LOOP
      INSERT INTO public.account_invoice_items (
        invoice_id, student_id, fee_category_id, fee_template_id,
        description, amount, due_date
      ) VALUES (
        v_invoice_id,
        v_student.id,
        v_template.fee_category_id,
        v_template.id,
        v_template.name,
        v_template.amount,
        v_due_date
      )
      ON CONFLICT (invoice_id, student_id, fee_category_id, fee_template_id) DO NOTHING;
    END LOOP;

    PERFORM public.refresh_account_invoice_totals(v_invoice_id);
    PERFORM public.refresh_billing_account_balance(v_account_id);
    v_processed := v_processed + 1;
  END LOOP;

  UPDATE public.billing_jobs
  SET
    progress = jsonb_build_object(
      'processed', v_offset + v_processed,
      'total', v_total,
      'invoices_created', COALESCE((progress->>'invoices_created')::int, 0) + v_invoices_created
    ),
    status = CASE
      WHEN v_offset + v_processed >= v_total THEN 'completed'::public.billing_job_status
      ELSE 'running'::public.billing_job_status
    END,
    completed_at = CASE WHEN v_offset + v_processed >= v_total THEN now() ELSE NULL END
  WHERE id = p_job_id;

  RETURN (SELECT progress FROM public.billing_jobs WHERE id = p_job_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.create_billing_job(
  p_school_id uuid,
  p_academic_term text,
  p_term_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job_id uuid;
BEGIN
  IF NOT (
    public.is_school_admin(auth.uid(), p_school_id)
    OR public.has_role(auth.uid(), 'accountant'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  INSERT INTO public.billing_jobs (school_id, job_type, academic_term, term_id, created_by, status)
  VALUES (p_school_id, 'generate_term_invoices', p_academic_term, p_term_id, auth.uid(), 'queued')
  RETURNING id INTO v_job_id;

  RETURN v_job_id;
END;
$$;

-- Default allocation rules per school
CREATE OR REPLACE FUNCTION public.seed_billing_allocation_rules(p_school_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.billing_allocation_rules (school_id, rule_order, rule_type) VALUES
    (p_school_id, 1, 'overdue_first'),
    (p_school_id, 2, 'category_priority'),
    (p_school_id, 3, 'proportional')
  ON CONFLICT (school_id, rule_order) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.write_financial_audit_log TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_account_invoice_totals TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_billing_account_balance TO authenticated;
GRANT EXECUTE ON FUNCTION public.allocate_account_payment TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_account_payment TO authenticated;
GRANT EXECUTE ON FUNCTION public.backfill_billing_accounts_for_school TO authenticated;
GRANT EXECUTE ON FUNCTION public.seed_billing_fee_categories TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_student_billing_account TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_billing_job_chunk TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_billing_job TO authenticated;
GRANT EXECUTE ON FUNCTION public.seed_billing_allocation_rules TO authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.billing_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_account_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_allocation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_jobs ENABLE ROW LEVEL SECURITY;

-- Staff read/write by school
DROP POLICY IF EXISTS "staff manage billing accounts" ON public.billing_accounts;
CREATE POLICY "staff manage billing accounts" ON public.billing_accounts FOR ALL TO authenticated
  USING (
    school_id = public.get_user_school_id(auth.uid())
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  )
  WITH CHECK (
    school_id = public.get_user_school_id(auth.uid())
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

DROP POLICY IF EXISTS "staff manage billing account students" ON public.billing_account_students;
CREATE POLICY "staff manage billing account students" ON public.billing_account_students FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.billing_accounts ba
    WHERE ba.id = billing_account_id
      AND (ba.school_id = public.get_user_school_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'::app_role))
  ));

DROP POLICY IF EXISTS "staff manage fee templates" ON public.fee_templates;
CREATE POLICY "staff manage fee templates" ON public.fee_templates FOR ALL TO authenticated
  USING (school_id = public.get_user_school_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (school_id = public.get_user_school_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "staff manage account invoices" ON public.account_invoices;
CREATE POLICY "staff manage account invoices" ON public.account_invoices FOR ALL TO authenticated
  USING (school_id = public.get_user_school_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (school_id = public.get_user_school_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "staff manage account invoice items" ON public.account_invoice_items;
CREATE POLICY "staff manage account invoice items" ON public.account_invoice_items FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.account_invoices i
    WHERE i.id = invoice_id
      AND (i.school_id = public.get_user_school_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'::app_role))
  ));

DROP POLICY IF EXISTS "staff manage account payments" ON public.account_payments;
CREATE POLICY "staff manage account payments" ON public.account_payments FOR ALL TO authenticated
  USING (school_id = public.get_user_school_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (school_id = public.get_user_school_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "staff read payment allocations" ON public.payment_allocations;
CREATE POLICY "staff read payment allocations" ON public.payment_allocations FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.account_payments p
    WHERE p.id = payment_id
      AND (p.school_id = public.get_user_school_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'::app_role))
  ));

DROP POLICY IF EXISTS "staff manage billing jobs" ON public.billing_jobs;
CREATE POLICY "staff manage billing jobs" ON public.billing_jobs FOR ALL TO authenticated
  USING (school_id = public.get_user_school_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (school_id = public.get_user_school_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "staff read financial audit" ON public.financial_audit_log;
CREATE POLICY "staff read financial audit" ON public.financial_audit_log FOR SELECT TO authenticated
  USING (school_id = public.get_user_school_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'::app_role));

-- Parents: view own billing account and related invoices/items
DROP POLICY IF EXISTS "parents read own billing account" ON public.billing_accounts;
CREATE POLICY "parents read own billing account" ON public.billing_accounts FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.parents p
    WHERE p.id = primary_parent_id AND p.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "parents read own account invoices" ON public.account_invoices;
CREATE POLICY "parents read own account invoices" ON public.account_invoices FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.billing_accounts ba
    JOIN public.parents p ON p.id = ba.primary_parent_id
    WHERE ba.id = billing_account_id AND p.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "parents read own invoice items" ON public.account_invoice_items;
CREATE POLICY "parents read own invoice items" ON public.account_invoice_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.account_invoices i
    JOIN public.billing_accounts ba ON ba.id = i.billing_account_id
    JOIN public.parents p ON p.id = ba.primary_parent_id
    WHERE i.id = invoice_id AND p.user_id = auth.uid()
  ));
