-- DDL and Helper functions for Class Teacher System
-- Add class_teacher_id column to classes table
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS class_teacher_id UUID REFERENCES public.teachers(id) ON DELETE SET NULL;

-- Create academic_recommendations table
CREATE TABLE IF NOT EXISTS public.academic_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  term_id uuid REFERENCES public.terms(id) ON DELETE SET NULL,
  recommendation_type text NOT NULL CHECK (recommendation_type IN ('study_plan', 'extra_classes', 'assignment', 'intervention', 'general')),
  suggestions text NOT NULL,
  strengths text,
  weaknesses text,
  threshold_alert boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on academic_recommendations
ALTER TABLE public.academic_recommendations ENABLE ROW LEVEL SECURITY;

-- RLS policies for academic_recommendations
DROP POLICY IF EXISTS "school read recommendations" ON public.academic_recommendations;
CREATE POLICY "school read recommendations" ON public.academic_recommendations
  FOR SELECT TO authenticated
  USING (
    school_id = public.get_user_school_id(auth.uid())
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.students s
      JOIN public.parent_student_links psl ON s.id = psl.student_id
      JOIN public.parents p ON psl.parent_id = p.id
      WHERE s.id = student_id AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "teachers manage own recommendations" ON public.academic_recommendations;
CREATE POLICY "teachers manage own recommendations" ON public.academic_recommendations
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.teachers t
      WHERE t.user_id = auth.uid() AND t.id = teacher_id
    )
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

-- Overwrite teacher view/relationship helper functions to check class_teacher_id
CREATE OR REPLACE FUNCTION public.teacher_can_view_student(teacher_user_id UUID, student_class_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.teachers t
    JOIN public.class_subjects cs ON cs.teacher_id = t.id
    WHERE t.user_id = teacher_user_id
    AND cs.class_id = student_class_id
  ) OR EXISTS (
    SELECT 1 FROM public.classes c
    JOIN public.teachers t ON t.id = c.class_teacher_id
    WHERE t.user_id = teacher_user_id
    AND c.id = student_class_id
  )
$$;

CREATE OR REPLACE FUNCTION public.teacher_can_view_parent(teacher_user_id UUID, parent_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.teachers t
    JOIN public.class_subjects cs ON cs.teacher_id = t.id
    JOIN public.students s ON s.class_id = cs.class_id
    WHERE t.user_id = teacher_user_id
    AND s.guardian_id = parent_id
  ) OR EXISTS (
    SELECT 1 FROM public.classes c
    JOIN public.teachers t ON t.id = c.class_teacher_id
    JOIN public.students s ON s.class_id = c.id
    WHERE t.user_id = teacher_user_id
    AND s.guardian_id = parent_id
  )
$$;

CREATE OR REPLACE FUNCTION public.parent_can_view_teacher(parent_user_id UUID, teacher_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.parents p
    JOIN public.students s ON s.guardian_id = p.id
    JOIN public.class_subjects cs ON cs.class_id = s.class_id
    WHERE p.user_id = parent_user_id
    AND cs.teacher_id = teacher_id
  ) OR EXISTS (
    SELECT 1 FROM public.parents p
    JOIN public.students s ON s.guardian_id = p.id
    JOIN public.classes c ON c.id = s.class_id
    WHERE p.user_id = parent_user_id
    AND c.class_teacher_id = teacher_id
  )
$$;

CREATE OR REPLACE FUNCTION public.get_teacher_student_user_ids(_teacher_user_id UUID)
RETURNS SETOF UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT s.user_id
  FROM public.teachers t
  JOIN public.class_subjects cs ON cs.teacher_id = t.id
  JOIN public.students s ON s.class_id = cs.class_id
  WHERE t.user_id = _teacher_user_id
  UNION
  SELECT DISTINCT s.user_id
  FROM public.teachers t
  JOIN public.classes c ON c.class_teacher_id = t.id
  JOIN public.students s ON s.class_id = c.id
  WHERE t.user_id = _teacher_user_id
$$;

