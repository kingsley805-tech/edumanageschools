-- Fix term_report_cards RLS for teachers (class_subjects.teacher_id → teachers.id)
-- and improve school_id resolution for staff without profiles.school_id.

CREATE OR REPLACE FUNCTION public.get_user_school_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT p.school_id FROM public.profiles p WHERE p.id = _user_id),
    (SELECT t.school_id FROM public.teachers t WHERE t.user_id = _user_id LIMIT 1),
    (SELECT s.school_id FROM public.students s WHERE s.user_id = _user_id LIMIT 1),
    (
      SELECT ura.school_id
      FROM public.user_role_assignments ura
      WHERE ura.user_id = _user_id AND ura.school_id IS NOT NULL
      LIMIT 1
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.teacher_can_access_student_report(
  p_teacher_id uuid,
  p_student_id uuid,
  p_class_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.students s
    WHERE s.id = p_student_id
      AND (p_class_id IS NULL OR s.class_id = p_class_id)
      AND public.teacher_can_view_student(p_teacher_id, s.class_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.teacher_teaches_class(p_teacher_id uuid, p_class_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.class_subjects cs
    WHERE cs.class_id = p_class_id
      AND (
        cs.teacher_id = p_teacher_id
        OR cs.teacher_id = public.report_teacher_record_id(p_teacher_id)
      )
  );
$$;

DROP POLICY IF EXISTS "teachers manage assigned class reports" ON public.term_report_cards;
CREATE POLICY "teachers manage assigned class reports"
  ON public.term_report_cards
  FOR ALL
  USING (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR public.is_school_admin(auth.uid(), school_id)
    OR (
      school_id = public.get_user_school_id(auth.uid())
      AND public.teacher_can_access_student_report(auth.uid(), student_id, class_id)
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR public.is_school_admin(auth.uid(), school_id)
    OR (
      school_id = public.get_user_school_id(auth.uid())
      AND public.teacher_can_access_student_report(auth.uid(), student_id, class_id)
      AND (teacher_id IS NULL OR teacher_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "staff read report versions" ON public.term_report_card_versions;
CREATE POLICY "staff read report versions"
  ON public.term_report_card_versions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.term_report_cards t
      WHERE t.id = report_id
        AND (
          t.school_id = public.get_user_school_id(auth.uid())
          OR public.is_school_admin(auth.uid(), t.school_id)
          OR public.has_role(auth.uid(), 'super_admin'::app_role)
        )
    )
  );

DROP POLICY IF EXISTS "staff insert report versions" ON public.term_report_card_versions;
CREATE POLICY "staff insert report versions"
  ON public.term_report_card_versions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.term_report_cards t
      WHERE t.id = report_id
        AND (
          public.is_school_admin(auth.uid(), t.school_id)
          OR public.has_role(auth.uid(), 'super_admin'::app_role)
          OR (
            t.school_id = public.get_user_school_id(auth.uid())
            AND public.teacher_can_access_student_report(auth.uid(), t.student_id, t.class_id)
          )
        )
    )
  );

-- Allow school members to read head/teacher signatures for report rendering
DROP POLICY IF EXISTS "school members read signatures" ON public.user_signatures;
CREATE POLICY "school members read signatures"
  ON public.user_signatures
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR school_id = public.get_user_school_id(auth.uid())
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );
