-- School Timetable Management System (multi-tenant)
-- Run in Supabase SQL Editor. Extends existing `schedules` table.

-- ---------------------------------------------------------------------------
-- Timetable settings (bell schedule per school)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.timetable_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE UNIQUE,
  school_open_time time NOT NULL DEFAULT '08:00',
  school_close_time time NOT NULL DEFAULT '15:00',
  period_duration_minutes integer NOT NULL DEFAULT 40 CHECK (period_duration_minutes BETWEEN 20 AND 120),
  break_duration_minutes integer NOT NULL DEFAULT 20 CHECK (break_duration_minutes BETWEEN 5 AND 60),
  lunch_duration_minutes integer NOT NULL DEFAULT 40 CHECK (lunch_duration_minutes BETWEEN 15 AND 90),
  periods_per_day integer NOT NULL DEFAULT 8 CHECK (periods_per_day BETWEEN 4 AND 12),
  include_saturday boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Period slots (period / break / lunch)
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.timetable_period_type AS ENUM ('period', 'break', 'lunch');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.timetable_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  period_type public.timetable_period_type NOT NULL DEFAULT 'period',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT timetable_period_valid_range CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_timetable_periods_school ON public.timetable_periods(school_id, sort_order);

-- ---------------------------------------------------------------------------
-- Subject weekly allocation (frequency targets)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subject_weekly_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  teacher_id uuid REFERENCES public.teachers(id) ON DELETE SET NULL,
  periods_per_week integer NOT NULL DEFAULT 1 CHECK (periods_per_week BETWEEN 1 AND 15),
  allows_double_period boolean NOT NULL DEFAULT false,
  term_id uuid REFERENCES public.terms(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_id, subject_id, term_id)
);

-- ---------------------------------------------------------------------------
-- Extend schedules (class timetable entries)
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.timetable_entry_status AS ENUM ('draft', 'published');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.schedules
  ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS term_id uuid REFERENCES public.terms(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS academic_year_id uuid REFERENCES public.academic_years(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS period_id uuid REFERENCES public.timetable_periods(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status public.timetable_entry_status NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Backfill school_id from classes
UPDATE public.schedules s
SET school_id = c.school_id
FROM public.classes c
WHERE s.class_id = c.id AND s.school_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_schedules_school_status ON public.schedules(school_id, status);
CREATE INDEX IF NOT EXISTS idx_schedules_term ON public.schedules(term_id);
CREATE INDEX IF NOT EXISTS idx_schedules_period ON public.schedules(period_id);

-- ---------------------------------------------------------------------------
-- Timetable versions (audit / rollback)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.timetable_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  term_id uuid REFERENCES public.terms(id) ON DELETE SET NULL,
  version_number integer NOT NULL DEFAULT 1,
  snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  change_summary text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_timetable_versions_class ON public.timetable_versions(class_id, version_number DESC);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.timetable_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timetable_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subject_weekly_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timetable_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "timetable settings school" ON public.timetable_settings;
CREATE POLICY "timetable settings school" ON public.timetable_settings
  FOR ALL TO authenticated
  USING (school_id = public.get_user_school_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (school_id = public.get_user_school_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "timetable periods school" ON public.timetable_periods;
CREATE POLICY "timetable periods school" ON public.timetable_periods
  FOR ALL TO authenticated
  USING (school_id = public.get_user_school_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (school_id = public.get_user_school_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "subject allocations school" ON public.subject_weekly_allocations;
CREATE POLICY "subject allocations school" ON public.subject_weekly_allocations
  FOR ALL TO authenticated
  USING (school_id = public.get_user_school_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (school_id = public.get_user_school_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "timetable versions school" ON public.timetable_versions;
CREATE POLICY "timetable versions school" ON public.timetable_versions
  FOR SELECT TO authenticated
  USING (school_id = public.get_user_school_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "timetable versions insert admin" ON public.timetable_versions;
CREATE POLICY "timetable versions insert admin" ON public.timetable_versions
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'super_admin'::app_role)
    )
    AND (
      school_id = public.get_user_school_id(auth.uid())
      OR public.has_role(auth.uid(), 'super_admin'::app_role)
    )
  );

-- Students/teachers/parents: only published schedules (admins see all)
DROP POLICY IF EXISTS "Students can view their class schedules" ON public.schedules;
CREATE POLICY "Students can view their class schedules" ON public.schedules
  FOR SELECT TO authenticated
  USING (
    status = 'published'::public.timetable_entry_status
    AND EXISTS (
      SELECT 1 FROM public.students
      WHERE students.user_id = auth.uid() AND students.class_id = schedules.class_id
    )
  );

DROP POLICY IF EXISTS "Teachers can view schedules" ON public.schedules;
CREATE POLICY "Teachers can view schedules" ON public.schedules
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'teacher'::app_role)
    AND (
      status = 'published'::public.timetable_entry_status
      OR EXISTS (SELECT 1 FROM public.teachers t WHERE t.user_id = auth.uid() AND t.id = schedules.teacher_id)
    )
  );

DROP POLICY IF EXISTS "Parents can view children schedules" ON public.schedules;
CREATE POLICY "Parents can view children schedules" ON public.schedules
  FOR SELECT TO authenticated
  USING (
    status = 'published'::public.timetable_entry_status
    AND EXISTS (
      SELECT 1 FROM public.students s
      JOIN public.parents p ON s.guardian_id = p.id
      WHERE p.user_id = auth.uid() AND s.class_id = schedules.class_id
    )
  );

-- Realtime
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.schedules;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

NOTIFY pgrst, 'reload schema';
