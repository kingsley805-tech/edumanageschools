ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- 1. Helper: is the given user the class teacher of the given class?
CREATE OR REPLACE FUNCTION public.is_class_teacher_of(_user_id uuid, _class_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.classes c
    JOIN public.teachers t ON t.id = c.class_teacher_id
    WHERE c.id = _class_id AND t.user_id = _user_id
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_class_teacher_of(uuid, uuid) TO authenticated;

-- 2. Admin assigns / removes class teacher with audit log
CREATE OR REPLACE FUNCTION public.assign_class_teacher(p_class_id uuid, p_teacher_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_school uuid;
  v_prev uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT (public.has_role(v_uid, 'admin'::app_role) OR public.has_role(v_uid, 'super_admin'::app_role)) THEN
    RAISE EXCEPTION 'Only administrators can assign class teachers';
  END IF;

  SELECT school_id, class_teacher_id INTO v_school, v_prev FROM public.classes WHERE id = p_class_id;
  IF v_school IS NULL THEN RAISE EXCEPTION 'Class not found'; END IF;

  IF p_teacher_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.teachers WHERE id = p_teacher_id AND school_id = v_school
  ) THEN
    RAISE EXCEPTION 'Teacher does not belong to this school';
  END IF;

  UPDATE public.classes SET class_teacher_id = p_teacher_id, updated_at = now() WHERE id = p_class_id;

  INSERT INTO public.audit_logs (school_id, action_type, entity_type, entity_id, performed_by, details, module, new_values, old_values)
  VALUES (
    v_school,
    CASE WHEN p_teacher_id IS NULL THEN 'unassign_class_teacher' ELSE 'assign_class_teacher' END,
    'class', p_class_id, v_uid,
    jsonb_build_object('previous_teacher_id', v_prev, 'new_teacher_id', p_teacher_id),
    'class_teacher',
    jsonb_build_object('class_teacher_id', p_teacher_id),
    jsonb_build_object('class_teacher_id', v_prev)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.assign_class_teacher(uuid, uuid) TO authenticated;

-- 3. Send academic recommendation (class teacher or admin)
CREATE OR REPLACE FUNCTION public.create_academic_recommendation(
  p_student_id uuid,
  p_recommendation_type text,
  p_suggestions text,
  p_strengths text DEFAULT NULL,
  p_weaknesses text DEFAULT NULL,
  p_threshold_alert boolean DEFAULT false,
  p_term_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_student record;
  v_teacher_id uuid;
  v_rec_id uuid;
  v_title text;
  v_body text;
  v_school_name text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT s.id, s.school_id, s.class_id, s.user_id, s.guardian_id, coalesce(s.full_name, p.full_name) AS full_name
  INTO v_student
  FROM public.students s
  LEFT JOIN public.profiles p ON p.id = s.user_id
  WHERE s.id = p_student_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Student not found'; END IF;

  SELECT id INTO v_teacher_id FROM public.teachers WHERE user_id = v_uid LIMIT 1;

  IF NOT (
    public.has_role(v_uid, 'admin'::app_role)
    OR public.has_role(v_uid, 'super_admin'::app_role)
    OR public.is_class_teacher_of(v_uid, v_student.class_id)
  ) THEN
    RAISE EXCEPTION 'Only the assigned class teacher or an administrator can send recommendations';
  END IF;

  INSERT INTO public.academic_recommendations (
    school_id, student_id, term_id, teacher_id, recommendation_type,
    suggestions, strengths, weaknesses, threshold_alert, created_by
  ) VALUES (
    v_student.school_id, p_student_id, p_term_id, v_teacher_id,
    coalesce(p_recommendation_type, 'general'),
    p_suggestions, p_strengths, p_weaknesses, coalesce(p_threshold_alert, false), v_uid
  ) RETURNING id INTO v_rec_id;

  SELECT school_name INTO v_school_name FROM public.schools WHERE id = v_student.school_id;

  v_title := CASE WHEN coalesce(p_threshold_alert, false)
                  THEN 'Performance alert for ' || coalesce(v_student.full_name, 'your child')
                  ELSE 'New recommendation for ' || coalesce(v_student.full_name, 'your child') END;
  v_body := coalesce(p_suggestions, 'A new academic recommendation has been issued.');

  -- Notify all linked parents/guardians
  INSERT INTO public.notifications (user_id, title, body, data, read)
  SELECT DISTINCT p.user_id, v_title, v_body,
         jsonb_build_object(
           'type', 'academic_recommendation',
           'recommendation_id', v_rec_id,
           'student_id', p_student_id,
           'school_id', v_student.school_id,
           'school_name', v_school_name,
           'threshold_alert', coalesce(p_threshold_alert, false)
         ),
         false
  FROM public.parents p
  WHERE p.user_id IS NOT NULL
    AND (
      p.id = v_student.guardian_id
      OR EXISTS (
        SELECT 1 FROM public.parent_student_links psl
        WHERE psl.parent_id = p.id AND psl.student_id = p_student_id
      )
    );

  -- Notify the student too
  IF v_student.user_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, body, data, read)
    VALUES (v_student.user_id, v_title, v_body,
            jsonb_build_object('type', 'academic_recommendation', 'recommendation_id', v_rec_id, 'student_id', p_student_id),
            false);
  END IF;

  INSERT INTO public.audit_logs (school_id, action_type, entity_type, entity_id, performed_by, details, module)
  VALUES (v_student.school_id, 'academic_recommendation_sent', 'student', p_student_id, v_uid,
          jsonb_build_object('recommendation_id', v_rec_id, 'threshold_alert', coalesce(p_threshold_alert, false), 'type', p_recommendation_type),
          'class_teacher');

  RETURN v_rec_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_academic_recommendation(uuid, text, text, text, text, boolean, uuid) TO authenticated;

-- 4. Class teacher overview RPC
CREATE OR REPLACE FUNCTION public.class_teacher_student_overview(p_class_id uuid)
RETURNS TABLE (
  student_id uuid,
  full_name text,
  admission_no text,
  attendance_percent numeric,
  present_days int,
  total_days int,
  average_score numeric,
  failing_subjects int,
  alert_low_attendance boolean,
  alert_low_performance boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  IF NOT (
    public.has_role(v_uid, 'admin'::app_role)
    OR public.has_role(v_uid, 'super_admin'::app_role)
    OR public.is_class_teacher_of(v_uid, p_class_id)
  ) THEN
    RAISE EXCEPTION 'Not authorized for this class';
  END IF;

  RETURN QUERY
  WITH roster AS (
    SELECT s.id, coalesce(s.full_name, p.full_name, 'Student') AS full_name,
           coalesce(s.admission_no, s.admission_number) AS admission_no
    FROM public.students s
    LEFT JOIN public.profiles p ON p.id = s.user_id
    WHERE s.class_id = p_class_id
  ),
  att AS (
    SELECT ar.student_id,
           count(*)::int AS total_days,
           count(*) FILTER (WHERE lower(ar.attendance_status) = 'present')::int AS present_days
    FROM public.attendance_records ar
    WHERE ar.class_id = p_class_id
    GROUP BY ar.student_id
  ),
  gr AS (
    SELECT g.student_id,
           avg(g.score)::numeric AS avg_score,
           count(*) FILTER (WHERE g.score < 50)::int AS failing
    FROM public.grades g
    JOIN public.students s ON s.id = g.student_id
    WHERE s.class_id = p_class_id
    GROUP BY g.student_id
  )
  SELECT
    r.id,
    r.full_name,
    r.admission_no,
    CASE WHEN coalesce(att.total_days, 0) > 0
         THEN round((att.present_days::numeric / att.total_days::numeric) * 100, 1)
         ELSE 0 END AS attendance_percent,
    coalesce(att.present_days, 0),
    coalesce(att.total_days, 0),
    round(coalesce(gr.avg_score, 0), 1),
    coalesce(gr.failing, 0),
    CASE WHEN coalesce(att.total_days, 0) > 0
         AND (att.present_days::numeric / att.total_days::numeric) < 0.75 THEN true ELSE false END,
    CASE WHEN coalesce(gr.avg_score, 100) < 50 OR coalesce(gr.failing, 0) >= 2 THEN true ELSE false END
  FROM roster r
  LEFT JOIN att ON att.student_id = r.id
  LEFT JOIN gr ON gr.student_id = r.id
  ORDER BY r.full_name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.class_teacher_student_overview(uuid) TO authenticated;

-- 5. Read access for class teachers
-- a) students: class teacher can view students in their assigned classes
DROP POLICY IF EXISTS "Class teacher can view their class students" ON public.students;
CREATE POLICY "Class teacher can view their class students"
ON public.students FOR SELECT
TO authenticated
USING (public.is_class_teacher_of(auth.uid(), class_id));

-- b) grades
DROP POLICY IF EXISTS "Class teacher can view their class grades" ON public.grades;
CREATE POLICY "Class teacher can view their class grades"
ON public.grades FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.students s
  WHERE s.id = grades.student_id
    AND public.is_class_teacher_of(auth.uid(), s.class_id)
));

