-- Payroll module (school-scoped, ported from edubill-web-app)

CREATE TABLE IF NOT EXISTS public.staff_salaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  staff_user_id uuid NOT NULL,
  amount numeric(14, 2) NOT NULL,
  currency text NOT NULL DEFAULT 'GHS',
  month text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  method text NOT NULL DEFAULT 'bank_transfer',
  gateway text NOT NULL DEFAULT 'manual',
  gateway_ref text,
  paid_at timestamptz,
  notes text,
  recorded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  allowances numeric(14, 2) NOT NULL DEFAULT 0,
  deductions numeric(14, 2) NOT NULL DEFAULT 0,
  duplicate_override boolean NOT NULL DEFAULT false,
  payout_snapshot jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_salaries_school_month ON public.staff_salaries (school_id, month);
CREATE INDEX IF NOT EXISTS idx_staff_salaries_staff ON public.staff_salaries (staff_user_id, month);

CREATE TABLE IF NOT EXISTS public.teacher_payroll_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  staff_user_id uuid NOT NULL,
  base_monthly_salary numeric(14, 2) NOT NULL DEFAULT 0,
  default_allowances numeric(14, 2) NOT NULL DEFAULT 0,
  default_deductions numeric(14, 2) NOT NULL DEFAULT 0,
  subject_label text,
  class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_teacher_payroll_config_school_staff UNIQUE (school_id, staff_user_id)
);

CREATE TABLE IF NOT EXISTS public.staff_bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  staff_user_id uuid NOT NULL,
  account_number text,
  bank_code text,
  account_name text,
  bank_name text,
  mobile_money_number text,
  mobile_money_provider text,
  payment_notes text,
  preferred_payout_method text,
  recipient_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, staff_user_id)
);

