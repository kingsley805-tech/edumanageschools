-- Weekly Lesson Notes Management System

DO $$ BEGIN
  CREATE TYPE public.lesson_note_status AS ENUM (
    'draft',
    'pending_review',
    'approved',
    'rejected',
    'needs_correction'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.lesson_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  term_id uuid REFERENCES public.terms(id) ON DELETE SET NULL,
  academic_year_id uuid REFERENCES public.academic_years(id) ON DELETE SET NULL,
  session_label text,
  week_number integer NOT NULL CHECK (week_number >= 1 AND week_number <= 52),
  day_of_week text NOT NULL CHECK (day_of_week IN (
    'monday','tuesday','wednesday','thursday','friday','saturday','sunday'
  )),
  lesson_date date NOT NULL,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE RESTRICT,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE RESTRICT,
  teacher_name text,
  topic text NOT NULL DEFAULT '',
  sub_topic text,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  status public.lesson_note_status NOT NULL DEFAULT 'draft',
  version_number integer NOT NULL DEFAULT 1,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewer_name text,
  admin_feedback text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lesson_notes_school_status ON public.lesson_notes(school_id, status);
CREATE INDEX IF NOT EXISTS idx_lesson_notes_teacher ON public.lesson_notes(teacher_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lesson_notes_term_week ON public.lesson_notes(term_id, week_number, day_of_week);
CREATE INDEX IF NOT EXISTS idx_lesson_notes_class_subject ON public.lesson_notes(class_id, subject_id);

CREATE TABLE IF NOT EXISTS public.lesson_note_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_note_id uuid NOT NULL REFERENCES public.lesson_notes(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  snapshot jsonb NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  submitted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (lesson_note_id, version_number)
);

CREATE TABLE IF NOT EXISTS public.lesson_note_status_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_note_id uuid NOT NULL REFERENCES public.lesson_notes(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  from_status public.lesson_note_status,
  to_status public.lesson_note_status NOT NULL,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_name text,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lesson_note_status_logs_note ON public.lesson_note_status_logs(lesson_note_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.lesson_note_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_note_id uuid NOT NULL REFERENCES public.lesson_notes(id) ON DELETE CASCADE,
  author_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_name text,
  author_role text,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lesson_note_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_note_id uuid NOT NULL REFERENCES public.lesson_notes(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_type text,
  file_size integer,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lesson_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_note_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_note_status_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_note_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_note_attachments ENABLE ROW LEVEL SECURITY;

-- Teachers: own notes
DROP POLICY IF EXISTS "teachers read own lesson notes" ON public.lesson_notes;
CREATE POLICY "teachers read own lesson notes" ON public.lesson_notes
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.teachers t WHERE t.id = lesson_notes.teacher_id AND t.user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

DROP POLICY IF EXISTS "teachers insert own lesson notes" ON public.lesson_notes;
CREATE POLICY "teachers insert own lesson notes" ON public.lesson_notes
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.teachers t WHERE t.id = lesson_notes.teacher_id AND t.user_id = auth.uid())
    AND school_id = public.get_user_school_id(auth.uid())
  );

DROP POLICY IF EXISTS "teachers update own editable lesson notes" ON public.lesson_notes;
CREATE POLICY "teachers update own editable lesson notes" ON public.lesson_notes
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.teachers t WHERE t.id = lesson_notes.teacher_id AND t.user_id = auth.uid())
    AND status IN ('draft'::public.lesson_note_status, 'needs_correction'::public.lesson_note_status, 'rejected'::public.lesson_note_status)
  );

DROP POLICY IF EXISTS "teachers delete own drafts" ON public.lesson_notes;
CREATE POLICY "teachers delete own drafts" ON public.lesson_notes
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.teachers t WHERE t.id = lesson_notes.teacher_id AND t.user_id = auth.uid())
    AND status = 'draft'::public.lesson_note_status
  );

DROP POLICY IF EXISTS "admins manage lesson notes" ON public.lesson_notes;
CREATE POLICY "admins manage lesson notes" ON public.lesson_notes
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  )
  WITH CHECK (
    school_id = public.get_user_school_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

-- Child tables: via lesson_note access
DROP POLICY IF EXISTS "lesson note versions read" ON public.lesson_note_versions;
CREATE POLICY "lesson note versions read" ON public.lesson_note_versions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.lesson_notes ln
      WHERE ln.id = lesson_note_versions.lesson_note_id
        AND (
          EXISTS (SELECT 1 FROM public.teachers t WHERE t.id = ln.teacher_id AND t.user_id = auth.uid())
          OR public.has_role(auth.uid(), 'admin'::app_role)
          OR public.has_role(auth.uid(), 'super_admin'::app_role)
        )
    )
  );

DROP POLICY IF EXISTS "lesson note versions insert" ON public.lesson_note_versions;
CREATE POLICY "lesson note versions insert" ON public.lesson_note_versions
  FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "lesson note logs read" ON public.lesson_note_status_logs;
CREATE POLICY "lesson note logs read" ON public.lesson_note_status_logs
  FOR SELECT TO authenticated
  USING (school_id = public.get_user_school_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "lesson note logs insert" ON public.lesson_note_status_logs;
CREATE POLICY "lesson note logs insert" ON public.lesson_note_status_logs
  FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "lesson note comments read" ON public.lesson_note_comments;
CREATE POLICY "lesson note comments read" ON public.lesson_note_comments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.lesson_notes ln
      WHERE ln.id = lesson_note_comments.lesson_note_id
        AND (
          EXISTS (SELECT 1 FROM public.teachers t WHERE t.id = ln.teacher_id AND t.user_id = auth.uid())
          OR public.has_role(auth.uid(), 'admin'::app_role)
          OR public.has_role(auth.uid(), 'super_admin'::app_role)
        )
    )
  );

DROP POLICY IF EXISTS "lesson note comments insert" ON public.lesson_note_comments;
CREATE POLICY "lesson note comments insert" ON public.lesson_note_comments
  FOR INSERT TO authenticated
  WITH CHECK (author_user_id = auth.uid());

DROP POLICY IF EXISTS "lesson note attachments all" ON public.lesson_note_attachments;
CREATE POLICY "lesson note attachments all" ON public.lesson_note_attachments
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.lesson_notes ln
      WHERE ln.id = lesson_note_attachments.lesson_note_id
        AND (
          EXISTS (SELECT 1 FROM public.teachers t WHERE t.id = ln.teacher_id AND t.user_id = auth.uid())
          OR public.has_role(auth.uid(), 'admin'::app_role)
          OR public.has_role(auth.uid(), 'super_admin'::app_role)
        )
    )
  );

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.lesson_notes;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column' AND pronamespace = 'public'::regnamespace) THEN
    DROP TRIGGER IF EXISTS update_lesson_notes_updated_at ON public.lesson_notes;
    CREATE TRIGGER update_lesson_notes_updated_at
      BEFORE UPDATE ON public.lesson_notes
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- Storage bucket for attachments (create in Dashboard if this fails)
INSERT INTO storage.buckets (id, name, public)
VALUES ('lesson-notes', 'lesson-notes', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "lesson notes attachments read" ON storage.objects;
CREATE POLICY "lesson notes attachments read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'lesson-notes');

DROP POLICY IF EXISTS "lesson notes attachments upload" ON storage.objects;
CREATE POLICY "lesson notes attachments upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'lesson-notes');

NOTIFY pgrst, 'reload schema';
