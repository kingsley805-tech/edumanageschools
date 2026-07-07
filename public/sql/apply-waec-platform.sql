-- WAEC BECE & WASSCE Past Questions Platform
-- Run in Supabase SQL editor, then: NOTIFY pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- Subjects catalogue (BECE + WASSCE)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.waec_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level text NOT NULL CHECK (level IN ('bece', 'wassce')),
  name text NOT NULL,
  category text,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (level, name)
);

CREATE INDEX IF NOT EXISTS idx_waec_subjects_level ON public.waec_subjects(level, sort_order);

-- ---------------------------------------------------------------------------
-- Question bank
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.waec_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.waec_subjects(id) ON DELETE CASCADE,
  year int NOT NULL,
  paper_type text NOT NULL DEFAULT 'paper_1' CHECK (paper_type IN ('paper_1', 'paper_2', 'paper_3')),
  topic text,
  difficulty text NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  question_text text NOT NULL,
  options jsonb,
  correct_answer text NOT NULL,
  explanation text,
  marking_scheme text,
  marks numeric(6,2) NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_waec_questions_subject ON public.waec_questions(subject_id, year, paper_type);
CREATE INDEX IF NOT EXISTS idx_waec_questions_school ON public.waec_questions(school_id);

-- ---------------------------------------------------------------------------
-- Practice / examination sessions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.waec_practice_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id uuid REFERENCES public.students(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.waec_subjects(id) ON DELETE RESTRICT,
  level text NOT NULL CHECK (level IN ('bece', 'wassce')),
  mode text NOT NULL DEFAULT 'practice' CHECK (mode IN ('practice', 'exam')),
  year_filter int,
  paper_type text NOT NULL DEFAULT 'paper_1',
  topic_filter text,
  question_count int NOT NULL DEFAULT 10,
  duration_minutes int,
  score numeric(8,2) NOT NULL DEFAULT 0,
  max_score numeric(8,2) NOT NULL DEFAULT 0,
  percentage numeric(5,2) NOT NULL DEFAULT 0,
  grade text,
  correct_count int NOT NULL DEFAULT 0,
  wrong_count int NOT NULL DEFAULT 0,
  unanswered_count int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'submitted', 'abandoned')),
  question_ids uuid[] NOT NULL DEFAULT '{}',
  started_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_waec_sessions_user ON public.waec_practice_sessions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_waec_sessions_school ON public.waec_practice_sessions(school_id);

