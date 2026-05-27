-- =============================================================================
-- Report system setup (run once in Supabase Dashboard -> SQL Editor)
-- Project: https://supabase.com/dashboard/project/xbhhpjtwawfawifhpxbe/sql/new
-- Safe to re-run: uses IF NOT EXISTS / DROP POLICY IF EXISTS throughout.
-- =============================================================================
-- Per-school brand colors (green / black / white defaults)
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS theme_primary TEXT DEFAULT '#16a34a',
  ADD COLUMN IF NOT EXISTS theme_secondary TEXT DEFAULT '#0a0a0a',
  ADD COLUMN IF NOT EXISTS theme_accent TEXT DEFAULT '#ffffff';

COMMENT ON COLUMN public.schools.theme_primary IS 'Brand primary (buttons, active nav) â€” default green';
COMMENT ON COLUMN public.schools.theme_secondary IS 'Brand secondary (sidebar, text) â€” default black';
COMMENT ON COLUMN public.schools.theme_accent IS 'Brand accent (backgrounds, cards) â€” default white';

UPDATE public.schools
SET
  theme_primary = COALESCE(theme_primary, '#16a34a'),
  theme_secondary = COALESCE(theme_secondary, '#0a0a0a'),
  theme_accent = COALESCE(theme_accent, '#ffffff')
WHERE theme_primary IS NULL OR theme_secondary IS NULL OR theme_accent IS NULL;


-- ---------------------------------------------------------------------------

-- Report system (term report cards, academic terms, results, rankings, signatures)
-- Ported from ascend-school-suite, adapted for school-hub RBAC helpers.

-- ---------------------------------------------------------------------------
-- Schema compatibility columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS stamp_url text,
  ADD COLUMN IF NOT EXISTS principal_name text,
  ADD COLUMN IF NOT EXISTS motto text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS phone text;

UPDATE public.schools SET name = COALESCE(name, school_name) WHERE name IS NULL;

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS admission_number text,
  ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

UPDATE public.students s
SET
  profile_id = COALESCE(s.profile_id, s.user_id),
  admission_number = COALESCE(s.admission_number, s.admission_no),
  full_name = COALESCE(s.full_name, p.full_name)
FROM public.profiles p
WHERE p.id = s.user_id AND (s.full_name IS NULL OR s.admission_number IS NULL OR s.profile_id IS NULL);

-- ---------------------------------------------------------------------------
-- Academic terms
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  session text NOT NULL,
  name text NOT NULL,
  start_date date,
  end_date date,
  is_current boolean DEFAULT false,
  term_kind text DEFAULT 'term',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.terms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "school members read terms" ON public.terms;
CREATE POLICY "school members read terms" ON public.terms
  FOR SELECT USING (school_id = public.get_user_school_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "admins manage terms" ON public.terms;
CREATE POLICY "admins manage terms" ON public.terms
  FOR ALL USING (
    public.has_role(auth.uid(), 'admin'::app_role) AND school_id = public.get_user_school_id(auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role) AND school_id = public.get_user_school_id(auth.uid())
  );

-- ---------------------------------------------------------------------------
-- School settings (grading format for report cards)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.school_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE UNIQUE,
  ca_weight numeric(3,2) DEFAULT 0.40,
  exam_weight numeric(3,2) DEFAULT 0.60,
  pass_mark numeric(5,2) DEFAULT 40,
  grading_system text DEFAULT 'letter',
  report_card_footer text,
  auto_remarks boolean DEFAULT true,
  alert_drop_threshold numeric(5,2) DEFAULT 15,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.school_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "school members read settings" ON public.school_settings;
CREATE POLICY "school members read settings" ON public.school_settings
  FOR SELECT USING (school_id = public.get_user_school_id(auth.uid()));

DROP POLICY IF EXISTS "admins manage settings" ON public.school_settings;
CREATE POLICY "admins manage settings" ON public.school_settings
  FOR ALL USING (public.is_school_admin(auth.uid(), school_id))
  WITH CHECK (public.is_school_admin(auth.uid(), school_id));

-- ---------------------------------------------------------------------------
-- Results (CA + exam scores per subject/term)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  term_id uuid NOT NULL REFERENCES public.terms(id) ON DELETE CASCADE,
  ca_score numeric(5,2) DEFAULT 0,
  exam_score numeric(5,2) DEFAULT 0,
  total numeric(5,2) GENERATED ALWAYS AS (COALESCE(ca_score, 0) + COALESCE(exam_score, 0)) STORED,
  grade text,
  position integer,
  remark text,
  teacher_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  submitted boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, subject_id, term_id)
);

