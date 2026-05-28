-- =============================================================================
-- Academic calendar (academic_years + term billing columns)
-- Run in Supabase Dashboard → SQL Editor, then Settings → API → Reload schema
-- Or: supabase link && supabase db push
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.academic_years (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  start_date date,
  end_date date,
  is_current boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, name)
);

ALTER TABLE public.academic_years ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "school read academic years" ON public.academic_years;
CREATE POLICY "school read academic years" ON public.academic_years
  FOR SELECT USING (
    school_id = public.get_user_school_id(auth.uid())
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

DROP POLICY IF EXISTS "finance manage academic years" ON public.academic_years;
CREATE POLICY "finance manage academic years" ON public.academic_years
  FOR ALL USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'accountant'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  )
  WITH CHECK (
    school_id = public.get_user_school_id(auth.uid())
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

ALTER TABLE public.terms
  ADD COLUMN IF NOT EXISTS academic_year_id uuid REFERENCES public.academic_years(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fees_due_date date;

-- Set current term (finances + report cards) — safe to re-run
CREATE OR REPLACE FUNCTION public.set_school_current_term(p_term_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_school uuid;
BEGIN
  SELECT school_id INTO v_school FROM public.terms WHERE id = p_term_id;
  IF v_school IS NULL THEN
    RAISE EXCEPTION 'Term not found';
  END IF;
  IF NOT (
    public.is_school_admin(auth.uid(), v_school)
    OR public.has_role(auth.uid(), 'accountant'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  ) THEN
    RAISE EXCEPTION 'Not authorized to set the active term';
  END IF;
  UPDATE public.terms SET is_current = false WHERE school_id = v_school;
  UPDATE public.terms SET is_current = true WHERE id = p_term_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_school_current_term(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
