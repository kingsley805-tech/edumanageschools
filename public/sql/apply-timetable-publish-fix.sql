-- Timetable publish fix: RPC + policies (run in Supabase SQL Editor)
-- Use when "Publish failed" or status column / version history issues occur.

-- Ensure status column exists on schedules
DO $$ BEGIN
  CREATE TYPE public.timetable_entry_status AS ENUM ('draft', 'published');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.schedules
  ADD COLUMN IF NOT EXISTS status public.timetable_entry_status NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE;

-- Version history table (if missing)
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

ALTER TABLE public.timetable_versions ENABLE ROW LEVEL SECURITY;

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

-- Admins: manage schedules for their school
DROP POLICY IF EXISTS "Admins can manage schedules" ON public.schedules;
CREATE POLICY "Admins can manage schedules" ON public.schedules
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR (
      public.has_role(auth.uid(), 'admin'::app_role)
      AND EXISTS (
        SELECT 1 FROM public.classes c
        WHERE c.id = schedules.class_id
          AND c.school_id = public.get_user_school_id(auth.uid())
      )
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR (
      public.has_role(auth.uid(), 'admin'::app_role)
      AND EXISTS (
        SELECT 1 FROM public.classes c
        WHERE c.id = schedules.class_id
          AND c.school_id = public.get_user_school_id(auth.uid())
      )
    )
  );

-- Reliable publish (bypasses client RLS edge cases)
CREATE OR REPLACE FUNCTION public.publish_class_timetable(p_class_id uuid, p_school_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_name text := 'Admin';
  v_version integer := 1;
  v_count integer := 0;
  v_class_name text;
  r record;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT (
    public.has_role(v_uid, 'admin'::app_role)
    OR public.has_role(v_uid, 'super_admin'::app_role)
  ) THEN
    RAISE EXCEPTION 'Only school admins can publish timetables';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.classes c
    WHERE c.id = p_class_id
      AND c.school_id = p_school_id
      AND (
        c.school_id = public.get_user_school_id(v_uid)
        OR public.has_role(v_uid, 'super_admin'::app_role)
      )
  ) THEN
    RAISE EXCEPTION 'Class not found for your school';
  END IF;

  SELECT count(*)::integer INTO v_count FROM public.schedules WHERE class_id = p_class_id;
  IF v_count = 0 THEN
    RAISE EXCEPTION 'Add at least one period to the timetable before publishing';
  END IF;

  SELECT coalesce(full_name, 'Admin') INTO v_name FROM public.profiles WHERE id = v_uid;

  SELECT coalesce(max(version_number), 0) + 1 INTO v_version
  FROM public.timetable_versions
  WHERE class_id = p_class_id;

  INSERT INTO public.timetable_versions (
    school_id, class_id, version_number, snapshot, change_summary, created_by, created_by_name
  )
  SELECT
    p_school_id,
    p_class_id,
    v_version,
    coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb),
    'Published timetable',
    v_uid,
    v_name
  FROM public.schedules s
  WHERE s.class_id = p_class_id;

  UPDATE public.schedules
  SET status = 'published'::public.timetable_entry_status,
      updated_at = now()
  WHERE class_id = p_class_id;

  SELECT name INTO v_class_name FROM public.classes WHERE id = p_class_id;

  FOR r IN
    SELECT DISTINCT s.user_id
    FROM public.students s
    WHERE s.class_id = p_class_id AND s.user_id IS NOT NULL
  LOOP
    INSERT INTO public.notifications (user_id, title, body, data)
    VALUES (
      r.user_id,
      'Timetable published',
      format('The timetable for %s has been published.', coalesce(v_class_name, 'your class')),
      jsonb_build_object('type', 'timetable_published', 'link', '/student/timetable', 'classId', p_class_id)
    );
  END LOOP;

  FOR r IN
    SELECT DISTINCT t.user_id
    FROM public.schedules sch
    JOIN public.teachers t ON t.id = sch.teacher_id
    WHERE sch.class_id = p_class_id AND t.user_id IS NOT NULL
  LOOP
    INSERT INTO public.notifications (user_id, title, body, data)
    VALUES (
      r.user_id,
      'Timetable published',
      format('The timetable for %s has been published.', coalesce(v_class_name, 'your class')),
      jsonb_build_object('type', 'timetable_published', 'link', '/teacher/timetable', 'classId', p_class_id)
    );
  END LOOP;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.publish_class_timetable(uuid, uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
