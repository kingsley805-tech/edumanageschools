-- Header save RPC (bypasses RLS; same auth rules as upsert_register_entries).
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
            OR public.has_role(v_uid, 'staff'::app_role)
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
