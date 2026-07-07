-- WAEC AI generation via database RPC (NO edge function required).
-- Mirrors the gemini_chat RPC approach: calls Gemini through the http extension
-- and inserts questions directly. Works even when edge functions are not deployed.
-- Run in Supabase SQL Editor after:
--   apply-waec-platform.sql, apply-waec-ai-generation.sql,
--   apply-waec-remove-year.sql, apply-waec-student-generate.sql,
--   apply-gemini-chat-rpc.sql (for platform_ai_config + http extension)
-- Safe to re-run.

CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.waec_generate_questions(
  p_subject_id uuid,
  p_subject_name text,
  p_level text,
  p_topic text DEFAULT NULL,
  p_sub_topic text DEFAULT NULL,
  p_difficulty text DEFAULT 'mixed',
  p_question_type text DEFAULT 'objective',
  p_count integer DEFAULT 10,
  p_auto_approve boolean DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_staff boolean;
  v_is_student boolean;
  v_cfg record;
  v_school_id uuid;
  v_count integer;
  v_auto_approve boolean;
  v_level_label text;
  v_exam_style text;
  v_type_instructions text;
  v_difficulty_line text;
  v_topic_line text;
  v_schema text;
  v_prompt text;
  v_body jsonb;
  v_url text;
  v_http extensions.http_response;
  v_resp jsonb;
  v_text text;
  v_rows jsonb;
  v_insert jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You must be signed in.');
  END IF;

  SELECT
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = v_uid AND ur.role IN ('admin', 'super_admin', 'teacher')
    ),
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = v_uid AND ur.role = 'student'
    )
  INTO v_is_staff, v_is_student;

  IF NOT v_is_staff AND NOT v_is_student THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You are not allowed to generate questions.');
  END IF;

  IF p_subject_id IS NULL OR coalesce(trim(p_subject_name), '') = '' OR p_level IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Subject and level are required.');
  END IF;

  -- Clamp count (students get a smaller cap to protect quota).
  v_count := least(greatest(coalesce(p_count, 10), 1), CASE WHEN v_is_staff THEN 25 ELSE 20 END);

  -- Students always publish immediately; staff choose (default approved bank).
  v_auto_approve := CASE WHEN v_is_staff THEN coalesce(p_auto_approve, true) ELSE true END;

  -- Resolve school scope: staff target platform-wide (NULL); students -> own school.
  IF v_is_staff THEN
    v_school_id := NULL;
  ELSE
    SELECT school_id INTO v_school_id FROM public.profiles WHERE id = v_uid;
  END IF;

  -- Gemini config.
  SELECT * INTO v_cfg FROM public.platform_ai_config WHERE id = 1;
  IF v_cfg IS NULL OR NOT coalesce(v_cfg.ai_enabled, true) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'AI is disabled for this platform.');
  END IF;
  IF coalesce(trim(v_cfg.gemini_api_key), '') = '' THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'AI is not configured yet. The Super Admin must add the Gemini API key in AI Assistant.'
    );
  END IF;

  v_level_label := CASE WHEN p_level = 'bece' THEN 'BECE (JHS)' ELSE 'WASSCE (SHS)' END;

  v_exam_style := CASE WHEN p_level = 'bece' THEN
    'Write in authentic BECE (JHS) examination style used in Ghana. Use clear, age-appropriate language for Junior High School candidates. Reference Ghana Education Service (GES) JHS curriculum objectives. Do NOT mention exam years or past papers.'
  ELSE
    'Write in authentic WASSCE (SHS) examination style used in Ghana. Use formal academic language for Senior High School candidates. Align to the WAEC WASSCE syllabus and GES SHS curriculum. Do NOT mention exam years or past papers.'
  END;

  v_type_instructions := CASE
    WHEN p_question_type = 'structured' THEN
      'Generate ONLY Paper 2 structured/theory questions (no multiple-choice). Set "options" to null. "correct_answer" MUST be the full model answer. "marking_scheme" MUST list mark allocations point-by-point. Set "question_type" to "structured" and "paper_type" to "paper_2".'
    WHEN p_question_type = 'mock' THEN
      'Generate a mixed mock-examination set: mostly objective with some structured items. Objective items need four options and a letter answer; structured items need a model answer and marking_scheme.'
    ELSE
      'Generate ONLY Paper 1 multiple-choice questions. Each question MUST have "options" as exactly four objects: [{"id":"A","text":"..."},{"id":"B","text":"..."},{"id":"C","text":"..."},{"id":"D","text":"..."}]. "correct_answer" MUST be "A","B","C", or "D". Set "question_type" to "objective" and "paper_type" to "paper_1". Distractors must be plausible common mistakes.'
  END;

  v_difficulty_line := CASE
    WHEN coalesce(p_difficulty, 'mixed') = 'mixed'
      THEN 'Difficulty mix: 30% easy, 40% medium, 20% hard, 10% advanced.'
    ELSE 'Difficulty: ' || p_difficulty || '.'
  END;

  v_topic_line := CASE
    WHEN coalesce(trim(p_topic), '') <> ''
      THEN 'Focus topic: ' || p_topic || coalesce(' — ' || nullif(trim(p_sub_topic), ''), '') || '.'
    ELSE 'Cover a proportional spread across the full syllabus for this subject.'
  END;

  v_schema := jsonb_build_object(
    'question_text', 'string',
    'question_type', 'objective | structured',
    'paper_type', 'paper_1 | paper_2',
    'options', '[{id,text}x4] or null',
    'correct_answer', 'string',
    'explanation', 'step-by-step solution',
    'marking_scheme', 'string or null',
    'topic', 'string',
    'sub_topic', 'string',
    'difficulty', 'easy | medium | hard | advanced',
    'learning_objective', 'GES syllabus outcome',
    'estimated_time_seconds', 'integer',
    'keywords', jsonb_build_array('string'),
    'marks', 'integer 1-5'
  )::text;

  v_prompt := concat_ws(
    E'\n',
    format('You are a senior WAEC examiner for Ghana. Generate %s ORIGINAL, high-quality %s questions for %s.',
           v_count, v_level_label, p_subject_name),
    v_exam_style,
    v_topic_line,
    v_difficulty_line,
    v_type_instructions,
    'Every question must be unique, factually correct, unambiguous, and never copied from real past papers.',
    'Use Ghanaian contexts (cedis, local examples, GES terminology) where appropriate.',
    'Return ONLY a JSON array. Each element MUST include these keys:',
    v_schema
  );

  v_body := jsonb_build_object(
    'contents', jsonb_build_array(
      jsonb_build_object('role', 'user', 'parts', jsonb_build_array(jsonb_build_object('text', v_prompt)))
    ),
    'generationConfig', jsonb_build_object(
      'temperature', 0.85,
      'maxOutputTokens', 8192,
      'responseMimeType', 'application/json'
    )
  );

  v_url := 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key='
           || v_cfg.gemini_api_key;

  BEGIN
    PERFORM extensions.http_set_curlopt('CURLOPT_TIMEOUT', '150');
    PERFORM extensions.http_set_curlopt('CURLOPT_CONNECTTIMEOUT', '30');

    SELECT * INTO v_http
    FROM extensions.http((
      'POST',
      v_url,
      ARRAY[extensions.http_header('Content-Type', 'application/json')],
      'application/json',
      v_body::text
    )::extensions.http_request);
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', 'AI request failed: ' || SQLERRM);
  END;

  BEGIN
    v_resp := v_http.content::jsonb;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', coalesce(v_http.content, 'Invalid response from AI'));
  END;

  IF v_http.status < 200 OR v_http.status >= 300 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', coalesce(v_resp #>> '{error,message}', v_http.content, 'AI request failed')
    );
  END IF;

  v_text := (
    SELECT string_agg(part ->> 'text', '')
    FROM jsonb_array_elements(coalesce(v_resp #> '{candidates,0,content,parts}', '[]'::jsonb)) AS part
  );

  IF coalesce(trim(v_text), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'The AI returned an empty response. Try again.');
  END IF;

  -- Strip markdown fences if present, then parse the JSON array.
  v_text := regexp_replace(trim(v_text), '^```(json)?', '', 'i');
  v_text := regexp_replace(v_text, '```$', '');
  v_text := trim(v_text);

  BEGIN
    v_rows := v_text::jsonb;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Could not parse AI output as JSON.');
  END;

  IF jsonb_typeof(v_rows) <> 'array' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'AI did not return a question list. Try again.');
  END IF;

  -- Reuse the existing insert routine (handles dedup, status, staff/student rules).
  v_insert := public.insert_waec_generated_questions(
    p_subject_id,
    v_school_id,
    'gemini-2.5-flash',
    v_rows,
    v_auto_approve
  );

  -- Log usage best-effort.
  BEGIN
    INSERT INTO public.ai_usage_logs (school_id, user_id, module_context, prompt_preview, tokens)
    VALUES (
      v_school_id,
      v_uid,
      'waec-generator',
      format('Generate %s %s (%s) questions', v_count, p_subject_name, p_level),
      coalesce((v_resp #>> '{usageMetadata,totalTokenCount}')::integer, 0)
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  IF NOT coalesce((v_insert ->> 'ok')::boolean, false) THEN
    RETURN v_insert;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'requested', v_count,
    'inserted', coalesce((v_insert ->> 'inserted')::int, 0),
    'skipped', coalesce((v_insert ->> 'skipped')::int, 0),
    'questionIds', coalesce(v_insert -> 'ids', '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.waec_generate_questions(uuid, text, text, text, text, text, text, integer, boolean)
  TO authenticated;

NOTIFY pgrst, 'reload schema';
