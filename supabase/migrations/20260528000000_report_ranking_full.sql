-- Full report ranking engine (ported from ascend-school-suite 20260524120000–20260524150000)
-- Replaces simplified recalculate_class_rankings with competition ranks, subject sync, and report card updates.

CREATE OR REPLACE FUNCTION public.format_rank_label(p_rank integer)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
BEGIN
  IF p_rank IS NULL OR p_rank < 1 THEN
    RETURN '—';
  END IF;
  RETURN p_rank::text || CASE
    WHEN p_rank % 100 BETWEEN 11 AND 13 THEN 'th'
    WHEN p_rank % 10 = 1 THEN 'st'
    WHEN p_rank % 10 = 2 THEN 'nd'
    WHEN p_rank % 10 = 3 THEN 'rd'
    ELSE 'th'
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.build_report_subjects_json(
  p_student_id uuid,
  p_term_id uuid,
  p_class_id uuid
)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    jsonb_agg(row_data ORDER BY row_data->>'name'),
    '[]'::jsonb
  )
  FROM (
    SELECT jsonb_build_object(
      'name', s.name,
      'classScore', ROUND((COALESCE(r.ca_score, 0)::numeric / 40.0) * 50, 2),
      'examScore', ROUND((COALESCE(r.exam_score, 0)::numeric / 60.0) * 50, 2),
      'total', ROUND(
        ((COALESCE(r.ca_score, 0) + COALESCE(r.exam_score, 0))::numeric / 100.0) * 100,
        2
      ),
      'position', public.format_rank_label(r.position::integer),
      'grade', COALESCE(r.grade, '—'),
      'remark', COALESCE(r.remark, '—')
    ) AS row_data
    FROM public.results r
    INNER JOIN public.subjects s ON s.id = r.subject_id
    INNER JOIN public.class_subjects cs
      ON cs.subject_id = r.subject_id AND cs.class_id = p_class_id
    WHERE r.student_id = p_student_id
      AND r.term_id = p_term_id
  ) rows;
$$;

CREATE OR REPLACE FUNCTION public.result_ranking_score(
  p_ca numeric,
  p_exam numeric
)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path TO 'public'
AS $$
  SELECT ROUND((COALESCE(p_ca, 0) + COALESCE(p_exam, 0))::numeric, 4);
$$;

CREATE OR REPLACE FUNCTION public.recalculate_class_rankings(p_class_id uuid, p_term_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
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

  SELECT school_id INTO v_school FROM public.classes WHERE id = p_class_id;
  IF v_school IS NULL THEN
    RAISE EXCEPTION 'Class not found';
  END IF;

  IF NOT (
    public.is_school_admin(v_uid, v_school)
    OR EXISTS (SELECT 1 FROM public.class_subjects cs WHERE cs.class_id = p_class_id AND cs.teacher_id = v_uid)
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

  RETURN jsonb_build_object(
    'subjectUpdates', v_subject_updates,
    'classPositions', v_class_positions,
    'reportCardsUpdated', v_reports_updated,
    'reportCardsCreated', v_reports_created,
    'eligibleStudents', v_student_count
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.format_rank_label(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.build_report_subjects_json(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_class_rankings(uuid, uuid) TO authenticated;
