
-- 1. Add class_teacher_id to classes
ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS class_teacher_id uuid REFERENCES public.teachers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_classes_class_teacher_id ON public.classes(class_teacher_id);

-- 2. Academic recommendations table
CREATE TABLE IF NOT EXISTS public.academic_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  term_id uuid REFERENCES public.terms(id) ON DELETE SET NULL,
  teacher_id uuid REFERENCES public.teachers(id) ON DELETE SET NULL,
  recommendation_type text NOT NULL DEFAULT 'general',
  suggestions text NOT NULL DEFAULT '',
  strengths text,
  weaknesses text,
  threshold_alert boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.academic_recommendations TO authenticated;
GRANT ALL ON public.academic_recommendations TO service_role;

ALTER TABLE public.academic_recommendations ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_acad_recs_student ON public.academic_recommendations(student_id, term_id);
CREATE INDEX IF NOT EXISTS idx_acad_recs_school ON public.academic_recommendations(school_id, created_at DESC);

DROP POLICY IF EXISTS "acad recs read" ON public.academic_recommendations;
CREATE POLICY "acad recs read" ON public.academic_recommendations
  FOR SELECT TO authenticated
  USING (
    school_id = public.get_user_school_id(auth.uid())
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.students s
      JOIN public.parents p ON p.id = s.guardian_id
      WHERE s.id = student_id AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "acad recs insert" ON public.academic_recommendations;
CREATE POLICY "acad recs insert" ON public.academic_recommendations
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.teachers t
      WHERE t.user_id = auth.uid() AND t.school_id = school_id
    )
  );

DROP POLICY IF EXISTS "acad recs update" ON public.academic_recommendations;
CREATE POLICY "acad recs update" ON public.academic_recommendations
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.teachers t
      WHERE t.user_id = auth.uid() AND t.id = teacher_id
    )
  );

DROP POLICY IF EXISTS "acad recs delete" ON public.academic_recommendations;
CREATE POLICY "acad recs delete" ON public.academic_recommendations
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.teachers t
      WHERE t.user_id = auth.uid() AND t.id = teacher_id
    )
  );

CREATE OR REPLACE FUNCTION public.touch_academic_recommendations()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_acad_recs ON public.academic_recommendations;
CREATE TRIGGER trg_touch_acad_recs
  BEFORE UPDATE ON public.academic_recommendations
  FOR EACH ROW EXECUTE FUNCTION public.touch_academic_recommendations();

NOTIFY pgrst, 'reload schema';