-- c) attendance_records
DROP POLICY IF EXISTS "Class teacher can view their class attendance records" ON public.attendance_records;
CREATE POLICY "Class teacher can view their class attendance records"
ON public.attendance_records FOR SELECT
TO authenticated
USING (public.is_class_teacher_of(auth.uid(), class_id));

-- d) term_report_cards
DROP POLICY IF EXISTS "Class teacher can view their class report cards" ON public.term_report_cards;
CREATE POLICY "Class teacher can view their class report cards"
ON public.term_report_cards FOR SELECT
TO authenticated
USING (public.is_class_teacher_of(auth.uid(), class_id));

DROP POLICY IF EXISTS "Class teacher can submit their class report cards" ON public.term_report_cards;
CREATE POLICY "Class teacher can submit their class report cards"
ON public.term_report_cards FOR UPDATE
TO authenticated
USING (public.is_class_teacher_of(auth.uid(), class_id))
WITH CHECK (public.is_class_teacher_of(auth.uid(), class_id));

-- e) academic_recommendations: parents can read their kids' recommendations
DROP POLICY IF EXISTS "Parents can view recommendations for their children" ON public.academic_recommendations;
CREATE POLICY "Parents can view recommendations for their children"
ON public.academic_recommendations FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.students s
  LEFT JOIN public.parents p ON p.id = s.guardian_id
  LEFT JOIN public.parent_student_links psl ON psl.student_id = s.id
  LEFT JOIN public.parents p2 ON p2.id = psl.parent_id
  WHERE s.id = academic_recommendations.student_id
    AND (p.user_id = auth.uid() OR p2.user_id = auth.uid() OR s.user_id = auth.uid())
));
