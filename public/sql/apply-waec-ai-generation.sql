-- AI Question Generation Engine for the WAEC platform.
-- Adds rich metadata + an approval workflow to waec_questions, plus a
-- SECURITY DEFINER insert RPC used by the waec-ai-generate edge function.
-- Run in Supabase SQL Editor. Safe to re-run.

-- 1) Rich metadata + approval/status columns (backward compatible).
ALTER TABLE public.waec_questions
  ADD COLUMN IF NOT EXISTS question_type text NOT NULL DEFAULT 'objective',
  ADD COLUMN IF NOT EXISTS sub_topic text,
  ADD COLUMN IF NOT EXISTS learning_objective text,
  ADD COLUMN IF NOT EXISTS estimated_time_seconds integer,
  ADD COLUMN IF NOT EXISTS keywords text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS generated_by text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS ai_model text,
  ADD COLUMN IF NOT EXISTS content_hash text;

-- question_type: 'objective' | 'structured' | 'mock'
-- status:        'draft' | 'approved' | 'rejected'
-- generated_by:  'manual' | 'ai'

-- Existing rows are treated as already-approved manual content.
UPDATE public.waec_questions
SET status = 'approved'
WHERE status IS NULL;

-- Dedup guard: same subject + normalized question text cannot repeat.
CREATE UNIQUE INDEX IF NOT EXISTS waec_questions_subject_hash_uidx
  ON public.waec_questions (subject_id, content_hash)
  WHERE content_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS waec_questions_status_idx
  ON public.waec_questions (status, subject_id);

-- 2) Normalized hash helper for dedup (lowercase, collapse whitespace).
CREATE OR REPLACE FUNCTION public.waec_question_hash(p_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT md5(regexp_replace(lower(coalesce(trim(p_text), '')), '\s+', ' ', 'g'));
$$;

-- 3) Bulk insert of AI-generated questions (draft, pending approval).
--    Returns how many were inserted vs skipped as duplicates.
CREATE OR REPLACE FUNCTION public.insert_waec_generated_questions(
  p_subject_id uuid,
  p_school_id uuid,
  p_year integer,
  p_ai_model text,
  p_rows jsonb
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
        coalesce((v_row->>'year')::int, p_year),
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
        false,          -- inactive until approved
        'draft',
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

GRANT EXECUTE ON FUNCTION public.insert_waec_generated_questions(uuid, uuid, integer, text, jsonb)
  TO authenticated, service_role;

-- 4) Approve / reject a generated question.
CREATE OR REPLACE FUNCTION public.set_waec_question_status(
  p_question_id uuid,
  p_status text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_staff boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = v_uid
      AND ur.role IN ('admin', 'super_admin', 'teacher')
  ) INTO v_is_staff;

  IF NOT v_is_staff THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Only staff can review questions.');
  END IF;

  IF p_status NOT IN ('approved', 'rejected', 'draft') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid status.');
  END IF;

  UPDATE public.waec_questions
  SET status = p_status,
      is_active = (p_status = 'approved'),
      updated_at = now()
  WHERE id = p_question_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_waec_question_status(uuid, text) TO authenticated;

-- 5) Bulk approve all drafts for a subject (optional convenience).
CREATE OR REPLACE FUNCTION public.approve_waec_drafts_for_subject(p_subject_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_staff boolean;
  v_count integer;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = v_uid
      AND ur.role IN ('admin', 'super_admin', 'teacher')
  ) INTO v_is_staff;

  IF NOT v_is_staff THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Only staff can review questions.');
  END IF;

  UPDATE public.waec_questions
  SET status = 'approved', is_active = true, updated_at = now()
  WHERE subject_id = p_subject_id AND status = 'draft';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'approved', v_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_waec_drafts_for_subject(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
