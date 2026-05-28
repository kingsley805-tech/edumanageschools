-- Definitive fix: teacher report card save (RLS + SECURITY DEFINER upsert)

CREATE OR REPLACE FUNCTION public.teacher_can_access_student_report(
  p_teacher_id uuid,
  p_student_id uuid,
  p_class_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_class_id uuid;
BEGIN
  IF p_teacher_id IS NULL OR p_student_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT COALESCE(p_class_id, s.class_id) INTO v_class_id
  FROM public.students s
  WHERE s.id = p_student_id;

  IF v_class_id IS NULL THEN
    RETURN false;
  END IF;

  RETURN public.teacher_can_view_student(p_teacher_id, v_class_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.can_manage_term_report_card(
  p_user_id uuid,
  p_school_id uuid,
  p_student_id uuid,
  p_class_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_school uuid;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;

  IF public.has_role(p_user_id, 'super_admin'::app_role) THEN
    RETURN true;
  END IF;

  SELECT s.school_id INTO v_student_school
  FROM public.students s
  WHERE s.id = p_student_id;

  IF public.is_school_admin(p_user_id, COALESCE(p_school_id, v_student_school)) THEN
    RETURN true;
  END IF;

  IF public.teacher_can_access_student_report(p_user_id, p_student_id, p_class_id)
     AND (
       public.has_role(p_user_id, 'teacher'::app_role)
       OR EXISTS (SELECT 1 FROM public.teachers t WHERE t.user_id = p_user_id)
     ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

DROP POLICY IF EXISTS "teachers manage assigned class reports" ON public.term_report_cards;

CREATE POLICY "staff manage term reports"
  ON public.term_report_cards
  FOR ALL
  TO authenticated
  USING (
    public.can_manage_term_report_card(auth.uid(), school_id, student_id, class_id)
  )
  WITH CHECK (
    public.can_manage_term_report_card(auth.uid(), school_id, student_id, class_id)
    AND (
      teacher_id IS NULL
      OR teacher_id = auth.uid()
      OR public.is_school_admin(auth.uid(), school_id)
      OR public.has_role(auth.uid(), 'super_admin'::app_role)
    )
  );

-- Bypass RLS for authorized saves (client uses this when direct insert fails)
CREATE OR REPLACE FUNCTION public.upsert_term_report_card(p_row jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_student_id uuid;
  v_term_id uuid;
  v_class_id uuid;
  v_school_id uuid;
  v_teacher_id uuid;
  v_status public.report_card_status;
  v_existing_id uuid;
  v_existing_version int;
  v_new_version int;
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_student_id := NULLIF(trim(p_row->>'student_id'), '')::uuid;
  v_term_id := NULLIF(trim(p_row->>'term_id'), '')::uuid;
  v_class_id := NULLIF(trim(p_row->>'class_id'), '')::uuid;
  v_school_id := NULLIF(trim(p_row->>'school_id'), '')::uuid;
  v_teacher_id := COALESCE(NULLIF(trim(p_row->>'teacher_id'), '')::uuid, v_uid);
  v_status := COALESCE((p_row->>'status')::public.report_card_status, 'draft'::public.report_card_status);

  IF v_student_id IS NULL OR v_school_id IS NULL THEN
    RAISE EXCEPTION 'student_id and school_id are required';
  END IF;

  IF NOT public.can_manage_term_report_card(v_uid, v_school_id, v_student_id, v_class_id) THEN
    RAISE EXCEPTION 'Not authorized to save this report card';
  END IF;

  SELECT id, version
  INTO v_existing_id, v_existing_version
  FROM public.term_report_cards
  WHERE student_id = v_student_id
    AND (
      (v_term_id IS NULL AND term_id IS NULL)
      OR term_id = v_term_id
    )
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    v_new_version := COALESCE(v_existing_version, 1) + 1;
    UPDATE public.term_report_cards
    SET
      school_id = v_school_id,
      class_id = COALESCE(v_class_id, class_id),
      teacher_id = v_teacher_id,
      status = v_status,
      student_name = COALESCE(p_row->>'student_name', student_name),
      class_name = COALESCE(p_row->>'class_name', class_name),
      roll_number = COALESCE(NULLIF(p_row->>'roll_number', '')::integer, roll_number),
      class_position = COALESCE(p_row->>'class_position', class_position),
      class_student_total_manual = COALESCE(NULLIF(p_row->>'class_student_total_manual', '')::integer, class_student_total_manual),
      term_label = COALESCE(p_row->>'term_label', term_label),
      academic_year = COALESCE(p_row->>'academic_year', academic_year),
      attendance_made = COALESCE(p_row->>'attendance_made', attendance_made),
      attendance_total = COALESCE(p_row->>'attendance_total', attendance_total),
      conduct = COALESCE(p_row->>'conduct', conduct),
      interest = COALESCE(p_row->>'interest', interest),
      club = COALESCE(p_row->>'club', club),
      attitude = COALESCE(p_row->>'attitude', attitude),
      teacher_remark = COALESCE(p_row->>'teacher_remark', teacher_remark),
      school_closes = COALESCE(p_row->>'school_closes', school_closes),
      reopening_date = COALESCE(p_row->>'reopening_date', reopening_date),
      next_term = COALESCE(p_row->>'next_term', next_term),
      teacher_sign_date = COALESCE(p_row->>'teacher_sign_date', teacher_sign_date),
      head_sign_date = COALESCE(p_row->>'head_sign_date', head_sign_date),
      parent_sign_date = COALESCE(p_row->>'parent_sign_date', parent_sign_date),
      admin_comment = COALESCE(p_row->>'admin_comment', admin_comment),
      rejection_reason = COALESCE(p_row->>'rejection_reason', rejection_reason),
      subjects = COALESCE(p_row->'subjects', subjects),
      total_score = COALESCE(NULLIF(p_row->>'total_score', '')::numeric, total_score),
      saved_at = COALESCE((p_row->>'saved_at')::timestamptz, now()),
      updated_at = now(),
      version = v_new_version
    WHERE id = v_existing_id;

    v_id := v_existing_id;
  ELSE
    v_new_version := COALESCE(NULLIF(p_row->>'version', '')::integer, 1);
    INSERT INTO public.term_report_cards (
      school_id,
      student_id,
      term_id,
      class_id,
      teacher_id,
      status,
      student_name,
      class_name,
      roll_number,
      class_position,
      class_student_total_manual,
      term_label,
      academic_year,
      attendance_made,
      attendance_total,
      conduct,
      interest,
      club,
      attitude,
      teacher_remark,
      school_closes,
      reopening_date,
      next_term,
      teacher_sign_date,
      head_sign_date,
      parent_sign_date,
      admin_comment,
      rejection_reason,
      subjects,
      total_score,
      version,
      saved_at
    )
    VALUES (
      v_school_id,
      v_student_id,
      v_term_id,
      v_class_id,
      v_teacher_id,
      v_status,
      COALESCE(p_row->>'student_name', 'Student'),
      p_row->>'class_name',
      NULLIF(p_row->>'roll_number', '')::integer,
      p_row->>'class_position',
      NULLIF(p_row->>'class_student_total_manual', '')::integer,
      p_row->>'term_label',
      p_row->>'academic_year',
      p_row->>'attendance_made',
      p_row->>'attendance_total',
      p_row->>'conduct',
      p_row->>'interest',
      p_row->>'club',
      p_row->>'attitude',
      p_row->>'teacher_remark',
      p_row->>'school_closes',
      p_row->>'reopening_date',
      p_row->>'next_term',
      p_row->>'teacher_sign_date',
      p_row->>'head_sign_date',
      p_row->>'parent_sign_date',
      p_row->>'admin_comment',
      p_row->>'rejection_reason',
      COALESCE(p_row->'subjects', '[]'::jsonb),
      NULLIF(p_row->>'total_score', '')::numeric,
      v_new_version,
      COALESCE((p_row->>'saved_at')::timestamptz, now())
    )
    RETURNING id INTO v_id;
  END IF;

  RETURN jsonb_build_object(
    'id', v_id,
    'version', v_new_version,
    'status', v_status
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_manage_term_report_card(uuid, uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_term_report_card(jsonb) TO authenticated;