ALTER TABLE public.results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "school read results" ON public.results;
CREATE POLICY "school read results" ON public.results
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = student_id AND s.school_id = public.get_user_school_id(auth.uid())
    )
  );

DROP POLICY IF EXISTS "staff manage results" ON public.results;
CREATE POLICY "staff manage results" ON public.results
  FOR ALL USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR teacher_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.students st
      JOIN public.class_subjects cs ON cs.class_id = st.class_id
      WHERE st.id = student_id AND cs.teacher_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Parent-student compatibility view (maps parent_student_links â†’ parent_students)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.parent_students AS
SELECT
  psl.id,
  p.user_id AS parent_id,
  psl.student_id,
  NULL::text AS relationship
FROM public.parent_student_links psl
JOIN public.parents p ON p.id = psl.parent_id;

GRANT SELECT ON public.parent_students TO authenticated;

-- ---------------------------------------------------------------------------
-- Term report cards
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.report_card_status AS ENUM ('draft', 'saved', 'published');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN ALTER TYPE public.report_card_status ADD VALUE IF NOT EXISTS 'pending_review'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE public.report_card_status ADD VALUE IF NOT EXISTS 'reviewed'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE public.report_card_status ADD VALUE IF NOT EXISTS 'approved'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE public.report_card_status ADD VALUE IF NOT EXISTS 'rejected'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.term_report_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  term_id uuid REFERENCES public.terms(id) ON DELETE SET NULL,
  class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  teacher_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status public.report_card_status NOT NULL DEFAULT 'draft',
  student_name text NOT NULL,
  class_name text,
  roll_number integer,
  class_position text,
  class_student_total_manual integer,
  term_label text,
  academic_year text,
  attendance_made text,
  attendance_total text,
  conduct text,
  interest text,
  club text,
  attitude text,
  teacher_remark text,
  school_closes text,
  reopening_date text,
  next_term text,
  teacher_sign_date text,
  head_sign_date text,
  parent_sign_date text,
  admin_comment text,
  rejection_reason text,
  subjects jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_score numeric(8,2),
  version integer NOT NULL DEFAULT 1,
  saved_at timestamptz,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  approved_at timestamptz,
  published_at timestamptz,
  published_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  sent_to_parents_at timestamptz,
  sent_to_parents_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, term_id)
);

CREATE INDEX IF NOT EXISTS term_report_cards_school_idx ON public.term_report_cards (school_id, status);
CREATE INDEX IF NOT EXISTS idx_term_report_cards_term_class ON public.term_report_cards (school_id, term_id, class_id);

ALTER TABLE public.term_report_cards ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.teacher_teaches_class(p_teacher_id uuid, p_class_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.class_subjects cs
    WHERE cs.teacher_id = p_teacher_id AND cs.class_id = p_class_id
  );
$$;

CREATE OR REPLACE FUNCTION public.teacher_can_access_student_report(
  p_teacher_id uuid, p_student_id uuid, p_class_id uuid
)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.students s
    INNER JOIN public.class_subjects cs ON cs.class_id = s.class_id
    WHERE s.id = p_student_id AND cs.teacher_id = p_teacher_id
      AND (p_class_id IS NULL OR s.class_id = p_class_id)
  );
$$;

DROP POLICY IF EXISTS "school read term reports" ON public.term_report_cards;
CREATE POLICY "school read term reports" ON public.term_report_cards FOR SELECT USING (
  school_id = public.get_user_school_id(auth.uid())
  OR EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.profile_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.parent_students ps WHERE ps.student_id = term_report_cards.student_id AND ps.parent_id = auth.uid())
);

DROP POLICY IF EXISTS "teachers manage assigned class reports" ON public.term_report_cards;
CREATE POLICY "teachers manage assigned class reports" ON public.term_report_cards FOR ALL USING (
  public.is_school_admin(auth.uid(), school_id)
  OR (teacher_id = auth.uid() AND public.teacher_can_access_student_report(auth.uid(), student_id, class_id))
) WITH CHECK (
  public.is_school_admin(auth.uid(), school_id)
  OR (teacher_id = auth.uid() AND public.teacher_can_access_student_report(auth.uid(), student_id, class_id))
);

