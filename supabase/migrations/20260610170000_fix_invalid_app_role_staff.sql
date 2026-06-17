-- Fix register RPCs that incorrectly referenced 'staff'::app_role (not a valid app_role enum value).
-- Valid app_role values: admin, teacher, parent, student, super_admin, accountant, auditor.

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
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_reg FROM public.class_registers WHERE id = p_register_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Register not found';
  END IF;

  IF v_reg.locked THEN
    RAISE EXCEPTION 'Register is locked';
  END IF;

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

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Not authorized to edit this register';
  END IF;

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
    IF v_rec.student_id IS NULL THEN
      CONTINUE;
    END IF;

    INSERT INTO public.register_student_entries (
      register_id, student_id, attendance_status, time_in, participation, remarks, behavior_remark, updated_at
    ) VALUES (
      p_register_id,
      v_rec.student_id,
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
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_reg FROM public.class_registers WHERE id = p_register_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Register not found';
  END IF;

  IF v_reg.locked THEN
    RAISE EXCEPTION 'Register is locked';
  END IF;

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

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Not authorized to edit this register';
  END IF;

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

NOTIFY pgrst, 'reload schema';
