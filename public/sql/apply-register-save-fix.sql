-- Run once in Supabase SQL Editor, then reload API schema cache.
-- Fixes register save/submit failures (header RLS, entries RPC, duplicate slot).

-- 1) upsert_register_entries (admin can edit submitted; safer JSON parsing)
CREATE OR REPLACE FUNCTION public.upsert_register_entries(p_register_id uuid, p_entries jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_reg public.class_registers%ROWTYPE;
  v_allowed boolean := false;
  v_is_admin boolean := false;
  v_rec record;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_reg FROM public.class_registers WHERE id = p_register_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Register not found'; END IF;
  IF v_reg.locked THEN RAISE EXCEPTION 'Register is locked'; END IF;

  v_is_admin := public.has_role(v_uid, 'admin'::app_role)
             OR public.has_role(v_uid, 'super_admin'::app_role);

  IF NOT v_is_admin
     AND v_reg.status NOT IN ('draft'::public.class_register_status, 'rejected'::public.class_register_status) THEN
    RAISE EXCEPTION 'Register cannot be edited in its current status (%)', v_reg.status;
  END IF;

  v_allowed := v_is_admin
            OR EXISTS (
                 SELECT 1 FROM public.teachers t
                 WHERE t.user_id = v_uid
                   AND (t.id = v_reg.teacher_id OR t.school_id = v_reg.school_id)
               )
            OR EXISTS (
                 SELECT 1 FROM public.profiles p
                 WHERE p.id = v_uid AND p.school_id = v_reg.school_id
               );

  IF NOT v_allowed THEN RAISE EXCEPTION 'Not authorized to edit this register'; END IF;

  FOR v_rec IN
    SELECT *
    FROM jsonb_to_recordset(coalesce(p_entries, '[]'::jsonb)) AS x(
      student_id uuid,
      attendance_status text,
      time_in text,
      participation text,
      remarks text,
      behavior_remark text
    )
  LOOP
    IF v_rec.student_id IS NULL THEN CONTINUE; END IF;
    INSERT INTO public.register_student_entries (
      register_id, student_id, attendance_status, time_in, participation, remarks, behavior_remark, updated_at
    ) VALUES (
      p_register_id, v_rec.student_id,
      coalesce(nullif(trim(v_rec.attendance_status), ''), 'present'),
      nullif(trim(v_rec.time_in), '')::time,
      nullif(trim(v_rec.participation), ''),
      nullif(trim(v_rec.remarks), ''),
      nullif(trim(v_rec.behavior_remark), ''),
      now()
    )
    ON CONFLICT (register_id, student_id) DO UPDATE SET
      attendance_status = EXCLUDED.attendance_status,
      time_in = EXCLUDED.time_in,
      participation = EXCLUDED.participation,
      remarks = EXCLUDED.remarks,
      behavior_remark = EXCLUDED.behavior_remark,
      updated_at = now();
  END LOOP;

  UPDATE public.class_registers SET updated_at = now() WHERE id = p_register_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.upsert_register_entries(uuid, jsonb) TO authenticated;

-- 2) update_class_register_header (bypasses header UPDATE RLS)
CREATE OR REPLACE FUNCTION public.update_class_register_header(
  p_register_id uuid,
  p_lesson_summary text DEFAULT NULL,
  p_homework text DEFAULT NULL,
  p_lesson_objectives text DEFAULT NULL,
  p_teaching_methods text DEFAULT NULL,
  p_participation_summary text DEFAULT NULL,
  p_teacher_signature text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_reg public.class_registers%ROWTYPE;
  v_is_admin boolean := false;
  v_allowed boolean := false;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_reg FROM public.class_registers WHERE id = p_register_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Register not found'; END IF;
  IF v_reg.locked THEN RAISE EXCEPTION 'Register is locked'; END IF;

  v_is_admin := public.has_role(v_uid, 'admin'::app_role)
             OR public.has_role(v_uid, 'super_admin'::app_role);

  IF NOT v_is_admin
     AND v_reg.status NOT IN ('draft'::public.class_register_status, 'rejected'::public.class_register_status) THEN
    RAISE EXCEPTION 'Register cannot be edited in its current status (%)', v_reg.status;
  END IF;

  v_allowed := v_is_admin
            OR EXISTS (
                 SELECT 1 FROM public.teachers t
                 WHERE t.user_id = v_uid
                   AND (t.id = v_reg.teacher_id OR t.school_id = v_reg.school_id)
               )
            OR EXISTS (
                 SELECT 1 FROM public.profiles p
                 WHERE p.id = v_uid AND p.school_id = v_reg.school_id
               );

  IF NOT v_allowed THEN RAISE EXCEPTION 'Not authorized to edit this register'; END IF;

  UPDATE public.class_registers
  SET
    lesson_summary = COALESCE(p_lesson_summary, lesson_summary),
    homework = COALESCE(p_homework, homework),
    lesson_objectives = COALESCE(p_lesson_objectives, lesson_objectives),
    teaching_methods = COALESCE(p_teaching_methods, teaching_methods),
    participation_summary = COALESCE(p_participation_summary, participation_summary),
    teacher_signature = COALESCE(p_teacher_signature, teacher_signature),
    updated_at = now()
  WHERE id = p_register_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.update_class_register_header(uuid, text, text, text, text, text, text) TO authenticated;

-- 3) create_or_get_class_register (don't reuse submitted registers for teachers)
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

  IF v_register_id IS NOT NULL THEN RETURN v_register_id; END IF;

  IF v_is_admin THEN
    SELECT id INTO v_register_id
    FROM public.class_registers
    WHERE school_id = p_school_id AND class_id = p_class_id AND subject_id = p_subject_id
      AND register_date = p_register_date AND period_label = p_period_label
      AND COALESCE(term_id, '00000000-0000-0000-0000-000000000000'::uuid) =
          COALESCE(p_term_id, '00000000-0000-0000-0000-000000000000'::uuid)
    LIMIT 1;
    RETURN v_register_id;
  END IF;

  SELECT id INTO v_register_id
  FROM public.class_registers
  WHERE school_id = p_school_id AND class_id = p_class_id AND subject_id = p_subject_id
    AND register_date = p_register_date AND period_label = p_period_label
    AND COALESCE(term_id, '00000000-0000-0000-0000-000000000000'::uuid) =
        COALESCE(p_term_id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND status IN ('draft'::public.class_register_status, 'rejected'::public.class_register_status)
  LIMIT 1;

  IF v_register_id IS NOT NULL THEN RETURN v_register_id; END IF;

  SELECT status INTO v_existing_status
  FROM public.class_registers
  WHERE school_id = p_school_id AND class_id = p_class_id AND subject_id = p_subject_id
    AND register_date = p_register_date AND period_label = p_period_label
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
