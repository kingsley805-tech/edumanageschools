-- Prepare a shadow class register from teacher attendance page (registerId SMS path)

CREATE OR REPLACE FUNCTION public.prepare_teacher_attendance_sms_register(
  p_class_id uuid,
  p_date date
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_school_id uuid;
  v_teacher_id uuid;
  v_subject_id uuid;
  v_register_id uuid;
  v_period text := 'Teacher Attendance';
  v_rec record;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT (
    public.teacher_can_view_student(v_uid, p_class_id)
    OR (
      public.has_role(v_uid, 'admin'::app_role)
      AND EXISTS (
        SELECT 1 FROM public.classes c
        WHERE c.id = p_class_id
          AND c.school_id = public.get_user_school_id(v_uid)
      )
    )
  ) THEN
    RAISE EXCEPTION 'Not authorized to send attendance notifications for this class';
  END IF;

  SELECT c.school_id, c.class_teacher_id
  INTO v_school_id, v_teacher_id
  FROM public.classes c
  WHERE c.id = p_class_id;

  IF v_school_id IS NULL THEN
    RAISE EXCEPTION 'Class not found';
  END IF;

  SELECT t.id INTO v_teacher_id
  FROM public.teachers t
  WHERE t.user_id = v_uid AND t.school_id = v_school_id
  LIMIT 1;

  IF v_teacher_id IS NULL THEN
    SELECT c.class_teacher_id INTO v_teacher_id
    FROM public.classes c
    WHERE c.id = p_class_id AND c.class_teacher_id IS NOT NULL;
  END IF;

  IF v_teacher_id IS NULL THEN
    SELECT t.id INTO v_teacher_id
    FROM public.teachers t
    WHERE t.school_id = v_school_id
    ORDER BY t.created_at NULLS LAST
    LIMIT 1;
  END IF;

  IF v_teacher_id IS NULL THEN
    RAISE EXCEPTION 'No teacher profile found for this school';
  END IF;

  SELECT cs.subject_id INTO v_subject_id
  FROM public.class_subjects cs
  WHERE cs.class_id = p_class_id
  LIMIT 1;

  IF v_subject_id IS NULL THEN
    SELECT s.id INTO v_subject_id
    FROM public.subjects s
    WHERE s.school_id = v_school_id AND s.code = '_ATT_SMS'
    LIMIT 1;
  END IF;

  IF v_subject_id IS NULL THEN
    INSERT INTO public.subjects (school_id, name, code)
    VALUES (v_school_id, 'General Attendance', '_ATT_SMS')
    RETURNING id INTO v_subject_id;
  END IF;

  SELECT r.id INTO v_register_id
  FROM public.class_registers r
  WHERE r.school_id = v_school_id
    AND r.class_id = p_class_id
    AND r.subject_id = v_subject_id
    AND r.register_date = p_date
    AND r.period_label = v_period
    AND r.term_id IS NULL
  LIMIT 1;

  IF v_register_id IS NULL THEN
    INSERT INTO public.class_registers (
      school_id, class_id, subject_id, teacher_id, register_date, period_label, day_of_week, status, created_by
    )
    VALUES (
      v_school_id,
      p_class_id,
      v_subject_id,
      v_teacher_id,
      p_date,
      v_period,
      EXTRACT(DOW FROM p_date)::smallint,
      'draft',
      v_uid
    )
    RETURNING id INTO v_register_id;
  END IF;

  FOR v_rec IN
    SELECT a.student_id, a.status
    FROM public.attendance a
    WHERE a.class_id = p_class_id AND a.date = p_date
  LOOP
    INSERT INTO public.register_student_entries (
      register_id, student_id, attendance_status, updated_at
    )
    VALUES (v_register_id, v_rec.student_id, coalesce(nullif(trim(v_rec.status), ''), 'present'), now())
    ON CONFLICT (register_id, student_id) DO UPDATE SET
      attendance_status = EXCLUDED.attendance_status,
      updated_at = now();
  END LOOP;

  RETURN v_register_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.prepare_teacher_attendance_sms_register(uuid, date) TO authenticated;

NOTIFY pgrst, 'reload schema';