CREATE OR REPLACE FUNCTION public.get_teacher_parent_user_ids(_teacher_user_id UUID)
RETURNS SETOF UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT p.user_id
  FROM public.teachers t
  JOIN public.class_subjects cs ON cs.teacher_id = t.id
  JOIN public.students s ON s.class_id = cs.class_id
  JOIN public.parents p ON p.id = s.guardian_id
  WHERE t.user_id = _teacher_user_id
  UNION
  SELECT DISTINCT p.user_id
  FROM public.teachers t
  JOIN public.classes c ON c.class_teacher_id = t.id
  JOIN public.students s ON s.class_id = c.id
  JOIN public.parents p ON p.id = s.guardian_id
  WHERE t.user_id = _teacher_user_id
$$;

-- Restrict editing approved or published report cards by teachers
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
  v_existing_status public.report_card_status;
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

  SELECT id, version, status
  INTO v_existing_id, v_existing_version, v_existing_status
  FROM public.term_report_cards
  WHERE student_id = v_student_id
    AND (
      (v_term_id IS NULL AND term_id IS NULL)
      OR term_id = v_term_id
    )
  LIMIT 1;

  -- Security rule check: Teachers cannot modify approved or published report cards without admin rights
  IF v_existing_id IS NOT NULL AND v_existing_status IN ('approved'::public.report_card_status, 'published'::public.report_card_status) THEN
    IF NOT (
      public.has_role(v_uid, 'admin'::app_role)
      OR public.has_role(v_uid, 'super_admin'::app_role)
      OR public.is_school_admin(v_uid, v_school_id)
    ) THEN
      RAISE EXCEPTION 'Cannot modify an approved or published report card without administrator authorization';
    END IF;
  END IF;

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

