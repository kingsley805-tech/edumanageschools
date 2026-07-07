-- Allow students to generate their own AI practice questions.
-- Redefines insert_waec_generated_questions to permit students (auto-approved,
-- school-scoped) and to return the inserted question IDs so the app can start a
-- session directly from the freshly generated set.
-- Run after apply-waec-remove-year.sql. Safe to re-run.

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
  v_is_authenticated boolean := v_uid IS NOT NULL;
  v_row jsonb;
  v_hash text;
  v_inserted integer := 0;
  v_skipped integer := 0;
  v_qtext text;
  v_status text;
  v_active boolean;
  v_new_id uuid;
  v_ids uuid[] := '{}';
BEGIN
  IF NOT v_is_authenticated THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You must be signed in.');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = v_uid
      AND ur.role IN ('admin', 'super_admin', 'teacher')
  ) INTO v_is_staff;

  -- Staff may create drafts (approval queue) or approved bank questions.
  -- Students always create approved, ready-to-use questions.
  IF v_is_staff THEN
    v_status := CASE WHEN p_auto_approve THEN 'approved' ELSE 'draft' END;
    v_active := p_auto_approve;
  ELSE
    v_status := 'approved';
    v_active := true;
  END IF;

  IF p_subject_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Subject is required.');
  END IF;

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
      )
      RETURNING id INTO v_new_id;

      v_inserted := v_inserted + 1;
      v_ids := array_append(v_ids, v_new_id);
    EXCEPTION
      WHEN unique_violation THEN
        v_skipped := v_skipped + 1;
        -- Reuse the existing duplicate so a student's generated set still fills up.
        SELECT id INTO v_new_id
        FROM public.waec_questions
        WHERE subject_id = p_subject_id AND content_hash = v_hash
        LIMIT 1;
        IF v_new_id IS NOT NULL THEN
          v_ids := array_append(v_ids, v_new_id);
        END IF;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'inserted', v_inserted,
    'skipped', v_skipped,
    'ids', to_jsonb(v_ids)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.insert_waec_generated_questions(uuid, uuid, text, jsonb, boolean)
  TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