DROP POLICY IF EXISTS "students read published reports" ON public.term_report_cards;
CREATE POLICY "students read published reports" ON public.term_report_cards FOR SELECT USING (
  status IN ('published', 'approved')
  AND EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.profile_id = auth.uid())
);

DROP POLICY IF EXISTS "parents read published reports" ON public.term_report_cards;
CREATE POLICY "parents read published reports" ON public.term_report_cards FOR SELECT USING (
  status IN ('published', 'approved')
  AND EXISTS (SELECT 1 FROM public.parent_students ps WHERE ps.student_id = term_report_cards.student_id AND ps.parent_id = auth.uid())
);

-- Version history
CREATE TABLE IF NOT EXISTS public.term_report_card_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.term_report_cards(id) ON DELETE CASCADE,
  version integer NOT NULL,
  status public.report_card_status NOT NULL,
  form_snapshot jsonb NOT NULL,
  changed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  change_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS term_report_versions_report_idx ON public.term_report_card_versions (report_id, version DESC);
ALTER TABLE public.term_report_card_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff read report versions" ON public.term_report_card_versions;
CREATE POLICY "staff read report versions" ON public.term_report_card_versions FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.term_report_cards t
    WHERE t.id = report_id AND (
      t.school_id = public.get_user_school_id(auth.uid())
      OR t.teacher_id = auth.uid()
      OR public.is_school_admin(auth.uid(), t.school_id)
    )
  )
);

DROP POLICY IF EXISTS "staff insert report versions" ON public.term_report_card_versions;
CREATE POLICY "staff insert report versions" ON public.term_report_card_versions FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.term_report_cards t
    WHERE t.id = report_id AND (t.teacher_id = auth.uid() OR public.is_school_admin(auth.uid(), t.school_id))
  )
);

-- User signatures
CREATE TABLE IF NOT EXISTS public.user_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  role_kind text NOT NULL CHECK (role_kind IN ('teacher', 'school_admin', 'admin')),
  label text NOT NULL DEFAULT 'Default',
  image_url text NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_signatures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users insert own signatures" ON public.user_signatures;
CREATE POLICY "users insert own signatures" ON public.user_signatures FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND school_id = public.get_user_school_id(auth.uid()));

DROP POLICY IF EXISTS "users update own signatures" ON public.user_signatures;
CREATE POLICY "users update own signatures" ON public.user_signatures FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "users delete own signatures" ON public.user_signatures;
CREATE POLICY "users delete own signatures" ON public.user_signatures FOR DELETE TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "school members read signatures" ON public.user_signatures;
CREATE POLICY "school members read signatures" ON public.user_signatures FOR SELECT USING (
  user_id = auth.uid() OR school_id = public.get_user_school_id(auth.uid())
);

