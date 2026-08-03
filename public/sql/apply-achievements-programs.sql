-- Academics: Achievements + Academic Programs
-- Soft archive via is_archived; audit via created_by / updated_by / timestamps

-- ---------------------------------------------------------------------------
-- Achievement categories
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.achievement_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  color text,
  is_archived boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, name)
);

CREATE INDEX IF NOT EXISTS idx_achievement_categories_school
  ON public.achievement_categories(school_id);

-- ---------------------------------------------------------------------------
-- Achievements
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.achievement_categories(id) ON DELETE SET NULL,
  title text NOT NULL,
  achievement_type text NOT NULL DEFAULT 'award'
    CHECK (achievement_type IN (
      'award', 'honor', 'certificate', 'competition',
      'recommendation', 'recognition', 'other'
    )),
  description text,
  awarded_by text,
  awarded_on date NOT NULL DEFAULT CURRENT_DATE,
  academic_year text,
  term_label text,
  level text,
  venue text,
  image_url text,
  document_url text,
  recommendation_letter text,
  notes text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'active', 'inactive', 'archived')),
  is_published boolean NOT NULL DEFAULT false,
  is_archived boolean NOT NULL DEFAULT false,
  approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at timestamptz,
  rejection_reason text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  deleted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_achievements_school ON public.achievements(school_id);
CREATE INDEX IF NOT EXISTS idx_achievements_student ON public.achievements(student_id);
CREATE INDEX IF NOT EXISTS idx_achievements_status ON public.achievements(school_id, status);
CREATE INDEX IF NOT EXISTS idx_achievements_type ON public.achievements(school_id, achievement_type);

-- ---------------------------------------------------------------------------
-- Achievement activity / notes timeline
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.achievement_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  achievement_id uuid NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  note text NOT NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_achievement_notes_achievement
  ON public.achievement_notes(achievement_id);

-- ---------------------------------------------------------------------------
-- Academic programs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.academic_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text NOT NULL,
  department text,
  faculty text,
  description text,
  duration_years numeric(4,1),
  credits integer,
  level text,
  semester_structure text,
  coordinator_name text,
  coordinator_teacher_id uuid REFERENCES public.teachers(id) ON DELETE SET NULL,
  subjects text[],
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'archived')),
  is_archived boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  deleted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, code)
);

CREATE INDEX IF NOT EXISTS idx_academic_programs_school ON public.academic_programs(school_id);
CREATE INDEX IF NOT EXISTS idx_academic_programs_status ON public.academic_programs(school_id, status);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.achievement_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievement_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_programs ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'achievement_categories',
    'achievements',
    'achievement_notes',
    'academic_programs'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_school_rw ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_school_rw ON public.%I FOR ALL USING (
        school_id = public.get_user_school_id(auth.uid())
        OR public.has_role(auth.uid(), ''super_admin''::app_role)
      ) WITH CHECK (
        school_id = public.get_user_school_id(auth.uid())
        OR public.has_role(auth.uid(), ''super_admin''::app_role)
      )',
      t, t
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Dashboard RPC
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_achievements_dashboard_stats(p_school_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  result jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT (
    public.has_role(v_uid, 'super_admin'::app_role)
    OR public.get_user_school_id(v_uid) = p_school_id
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT jsonb_build_object(
    'total', COUNT(*) FILTER (WHERE NOT is_archived),
    'published', COUNT(*) FILTER (WHERE is_published AND NOT is_archived),
    'pending', COUNT(*) FILTER (WHERE status = 'pending' AND NOT is_archived),
    'approved', COUNT(*) FILTER (WHERE status IN ('approved', 'active') AND NOT is_archived),
    'awards', COUNT(*) FILTER (WHERE achievement_type = 'award' AND NOT is_archived),
    'certificates', COUNT(*) FILTER (WHERE achievement_type = 'certificate' AND NOT is_archived),
    'competitions', COUNT(*) FILTER (WHERE achievement_type = 'competition' AND NOT is_archived),
    'archived', COUNT(*) FILTER (WHERE is_archived)
  )
  INTO result
  FROM public.achievements
  WHERE school_id = p_school_id;

  RETURN COALESCE(result, '{}'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_achievements_dashboard_stats(uuid) TO authenticated;