-- ---------------------------------------------------------------------------
-- Session answers
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.waec_session_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.waec_practice_sessions(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.waec_questions(id) ON DELETE CASCADE,
  selected_answer text,
  is_correct boolean,
  marks_awarded numeric(6,2) NOT NULL DEFAULT 0,
  answered_at timestamptz,
  UNIQUE (session_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_waec_answers_session ON public.waec_session_answers(session_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.waec_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waec_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waec_practice_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waec_session_answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS waec_subjects_read ON public.waec_subjects;
CREATE POLICY waec_subjects_read ON public.waec_subjects FOR SELECT
  USING (true);

DROP POLICY IF EXISTS waec_questions_read ON public.waec_questions;
CREATE POLICY waec_questions_read ON public.waec_questions FOR SELECT
  USING (
    is_active = true
    AND (school_id IS NULL OR school_id = public.get_user_school_id(auth.uid()))
  );

DROP POLICY IF EXISTS waec_questions_manage ON public.waec_questions;
CREATE POLICY waec_questions_manage ON public.waec_questions FOR ALL
  USING (
    public.is_platform_super_admin()
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'teacher'::app_role)
  )
  WITH CHECK (
    public.is_platform_super_admin()
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'teacher'::app_role)
  );

DROP POLICY IF EXISTS waec_sessions_own ON public.waec_practice_sessions;
CREATE POLICY waec_sessions_own ON public.waec_practice_sessions FOR ALL
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS waec_answers_own ON public.waec_session_answers;
CREATE POLICY waec_answers_own ON public.waec_session_answers FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.waec_practice_sessions s
      WHERE s.id = session_id AND (s.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.waec_practice_sessions s
      WHERE s.id = session_id AND s.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.waec_grade_from_percentage(p_pct numeric)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_pct >= 80 THEN 'A1'
    WHEN p_pct >= 70 THEN 'B2'
    WHEN p_pct >= 60 THEN 'B3'
    WHEN p_pct >= 55 THEN 'C4'
    WHEN p_pct >= 50 THEN 'C5'
    WHEN p_pct >= 45 THEN 'C6'
    WHEN p_pct >= 40 THEN 'D7'
    WHEN p_pct >= 35 THEN 'E8'
    ELSE 'F9'
  END;
$$;

CREATE OR REPLACE FUNCTION public.get_waec_student_dashboard(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total int;
  v_avg numeric;
  v_best text;
  v_weak text;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id
     AND NOT public.has_role(auth.uid(), 'admin'::app_role)
     AND NOT public.is_platform_super_admin() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT COUNT(*)::int, coalesce(avg(percentage), 0)
  INTO v_total, v_avg
  FROM public.waec_practice_sessions
  WHERE user_id = p_user_id AND status = 'submitted';

  SELECT ws.name INTO v_best
  FROM public.waec_practice_sessions s
  JOIN public.waec_subjects ws ON ws.id = s.subject_id
  WHERE s.user_id = p_user_id AND s.status = 'submitted'
  GROUP BY ws.name
  ORDER BY avg(s.percentage) DESC
  LIMIT 1;

  SELECT ws.name INTO v_weak
  FROM public.waec_practice_sessions s
  JOIN public.waec_subjects ws ON ws.id = s.subject_id
  WHERE s.user_id = p_user_id AND s.status = 'submitted'
  GROUP BY ws.name
  ORDER BY avg(s.percentage) ASC
  LIMIT 1;

  RETURN jsonb_build_object(
    'total_attempts', coalesce(v_total, 0),
    'average_score', round(coalesce(v_avg, 0), 1),
    'best_subject', v_best,
    'weak_subject', v_weak,
    'questions_solved', (
      SELECT coalesce(sum(correct_count + wrong_count), 0)::int
      FROM public.waec_practice_sessions
      WHERE user_id = p_user_id AND status = 'submitted'
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_waec_session(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.waec_practice_sessions%ROWTYPE;
  v_correct int := 0;
  v_wrong int := 0;
  v_unanswered int := 0;
  v_score numeric := 0;
  v_max numeric := 0;
  v_pct numeric;
  v_grade text;
  r record;
BEGIN
  SELECT * INTO v_session FROM public.waec_practice_sessions WHERE id = p_session_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Session not found');
  END IF;
  IF v_session.user_id != auth.uid() AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Forbidden');
  END IF;
  IF v_session.status = 'submitted' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Already submitted');
  END IF;

  FOR r IN
    SELECT a.id, a.selected_answer, q.correct_answer, q.marks
    FROM public.waec_session_answers a
    JOIN public.waec_questions q ON q.id = a.question_id
    WHERE a.session_id = p_session_id
  LOOP
    v_max := v_max + r.marks;
    IF r.selected_answer IS NULL OR trim(r.selected_answer) = '' THEN
      v_unanswered := v_unanswered + 1;
      UPDATE public.waec_session_answers SET is_correct = false, marks_awarded = 0 WHERE id = r.id;
    ELSIF upper(trim(r.selected_answer)) = upper(trim(r.correct_answer)) THEN
      v_correct := v_correct + 1;
      v_score := v_score + r.marks;
      UPDATE public.waec_session_answers SET is_correct = true, marks_awarded = r.marks WHERE id = r.id;
    ELSE
      v_wrong := v_wrong + 1;
      UPDATE public.waec_session_answers SET is_correct = false, marks_awarded = 0 WHERE id = r.id;
    END IF;
  END LOOP;

  v_pct := CASE WHEN v_max > 0 THEN round((v_score / v_max) * 100, 1) ELSE 0 END;
  v_grade := public.waec_grade_from_percentage(v_pct);

  UPDATE public.waec_practice_sessions
  SET
    status = 'submitted',
    score = v_score,
    max_score = v_max,
    percentage = v_pct,
    grade = v_grade,
    correct_count = v_correct,
    wrong_count = v_wrong,
    unanswered_count = v_unanswered,
    submitted_at = now()
  WHERE id = p_session_id;

  RETURN jsonb_build_object(
    'ok', true,
    'score', v_score,
    'max_score', v_max,
    'percentage', v_pct,
    'grade', v_grade,
    'correct_count', v_correct,
    'wrong_count', v_wrong,
    'unanswered_count', v_unanswered
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_waec_student_dashboard(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_waec_session(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Seed subjects (idempotent)
-- ---------------------------------------------------------------------------
INSERT INTO public.waec_subjects (level, name, category, sort_order) VALUES
  ('bece', 'Mathematics', 'Core', 1),
  ('bece', 'English Language', 'Core', 2),
  ('bece', 'Integrated Science', 'Core', 3),
  ('bece', 'Social Studies', 'Core', 4),
  ('bece', 'Religious and Moral Education', 'Elective', 5),
  ('bece', 'ICT', 'Elective', 6),
  ('bece', 'Basic Design and Technology', 'Elective', 7),
  ('bece', 'French', 'Elective', 8),
  ('bece', 'Ghanaian Language', 'Elective', 9),
  ('bece', 'Creative Arts', 'Elective', 10),
  ('bece', 'Career Technology', 'Elective', 11),
  ('wassce', 'English Language', 'Core', 1),
  ('wassce', 'Core Mathematics', 'Core', 2),
  ('wassce', 'Integrated Science', 'Core', 3),
  ('wassce', 'Social Studies', 'Core', 4),
  ('wassce', 'Literature in English', 'General Arts', 10),
  ('wassce', 'Government', 'General Arts', 11),
  ('wassce', 'History', 'General Arts', 12),
  ('wassce', 'Geography', 'General Arts', 13),
  ('wassce', 'Economics', 'General Arts', 14),
  ('wassce', 'Christian Religious Studies', 'General Arts', 15),
  ('wassce', 'Islamic Religious Studies', 'General Arts', 16),
  ('wassce', 'Biology', 'General Science', 20),
  ('wassce', 'Chemistry', 'General Science', 21),
  ('wassce', 'Physics', 'General Science', 22),
  ('wassce', 'Elective Mathematics', 'General Science', 23),
  ('wassce', 'ICT', 'General Science', 24),
  ('wassce', 'Accounting', 'Business', 30),
  ('wassce', 'Business Management', 'Business', 31),
  ('wassce', 'Cost Accounting', 'Business', 32),
  ('wassce', 'General Agriculture', 'Agriculture', 40),
  ('wassce', 'Crop Husbandry', 'Agriculture', 41),
  ('wassce', 'Animal Husbandry', 'Agriculture', 42),
  ('wassce', 'Fisheries', 'Agriculture', 43),
  ('wassce', 'Graphic Design', 'Visual Arts', 50),
  ('wassce', 'Ceramics', 'Visual Arts', 51),
  ('wassce', 'Textiles', 'Visual Arts', 52),
  ('wassce', 'Sculpture', 'Visual Arts', 53),
  ('wassce', 'Picture Making', 'Visual Arts', 54),
  ('wassce', 'Technical Drawing', 'Technical', 60),
  ('wassce', 'Building Construction', 'Technical', 61),
  ('wassce', 'Electronics', 'Technical', 62),
  ('wassce', 'Metalwork', 'Technical', 63),
  ('wassce', 'Woodwork', 'Technical', 64)
ON CONFLICT (level, name) DO NOTHING;

-- Sample questions for demo (Mathematics BECE + WASSCE Core Math)
DO $$
DECLARE
  v_bece_math uuid;
  v_wassce_math uuid;
BEGIN
  SELECT id INTO v_bece_math FROM public.waec_subjects WHERE level = 'bece' AND name = 'Mathematics' LIMIT 1;
  SELECT id INTO v_wassce_math FROM public.waec_subjects WHERE level = 'wassce' AND name = 'Core Mathematics' LIMIT 1;

  IF v_bece_math IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.waec_questions WHERE subject_id = v_bece_math AND year = 2020 LIMIT 1) THEN
    INSERT INTO public.waec_questions (subject_id, year, paper_type, topic, difficulty, question_text, options, correct_answer, explanation) VALUES
      (v_bece_math, 2020, 'paper_1', 'Arithmetic', 'easy', 'What is the value of 5 × 8?',
        '[{"id":"A","text":"20"},{"id":"B","text":"30"},{"id":"C","text":"40"},{"id":"D","text":"50"}]'::jsonb,
        'C', '5 multiplied by 8 gives 40.'),
      (v_bece_math, 2020, 'paper_1', 'Fractions', 'medium', 'Express 3/4 as a decimal.',
        '[{"id":"A","text":"0.25"},{"id":"B","text":"0.5"},{"id":"C","text":"0.75"},{"id":"D","text":"1.25"}]'::jsonb,
        'C', '3 ÷ 4 = 0.75'),
      (v_bece_math, 2019, 'paper_1', 'Algebra', 'medium', 'If x + 5 = 12, find x.',
        '[{"id":"A","text":"5"},{"id":"B","text":"7"},{"id":"C","text":"12"},{"id":"D","text":"17"}]'::jsonb,
        'B', 'x = 12 − 5 = 7'),
      (v_bece_math, 2018, 'paper_1', 'Geometry', 'hard', 'The sum of angles in a triangle is?',
        '[{"id":"A","text":"90°"},{"id":"B","text":"180°"},{"id":"C","text":"270°"},{"id":"D","text":"360°"}]'::jsonb,
        'B', 'Interior angles of a triangle always sum to 180°.');
  END IF;

  IF v_wassce_math IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.waec_questions WHERE subject_id = v_wassce_math AND year = 2018 LIMIT 1) THEN
    INSERT INTO public.waec_questions (subject_id, year, paper_type, topic, difficulty, question_text, options, correct_answer, explanation) VALUES
      (v_wassce_math, 2018, 'paper_1', 'Indices', 'medium', 'Evaluate 2³ × 2²',
        '[{"id":"A","text":"2⁵"},{"id":"B","text":"2⁶"},{"id":"C","text":"4⁵"},{"id":"D","text":"4⁶"}]'::jsonb,
        'A', 'When multiplying powers with the same base, add the indices: 2³⁺² = 2⁵'),
      (v_wassce_math, 2018, 'paper_1', 'Quadratic Equations', 'hard', 'Solve x² − 5x + 6 = 0',
        '[{"id":"A","text":"x = 2, 3"},{"id":"B","text":"x = −2, −3"},{"id":"C","text":"x = 1, 6"},{"id":"D","text":"x = −1, 6"}]'::jsonb,
        'A', 'Factorising: (x−2)(x−3)=0, so x=2 or x=3'),
      (v_wassce_math, 2020, 'paper_1', 'Statistics', 'easy', 'The middle value in an ordered data set is called the?',
        '[{"id":"A","text":"Mean"},{"id":"B","text":"Median"},{"id":"C","text":"Mode"},{"id":"D","text":"Range"}]'::jsonb,
        'B', 'The median is the middle value when data is arranged in order.');
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