-- Set current term RPC
CREATE OR REPLACE FUNCTION public.set_school_current_term(p_term_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_school uuid;
BEGIN
  SELECT school_id INTO v_school FROM public.terms WHERE id = p_term_id;
  IF v_school IS NULL THEN RAISE EXCEPTION 'Term not found'; END IF;
  IF NOT public.is_school_admin(auth.uid(), v_school) THEN
    RAISE EXCEPTION 'Only school admins can set the active term';
  END IF;
  UPDATE public.terms SET is_current = false WHERE school_id = v_school;
  UPDATE public.terms SET is_current = true WHERE id = p_term_id;
END;
$$;

-- Ranking RPC (simplified â€” full ranking from ascend)
CREATE OR REPLACE FUNCTION public.result_ranking_score(p_ca numeric, p_exam numeric)
RETURNS numeric LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path TO 'public' AS $$
  SELECT ROUND((COALESCE(p_ca, 0) + COALESCE(p_exam, 0))::numeric, 4);
$$;

CREATE OR REPLACE FUNCTION public.recalculate_class_rankings(p_class_id uuid, p_term_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_school uuid;
  v_subject_updates int := 0;
  v_class_positions int := 0;
  v_reports_updated int := 0;
  v_reports_created int := 0;
  v_subject record;
  v_st record;
  v_rank int; v_prev numeric; v_idx int; v_score numeric;
  v_class_ranks jsonb := '{}'::jsonb;
  v_class_totals jsonb := '{}'::jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT school_id INTO v_school FROM public.classes WHERE id = p_class_id;
  IF v_school IS NULL THEN RAISE EXCEPTION 'Class not found'; END IF;
  IF NOT (
    public.is_school_admin(v_uid, v_school)
    OR EXISTS (SELECT 1 FROM public.class_subjects cs WHERE cs.class_id = p_class_id AND cs.teacher_id = v_uid)
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  FOR v_subject IN
    SELECT DISTINCT cs.subject_id FROM public.class_subjects cs WHERE cs.class_id = p_class_id
  LOOP
    WITH ranked AS (
      SELECT r.student_id,
        public.result_ranking_score(r.ca_score, r.exam_score) AS score,
        DENSE_RANK() OVER (ORDER BY public.result_ranking_score(r.ca_score, r.exam_score) DESC) AS rk
      FROM public.results r
      JOIN public.students s ON s.id = r.student_id
      WHERE s.class_id = p_class_id AND r.term_id = p_term_id AND r.subject_id = v_subject.subject_id
        AND public.result_ranking_score(r.ca_score, r.exam_score) > 0
    )
    UPDATE public.results r SET position = ranked.rk
    FROM ranked WHERE r.student_id = ranked.student_id AND r.term_id = p_term_id AND r.subject_id = v_subject.subject_id;
    GET DIAGNOSTICS v_subject_updates = v_subject_updates + ROW_COUNT;
  END LOOP;

  FOR v_st IN
    SELECT s.id AS student_id, COALESCE(SUM(r.total), 0) AS agg
    FROM public.students s
    LEFT JOIN public.results r ON r.student_id = s.id AND r.term_id = p_term_id
    WHERE s.class_id = p_class_id
    GROUP BY s.id
  LOOP
    v_class_totals := v_class_totals || jsonb_build_object(v_st.student_id::text, v_st.agg);
  END LOOP;

  WITH ordered AS (
    SELECT key AS student_id, (value::text)::numeric AS total,
      DENSE_RANK() OVER (ORDER BY (value::text)::numeric DESC) AS rk
    FROM jsonb_each(v_class_totals)
    WHERE (value::text)::numeric > 0
  )
  SELECT jsonb_object_agg(student_id, rk) INTO v_class_ranks FROM ordered;

  FOR v_st IN SELECT id FROM public.students WHERE class_id = p_class_id LOOP
    INSERT INTO public.term_report_cards (school_id, student_id, term_id, class_id, teacher_id, status, student_name, class_name, class_position, subjects)
    SELECT v_school, v_st.id, p_term_id, p_class_id, v_uid, 'draft',
      COALESCE(s.full_name, 'Student'), c.name,
      COALESCE(v_class_ranks->>v_st.id::text, ''),
      '[]'::jsonb
    FROM public.students s
    JOIN public.classes c ON c.id = s.class_id
    WHERE s.id = v_st.id
    ON CONFLICT (student_id, term_id) DO UPDATE SET
      class_position = EXCLUDED.class_position,
      updated_at = now();
    IF FOUND THEN v_reports_updated := v_reports_updated + 1; END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'subjectUpdates', v_subject_updates,
    'classPositions', COALESCE(jsonb_object_length(v_class_ranks), 0),
    'reportCardsUpdated', v_reports_updated,
    'reportCardsCreated', v_reports_created,
    'eligibleStudents', (SELECT COUNT(*) FROM public.students WHERE class_id = p_class_id)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.recalculate_class_rankings(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_school_current_term(uuid) TO authenticated;


-- ---------------------------------------------------------------------------

-- Report settings: storage bucket for signatures/stamps + school_settings extras

INSERT INTO storage.buckets (id, name, public)
VALUES ('school-assets', 'school-assets', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "public read school assets" ON storage.objects;
CREATE POLICY "public read school assets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'school-assets');

DROP POLICY IF EXISTS "school members upload assets" ON storage.objects;
CREATE POLICY "school members upload assets"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'school-assets'
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'super_admin'::app_role)
      OR public.has_role(auth.uid(), 'teacher'::app_role)
      OR name LIKE ('%' || auth.uid()::text || '%')
    )
  );

DROP POLICY IF EXISTS "school members update own assets" ON storage.objects;
CREATE POLICY "school members update own assets"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'school-assets'
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR name LIKE ('%' || auth.uid()::text || '%')
    )
  );

DROP POLICY IF EXISTS "school members delete own assets" ON storage.objects;
CREATE POLICY "school members delete own assets"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'school-assets'
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR name LIKE ('%' || auth.uid()::text || '%')
    )
  );

ALTER TABLE public.school_settings
  ADD COLUMN IF NOT EXISTS allow_multiple_parents_per_student boolean DEFAULT true;

