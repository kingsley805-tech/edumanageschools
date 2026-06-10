-- Do not return submitted/approved registers when a teacher opens "new register" for the same slot.
CREATE OR REPLACE FUNCTION public.create_or_get_class_register(
  p_school_id uuid,
  p_class_id uuid,
  p_subject_id uuid,
  p_teacher_id uuid,
  p_register_date date,
  p_term_id uuid DEFAULT NULL,
  p_academic_year_id uuid DEFAULT NULL,
  p_session_label text DEFAULT NULL,
  p_period_label text DEFAULT 'Period 1',
  p_created_by uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_register_id uuid;
  v_day_of_week smallint;
  v_is_admin boolean := false;
  v_existing_status public.class_register_status;
BEGIN
  v_day_of_week := EXTRACT(DOW FROM p_register_date)::smallint;

  v_is_admin := public.has_role(auth.uid(), 'admin'::app_role)
             OR public.has_role(auth.uid(), 'super_admin'::app_role);

  INSERT INTO public.class_registers (
    school_id, class_id, subject_id, teacher_id, term_id, academic_year_id,
    session_label, register_date, period_label, day_of_week, status, created_by
  )
  VALUES (
    p_school_id, p_class_id, p_subject_id, p_teacher_id, p_term_id, p_academic_year_id,
    p_session_label, p_register_date, p_period_label, v_day_of_week, 'draft', p_created_by
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_register_id;

  IF v_register_id IS NOT NULL THEN
    RETURN v_register_id;
  END IF;

  IF v_is_admin THEN
    SELECT id INTO v_register_id
    FROM public.class_registers
    WHERE school_id = p_school_id
      AND class_id = p_class_id
      AND subject_id = p_subject_id
      AND register_date = p_register_date
      AND period_label = p_period_label
      AND COALESCE(term_id, '00000000-0000-0000-0000-000000000000'::uuid) =
          COALESCE(p_term_id, '00000000-0000-0000-0000-000000000000'::uuid)
    LIMIT 1;
    RETURN v_register_id;
  END IF;

  SELECT id INTO v_register_id
  FROM public.class_registers
  WHERE school_id = p_school_id
    AND class_id = p_class_id
    AND subject_id = p_subject_id
    AND register_date = p_register_date
    AND period_label = p_period_label
    AND COALESCE(term_id, '00000000-0000-0000-0000-000000000000'::uuid) =
        COALESCE(p_term_id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND status IN ('draft'::public.class_register_status, 'rejected'::public.class_register_status)
  LIMIT 1;

  IF v_register_id IS NOT NULL THEN
    RETURN v_register_id;
  END IF;

  SELECT status INTO v_existing_status
  FROM public.class_registers
  WHERE school_id = p_school_id
    AND class_id = p_class_id
    AND subject_id = p_subject_id
    AND register_date = p_register_date
    AND period_label = p_period_label
    AND COALESCE(term_id, '00000000-0000-0000-0000-000000000000'::uuid) =
        COALESCE(p_term_id, '00000000-0000-0000-0000-000000000000'::uuid)
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'A register for this class, subject, date and period was already submitted (%). Open it from your register list.', v_existing_status;
  END IF;

  RAISE EXCEPTION 'Could not create class register';
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_or_get_class_register(uuid, uuid, uuid, uuid, date, uuid, uuid, text, text, uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