ALTER TABLE public.staff_salaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_payroll_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.user_has_payroll_permission(
  _uid uuid,
  _school_id uuid,
  _require_manage boolean DEFAULT false
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(_uid, 'super_admin'::app_role)
    OR public.has_role(_uid, 'admin'::app_role)
    OR (
      NOT _require_manage
      AND public.has_role(_uid, 'accountant'::app_role)
      AND _school_id = public.get_user_school_id(_uid)
    )
    OR (
      _require_manage
      AND (
        public.has_role(_uid, 'admin'::app_role)
        OR public.has_role(_uid, 'super_admin'::app_role)
      )
      AND (_school_id IS NULL OR _school_id = public.get_user_school_id(_uid))
    );
$$;

GRANT EXECUTE ON FUNCTION public.user_has_payroll_permission(uuid, uuid, boolean) TO authenticated;

DROP FUNCTION IF EXISTS public.list_teachers_for_payroll(uuid);

CREATE OR REPLACE FUNCTION public.list_teachers_for_payroll(p_school_id uuid)
RETURNS TABLE (
  user_id uuid,
  email text,
  first_name text,
  last_name text,
  phone text,
  admission_number text,
  class_label text,
  subject_label text,
  base_monthly_salary numeric,
  default_allowances numeric,
  default_deductions numeric,
  payment_bank_name text,
  payment_bank_code text,
  payment_account_number text,
  payment_account_holder text,
  payment_mobile_money_number text,
  payment_mobile_money_provider text,
  payment_notes text,
  preferred_payout_method text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT
    t.user_id,
    COALESCE(p.email, '')::text AS email,
    COALESCE(split_part(trim(p.full_name), ' ', 1), '') AS first_name,
    COALESCE(
      nullif(trim(substring(trim(p.full_name) from position(' ' in trim(p.full_name)) + 1)), ''),
      ''
    ) AS last_name,
    p.phone,
    COALESCE(t.employee_no, '') AS admission_number,
    TRIM(CONCAT(COALESCE(c.name, ''), CASE WHEN COALESCE(c.stream, '') <> '' THEN ' ' || c.stream ELSE '' END)) AS class_label,
    COALESCE(tpc.subject_label, t.subject_specialty) AS subject_label,
    COALESCE(tpc.base_monthly_salary, 0::numeric) AS base_monthly_salary,
    COALESCE(tpc.default_allowances, 0::numeric) AS default_allowances,
    COALESCE(tpc.default_deductions, 0::numeric) AS default_deductions,
    sba.bank_name AS payment_bank_name,
    sba.bank_code AS payment_bank_code,
    sba.account_number AS payment_account_number,
    sba.account_name AS payment_account_holder,
    sba.mobile_money_number AS payment_mobile_money_number,
    sba.mobile_money_provider AS payment_mobile_money_provider,
    sba.payment_notes AS payment_notes,
    sba.preferred_payout_method AS preferred_payout_method
  FROM public.teachers t
  INNER JOIN public.profiles p ON p.id = t.user_id
  LEFT JOIN public.teacher_payroll_config tpc
    ON tpc.school_id = t.school_id AND tpc.staff_user_id = t.user_id
  LEFT JOIN public.classes c ON c.id = tpc.class_id
  LEFT JOIN public.staff_bank_accounts sba
    ON sba.school_id = t.school_id AND sba.staff_user_id = t.user_id
  WHERE t.school_id = p_school_id
    AND t.user_id IS NOT NULL
    AND p_school_id = public.get_user_school_id(auth.uid())
    AND public.user_has_payroll_permission(auth.uid(), p_school_id, false);
$$;

GRANT EXECUTE ON FUNCTION public.list_teachers_for_payroll(uuid) TO authenticated;

-- RLS staff_salaries
DROP POLICY IF EXISTS "staff view own salaries" ON public.staff_salaries;
CREATE POLICY "staff view own salaries" ON public.staff_salaries
  FOR SELECT TO authenticated USING (staff_user_id = auth.uid());

DROP POLICY IF EXISTS "payroll manage salaries" ON public.staff_salaries;
CREATE POLICY "payroll manage salaries" ON public.staff_salaries
  FOR ALL TO authenticated
  USING (public.user_has_payroll_permission(auth.uid(), school_id, false))
  WITH CHECK (public.user_has_payroll_permission(auth.uid(), school_id, true));

-- RLS teacher_payroll_config
DROP POLICY IF EXISTS "payroll read config" ON public.teacher_payroll_config;
CREATE POLICY "payroll read config" ON public.teacher_payroll_config
  FOR SELECT TO authenticated
  USING (public.user_has_payroll_permission(auth.uid(), school_id, false));

DROP POLICY IF EXISTS "payroll manage config" ON public.teacher_payroll_config;
CREATE POLICY "payroll manage config" ON public.teacher_payroll_config
  FOR ALL TO authenticated
  USING (public.user_has_payroll_permission(auth.uid(), school_id, true))
  WITH CHECK (public.user_has_payroll_permission(auth.uid(), school_id, true));

-- RLS staff_bank_accounts
DROP POLICY IF EXISTS "staff view own bank" ON public.staff_bank_accounts;
CREATE POLICY "staff view own bank" ON public.staff_bank_accounts
  FOR SELECT TO authenticated USING (staff_user_id = auth.uid());

DROP POLICY IF EXISTS "payroll manage bank accounts" ON public.staff_bank_accounts;
CREATE POLICY "payroll manage bank accounts" ON public.staff_bank_accounts
  FOR ALL TO authenticated
  USING (public.user_has_payroll_permission(auth.uid(), school_id, false))
  WITH CHECK (public.user_has_payroll_permission(auth.uid(), school_id, true));

-- Portal permission seeds for payroll
INSERT INTO public.permissions (module, resource, action, code, description)
VALUES
  ('finance', 'payroll', 'view', 'payroll.view', 'View payroll'),
  ('finance', 'payroll', 'manage', 'payroll.manage', 'Manage payroll runs')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.role_permissions (role, permission_id)
SELECT 'admin'::app_role, p.id FROM public.permissions p WHERE p.code IN ('payroll.view', 'payroll.manage')
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission_id)
SELECT 'accountant'::app_role, p.id FROM public.permissions p WHERE p.code = 'payroll.view'
ON CONFLICT DO NOTHING;

