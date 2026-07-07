-- Remove exam-year dependency from WAEC questions.
-- Questions are now curriculum-style BECE/WASSCE items (not tied to a past-paper year).
-- Run after apply-waec-platform.sql and apply-waec-ai-generation.sql.

-- 1) Make year optional and clear existing year labels.
ALTER TABLE public.waec_questions
  ALTER COLUMN year DROP NOT NULL;

UPDATE public.waec_questions SET year = NULL WHERE year IS NOT NULL;

-- 2) Replace year-based index with subject-centric index.
DROP INDEX IF EXISTS idx_waec_questions_subject;
CREATE INDEX IF NOT EXISTS idx_waec_questions_subject
  ON public.waec_questions (subject_id, paper_type, difficulty);

-- 3) Subject question counts (replaces year-based catalog).
CREATE OR REPLACE FUNCTION public.get_waec_question_catalog(p_level text DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.sort_order, t.subject_name), '[]'::jsonb)
  FROM (
    SELECT
      s.id AS subject_id,
      s.name AS subject_name,
      s.level,
      s.category,
      s.sort_order,
      count(q.id) FILTER (WHERE q.is_active AND coalesce(q.status, 'approved') = 'approved')::int AS total_questions,
      coalesce(
        to_jsonb(array_remove(array_agg(DISTINCT q.topic) FILTER (WHERE q.topic IS NOT NULL AND q.topic <> ''), NULL)),
        '[]'::jsonb
      ) AS topics
    FROM public.waec_subjects s
    LEFT JOIN public.waec_questions q ON q.subject_id = s.id
    WHERE s.is_active
      AND (p_level IS NULL OR s.level = p_level)
    GROUP BY s.id, s.name, s.level, s.category, s.sort_order
  ) t;
$$;

GRANT EXECUTE ON FUNCTION public.get_waec_question_catalog(text) TO anon, authenticated;

-- 4) Insert RPC: no year, optional auto-approve for student-ready banks.
CREATE OR REPLACE FUNCTION public.insert_waec_generated_questions(
  p_subject_id uuid,
  p_school_id uuid,
  p_ai_model text,
  p_rows jsonb,
  p_auto_approve boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_staff boolean;
  v_row jsonb;
  v_hash text;
  v_inserted integer := 0;
  v_skipped integer := 0;
  v_qtext text;
  v_status text;
  v_active boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = v_uid
      AND ur.role IN ('admin', 'super_admin', 'teacher')
  ) INTO v_is_staff;

  IF NOT v_is_staff THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Only staff can generate questions.');
  END IF;

  IF p_subject_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Subject is required.');
  END IF;

  v_status := CASE WHEN p_auto_approve THEN 'approved' ELSE 'draft' END;
  v_active := p_auto_approve;

  FOR v_row IN SELECT * FROM jsonb_array_elements(coalesce(p_rows, '[]'::jsonb))
  LOOP
    v_qtext := nullif(trim(v_row->>'question_text'), '');
    IF v_qtext IS NULL THEN
      CONTINUE;
    END IF;

    v_hash := public.waec_question_hash(v_qtext);

    BEGIN
      INSERT INTO public.waec_questions (
        school_id, subject_id, year, paper_type, topic, sub_topic,
        difficulty, question_type, question_text, options, correct_answer,
        explanation, marking_scheme, learning_objective, estimated_time_seconds,
        keywords, marks, is_active, status, generated_by, ai_model, content_hash,
        updated_at
      )
      VALUES (
        p_school_id,
        p_subject_id,
        NULL,
        coalesce(nullif(v_row->>'paper_type', ''), 'paper_1'),
        nullif(v_row->>'topic', ''),
        nullif(v_row->>'sub_topic', ''),
        coalesce(nullif(v_row->>'difficulty', ''), 'medium'),
        coalesce(nullif(v_row->>'question_type', ''), 'objective'),
        v_qtext,
        CASE WHEN jsonb_typeof(v_row->'options') = 'array' THEN v_row->'options' ELSE NULL END,
        nullif(v_row->>'correct_answer', ''),
        nullif(v_row->>'explanation', ''),
        nullif(v_row->>'marking_scheme', ''),
        nullif(v_row->>'learning_objective', ''),
        nullif(v_row->>'estimated_time_seconds', '')::int,
        CASE
          WHEN jsonb_typeof(v_row->'keywords') = 'array'
          THEN ARRAY(SELECT jsonb_array_elements_text(v_row->'keywords'))
          ELSE '{}'::text[]
        END,
        coalesce(nullif(v_row->>'marks', '')::numeric, 1),
        v_active,
        v_status,
        'ai',
        p_ai_model,
        v_hash,
        now()
      );
      v_inserted := v_inserted + 1;
    EXCEPTION
      WHEN unique_violation THEN
        v_skipped := v_skipped + 1;
    END;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'inserted', v_inserted, 'skipped', v_skipped);
END;
$$;

-- Drop old 4-arg overload if present.
DROP FUNCTION IF EXISTS public.insert_waec_generated_questions(uuid, uuid, integer, text, jsonb);

GRANT EXECUTE ON FUNCTION public.insert_waec_generated_questions(uuid, uuid, text, jsonb, boolean)
  TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