-- Create auditing trigger function for term_report_cards
CREATE OR REPLACE FUNCTION public.log_term_report_card_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school_id uuid;
  v_action text;
  v_details jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'CREATE';
    v_school_id := NEW.school_id;
    v_details := jsonb_build_object('status', NEW.status, 'student_name', NEW.student_name);
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'UPDATE';
    v_school_id := NEW.school_id;
    v_details := jsonb_build_object(
      'old_status', OLD.status,
      'new_status', NEW.status,
      'student_name', NEW.student_name,
      'version', NEW.version,
      'admin_comment', NEW.admin_comment,
      'rejection_reason', NEW.rejection_reason
    );
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'DELETE';
    v_school_id := OLD.school_id;
    v_details := jsonb_build_object('status', OLD.status, 'student_name', OLD.student_name);
  END IF;

  PERFORM public.write_audit_log(
    v_school_id,
    v_action,
    'term_report_cards',
    COALESCE(NEW.id, OLD.id),
    'reports',
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(NEW) ELSE NULL END,
    v_details
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_log_term_report_card_change ON public.term_report_cards;
CREATE TRIGGER trg_log_term_report_card_change
  AFTER INSERT OR UPDATE OR DELETE ON public.term_report_cards
  FOR EACH ROW EXECUTE FUNCTION public.log_term_report_card_change();

-- Create auditing trigger function for parent-teacher messages
CREATE OR REPLACE FUNCTION public.log_message_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school_id uuid;
  v_sender_name text;
  v_receiver_name text;
BEGIN
  SELECT school_id, full_name INTO v_school_id, v_sender_name FROM public.profiles WHERE id = NEW.sender_id;
  IF v_school_id IS NULL THEN
    SELECT school_id, full_name INTO v_school_id, v_receiver_name FROM public.profiles WHERE id = NEW.receiver_id;
  ELSE
    SELECT full_name INTO v_receiver_name FROM public.profiles WHERE id = NEW.receiver_id;
  END IF;

  IF v_school_id IS NOT NULL THEN
    PERFORM public.write_audit_log(
      v_school_id,
      'SEND_MESSAGE',
      'messages',
      NEW.id,
      'communication',
      NEW.id,
      NULL,
      to_jsonb(NEW),
      jsonb_build_object(
        'sender_name', v_sender_name,
        'receiver_name', v_receiver_name,
        'subject', NEW.subject
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_message_activity ON public.messages;
CREATE TRIGGER trg_log_message_activity
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.log_message_activity();

-- Create trigger function for academic recommendations
CREATE OR REPLACE FUNCTION public.log_academic_recommendation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_name text;
  v_teacher_name text;
  v_guardian_user_id uuid;
BEGIN
  SELECT full_name INTO v_student_name FROM public.students WHERE id = NEW.student_id;
  SELECT profiles.full_name INTO v_teacher_name FROM public.teachers t JOIN public.profiles ON profiles.id = t.user_id WHERE t.id = NEW.teacher_id;

  -- Log recommendation
  PERFORM public.write_audit_log(
    NEW.school_id,
    'SEND_RECOMMENDATION',
    'academic_recommendations',
    NEW.id,
    'communication',
    NEW.id,
    NULL,
    to_jsonb(NEW),
    jsonb_build_object(
      'student_name', v_student_name,
      'teacher_name', v_teacher_name,
      'type', NEW.recommendation_type
    )
  );

  -- Create a notification for the parent
  SELECT p.user_id INTO v_guardian_user_id 
  FROM public.students s 
  JOIN public.parents p ON s.guardian_id = p.id 
  WHERE s.id = NEW.student_id;

  IF v_guardian_user_id IS NOT NULL THEN
    PERFORM public.create_notification(
      v_guardian_user_id,
      'New academic recommendation',
      'Class teacher ' || COALESCE(v_teacher_name, 'assigned teacher') || ' sent an academic recommendation for ' || COALESCE(v_student_name, 'your child') || '.',
      jsonb_build_object('type', 'academic_recommendation', 'recommendation_id', NEW.id)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_academic_recommendation ON public.academic_recommendations;
CREATE TRIGGER trg_log_academic_recommendation
  AFTER INSERT ON public.academic_recommendations
  FOR EACH ROW EXECUTE FUNCTION public.log_academic_recommendation();

-- Modify save_teacher_class_attendance to audit log changes
CREATE OR REPLACE FUNCTION public.save_teacher_class_attendance(
  p_class_id uuid,
  p_date date,
  p_records jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_rec record;
  v_school_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT school_id INTO v_school_id FROM public.classes WHERE id = p_class_id;

  IF NOT (
    public.teacher_can_view_student(v_uid, p_class_id)
    OR (
      public.has_role(v_uid, 'admin'::app_role)
      AND v_school_id = public.get_user_school_id(v_uid)
    )
  ) THEN
    RAISE EXCEPTION 'Not authorized to mark attendance for this class';
  END IF;

  DELETE FROM public.attendance
  WHERE class_id = p_class_id AND date = p_date;

  FOR v_rec IN
    SELECT student_id, status
    FROM jsonb_to_recordset(coalesce(p_records, '[]'::jsonb)) AS x(student_id uuid, status text)
  LOOP
    INSERT INTO public.attendance (student_id, class_id, date, status, recorded_by, recorded_at)
    VALUES (v_rec.student_id, p_class_id, p_date, v_rec.status, v_uid, now());
  END LOOP;

  -- Log attendance update
  PERFORM public.write_audit_log(
    v_school_id,
    'UPDATE_ATTENDANCE',
    'attendance',
    p_class_id,
    'attendance',
    p_class_id,
    NULL,
    p_records,
    jsonb_build_object('class_id', p_class_id, 'date', p_date, 'records_count', jsonb_array_length(p_records))
  );
END;
$$;

-- Modify recalculate_class_rankings to log positions generation
CREATE OR REPLACE FUNCTION public.recalculate_class_rankings(p_class_id uuid, p_term_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_teacher_record uuid;
  v_school uuid;
  v_subject_count int;
  v_subject_updates int := 0;
  v_class_positions int := 0;
  v_reports_updated int := 0;
  v_reports_created int := 0;
  v_student_count int := 0;
  v_subject record;
  v_student record;
  v_class_student record;
  v_report_id uuid;
  v_report_status text;
  v_rank int;
  v_prev numeric;
  v_idx int;
  v_score numeric;
  v_total numeric;
  v_grade text;
  v_remark text;
  v_class_ranks jsonb := '{}'::jsonb;
  v_class_totals jsonb := '{}'::jsonb;
  v_subjects_json jsonb;
  v_class_pos_label text;
  v_agg_total numeric;
  v_st record;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_teacher_record := public.report_teacher_record_id(v_uid);

  SELECT school_id INTO v_school FROM public.classes WHERE id = p_class_id;
  IF v_school IS NULL THEN
    RAISE EXCEPTION 'Class not found';
  END IF;

  -- Check if user is school admin OR teachers assigned via class_subjects OR classes.class_teacher_id
  IF NOT (
    public.is_school_admin(v_uid, v_school)
    OR EXISTS (
      SELECT 1 FROM public.class_subjects cs
      WHERE cs.class_id = p_class_id
        AND (cs.teacher_id = v_uid OR cs.teacher_id = v_teacher_record)
    )
    OR EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = p_class_id
        AND (c.class_teacher_id = v_uid OR c.class_teacher_id = v_teacher_record)
    )
  ) THEN
    RAISE EXCEPTION 'Not authorized to recalculate positions for this class';
  END IF;

  SELECT COUNT(DISTINCT subject_id) INTO v_subject_count
  FROM public.class_subjects
  WHERE class_id = p_class_id;

  IF v_subject_count = 0 THEN
    RETURN jsonb_build_object(
      'subjectUpdates', 0,
      'classPositions', 0,
      'reportCardsUpdated', 0,
      'reportCardsCreated', 0,
      'eligibleStudents', 0
    );
  END IF;

  CREATE TEMP TABLE tmp_class_students ON COMMIT DROP AS
  SELECT st.id AS student_id
  FROM public.students st
  WHERE st.class_id = p_class_id;

  SELECT COUNT(*) INTO v_student_count FROM tmp_class_students;

  IF v_student_count = 0 THEN
    RAISE EXCEPTION 'No students in this class.';
  END IF;

  UPDATE public.results r
  SET position = NULL
  FROM public.students st
  INNER JOIN public.class_subjects cs
    ON cs.class_id = st.class_id
  WHERE r.student_id = st.id
    AND r.subject_id = cs.subject_id
    AND r.term_id = p_term_id
    AND st.class_id = p_class_id;

  FOR v_subject IN
    SELECT DISTINCT cs.subject_id
    FROM public.class_subjects cs
    WHERE cs.class_id = p_class_id
  LOOP
    v_rank := 0;
    v_prev := NULL;
    v_idx := 0;

    FOR v_student IN
      SELECT
        r.id AS result_id,
        public.result_ranking_score(r.ca_score, r.exam_score) AS score
      FROM public.results r
      INNER JOIN tmp_class_students cs ON cs.student_id = r.student_id
      WHERE r.subject_id = v_subject.subject_id
        AND r.term_id = p_term_id
      ORDER BY score DESC, r.student_id
    LOOP
      v_score := v_student.score;
      v_idx := v_idx + 1;

      IF v_prev IS NULL OR v_score IS DISTINCT FROM v_prev THEN
        v_rank := v_idx;
        v_prev := v_score;
      END IF;

      v_total := v_score;
      v_grade := CASE
        WHEN v_total >= 80 THEN 'A' WHEN v_total >= 70 THEN 'B+'
        WHEN v_total >= 60 THEN 'B' WHEN v_total >= 55 THEN 'C+'
        WHEN v_total >= 50 THEN 'C' WHEN v_total >= 45 THEN 'D+'
        WHEN v_total >= 40 THEN 'D' WHEN v_total >= 35 THEN 'E'
        ELSE 'F'
      END;
      v_remark := CASE
        WHEN v_total >= 80 THEN 'Excellent' WHEN v_total >= 70 THEN 'Very Good'
        WHEN v_total >= 60 THEN 'Good' WHEN v_total >= 50 THEN 'Credit'
        WHEN v_total >= 40 THEN 'Pass' WHEN v_total >= 35 THEN 'Pass'
        ELSE 'Fail'
      END;

      UPDATE public.results
      SET position = v_rank, grade = v_grade, remark = v_remark
      WHERE id = v_student.result_id;

      v_subject_updates := v_subject_updates + 1;
    END LOOP;
  END LOOP;

  v_rank := 0;
  v_prev := NULL;
  v_idx := 0;

  FOR v_student IN
    SELECT
      cs.student_id,
      COALESCE(agg.aggregate_total, 0)::numeric AS aggregate_total
    FROM tmp_class_students cs
    LEFT JOIN LATERAL (
      SELECT SUM(public.result_ranking_score(r.ca_score, r.exam_score)) AS aggregate_total
      FROM public.results r
      INNER JOIN public.class_subjects csub
        ON csub.subject_id = r.subject_id AND csub.class_id = p_class_id
      WHERE r.student_id = cs.student_id
        AND r.term_id = p_term_id
    ) agg ON true
    ORDER BY aggregate_total DESC, cs.student_id
  LOOP
    v_score := v_student.aggregate_total;
    v_idx := v_idx + 1;

    IF v_prev IS NULL OR v_score IS DISTINCT FROM v_prev THEN
      v_rank := v_idx;
      v_prev := v_score;
    END IF;

    v_class_ranks := v_class_ranks || jsonb_build_object(v_student.student_id::text, v_rank);
    v_class_totals := v_class_totals || jsonb_build_object(
      v_student.student_id::text,
      v_student.aggregate_total
    );
    v_class_positions := v_class_positions + 1;
  END LOOP;

  FOR v_class_student IN SELECT student_id FROM tmp_class_students
  LOOP
    SELECT tr.id, tr.status::text
    INTO v_report_id, v_report_status
    FROM public.term_report_cards tr
    WHERE tr.student_id = v_class_student.student_id
      AND tr.term_id = p_term_id
    LIMIT 1;

    IF v_report_status IN ('approved', 'published') THEN
      CONTINUE;
    END IF;

    v_subjects_json := public.build_report_subjects_json(
      v_class_student.student_id,
      p_term_id,
      p_class_id
    );

    v_class_pos_label := public.format_rank_label(
      NULLIF((v_class_ranks ->> v_class_student.student_id::text), '')::int
    );
    v_agg_total := NULLIF((v_class_totals ->> v_class_student.student_id::text), '')::numeric;

    IF v_report_id IS NULL THEN
      SELECT st.id, st.full_name, st.school_id, st.admission_number, c.name AS class_name
      INTO v_st
      FROM public.students st
      LEFT JOIN public.classes c ON c.id = st.class_id
      WHERE st.id = v_class_student.student_id;

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
        subjects,
        class_position,
        total_score,
        version,
        saved_at
      )
      VALUES (
        COALESCE(v_st.school_id, v_school),
        v_class_student.student_id,
        p_term_id,
        p_class_id,
        v_uid,
        'draft',
        COALESCE(v_st.full_name, 'Student'),
        v_st.class_name,
        NULLIF(regexp_replace(COALESCE(v_st.admission_number, ''), '\D', '', 'g'), '')::integer,
        v_subjects_json,
        v_class_pos_label,
        v_agg_total,
        1,
        now()
      );

      v_reports_created := v_reports_created + 1;
    ELSE
      UPDATE public.term_report_cards
      SET
        class_id = p_class_id,
        subjects = v_subjects_json,
        class_position = v_class_pos_label,
        total_score = COALESCE(v_agg_total, total_score),
        version = COALESCE(version, 1) + 1,
        updated_at = now()
      WHERE id = v_report_id;

      v_reports_updated := v_reports_updated + 1;
    END IF;
  END LOOP;

  -- Log rankings recalculation (positions generation)
  PERFORM public.write_audit_log(
    v_school,
    'GENERATE_POSITIONS',
    'term_report_cards',
    p_class_id,
    'reports',
    p_class_id,
    NULL,
    jsonb_build_object('class_id', p_class_id, 'term_id', p_term_id),
    jsonb_build_object('message', 'Recalculated class rankings and positions')
  );

  RETURN jsonb_build_object(
    'subjectUpdates', v_subject_updates,
    'classPositions', v_class_positions,
    'reportCardsUpdated', v_reports_updated,
    'reportCardsCreated', v_reports_created,
    'eligibleStudents', v_student_count
  );
END;
$function$;

NOTIFY pgrst, 'reload schema';
