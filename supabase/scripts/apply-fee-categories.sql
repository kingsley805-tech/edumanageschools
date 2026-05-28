-- Run in Supabase Dashboard → SQL Editor
-- Fixes: Could not find the table 'public.fee_categories' in the schema cache

-- (Contents match supabase/migrations/20260528130000_fee_categories_billing_tables.sql)

CREATE TABLE IF NOT EXISTS public.fee_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  is_optional boolean NOT NULL DEFAULT false,
  code text,
  default_priority smallint NOT NULL DEFAULT 5,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, name)
);

ALTER TABLE public.fee_categories
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_optional boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS code text,
  ADD COLUMN IF NOT EXISTS default_priority smallint NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.fee_categories
SET code = upper(regexp_replace(name, '[^a-zA-Z0-9]+', '_', 'g'))
WHERE code IS NULL;

ALTER TABLE public.fee_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "school read fee categories" ON public.fee_categories;
CREATE POLICY "school read fee categories" ON public.fee_categories
  FOR SELECT USING (
    school_id = public.get_user_school_id(auth.uid())
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

DROP POLICY IF EXISTS "finance manage fee categories" ON public.fee_categories;
CREATE POLICY "finance manage fee categories" ON public.fee_categories
  FOR ALL USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'accountant'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  )
  WITH CHECK (
    school_id = public.get_user_school_id(auth.uid())
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

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

ALTER TABLE public.fee_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "school read fee items" ON public.fee_items;
CREATE POLICY "school read fee items" ON public.fee_items
  FOR SELECT USING (
    school_id = public.get_user_school_id(auth.uid())
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

DROP POLICY IF EXISTS "finance manage fee items" ON public.fee_items;
CREATE POLICY "finance manage fee items" ON public.fee_items
  FOR ALL USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'accountant'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  )
  WITH CHECK (
    school_id = public.get_user_school_id(auth.uid())
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

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

ALTER TABLE public.fee_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "school read fee assignments" ON public.fee_assignments;
CREATE POLICY "school read fee assignments" ON public.fee_assignments
  FOR SELECT USING (
    school_id = public.get_user_school_id(auth.uid())
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

DROP POLICY IF EXISTS "finance manage fee assignments" ON public.fee_assignments;
CREATE POLICY "finance manage fee assignments" ON public.fee_assignments
  FOR ALL USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'accountant'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  )
  WITH CHECK (
    school_id = public.get_user_school_id(auth.uid())
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

CREATE OR REPLACE FUNCTION public.seed_billing_fee_categories(p_school_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.fee_categories (school_id, code, name, default_priority, description, sort_order, is_optional)
  VALUES
    (p_school_id, 'TUITION', 'Tuition', 1, 'Core tuition fees', 0, false),
    (p_school_id, 'PTA', 'PTA Levy', 2, 'Parent-teacher association', 1, false),
    (p_school_id, 'BOOKS', 'Books & Materials', 3, 'Learning materials', 2, false),
    (p_school_id, 'TRANSPORT', 'Transport', 4, 'School transport', 3, true),
    (p_school_id, 'OTHER', 'Other Fees', 5, 'Miscellaneous', 4, true)
  ON CONFLICT (school_id, name) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.seed_billing_fee_categories(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
