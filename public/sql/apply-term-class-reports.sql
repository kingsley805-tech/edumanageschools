-- Overall Class Performance & Position Reports (class × term)
-- Run in Supabase SQL editor if migrations are not applied automatically.
-- Mirrors term_report_cards workflow: draft → pending_review → reviewed/approved/rejected

CREATE TABLE IF NOT EXISTS public.term_class_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  term_id uuid NOT NULL REFERENCES public.terms(id) ON DELETE CASCADE,
  teacher_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status public.report_card_status NOT NULL DEFAULT 'draft',
  class_name text,
  term_label text,
  academic_year text,
  student_count integer NOT NULL DEFAULT 0,
  subject_count integer NOT NULL DEFAULT 0,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  admin_comment text,
  rejection_reason text,
  version integer NOT NULL DEFAULT 1,
  saved_at timestamptz,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, class_id, term_id)
);

CREATE INDEX IF NOT EXISTS term_class_reports_school_status_idx
  ON public.term_class_reports (school_id, status);
CREATE INDEX IF NOT EXISTS term_class_reports_teacher_idx
  ON public.term_class_reports (teacher_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS term_class_reports_term_class_idx
  ON public.term_class_reports (term_id, class_id);

ALTER TABLE public.term_class_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "school staff read term class reports" ON public.term_class_reports;
CREATE POLICY "school staff read term class reports"
  ON public.term_class_reports
  FOR SELECT
  USING (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR public.is_school_admin(auth.uid(), school_id)
    OR (
      school_id = public.get_user_school_id(auth.uid())
      AND public.teacher_teaches_class(auth.uid(), class_id)
    )
  );

DROP POLICY IF EXISTS "teachers manage term class reports" ON public.term_class_reports;

-- Teachers: insert/update only (no delete). Admins/super keep full manage via separate policies.
DROP POLICY IF EXISTS "teachers insert term class reports" ON public.term_class_reports;
CREATE POLICY "teachers insert term class reports"
  ON public.term_class_reports
  FOR INSERT
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR public.is_school_admin(auth.uid(), school_id)
    OR (
      school_id = public.get_user_school_id(auth.uid())
      AND public.teacher_teaches_class(auth.uid(), class_id)
      AND (teacher_id IS NULL OR teacher_id = auth.uid())
      AND status IN ('draft', 'saved', 'pending_review', 'rejected')
    )
  );

DROP POLICY IF EXISTS "teachers update term class reports" ON public.term_class_reports;
CREATE POLICY "teachers update term class reports"
  ON public.term_class_reports
  FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR public.is_school_admin(auth.uid(), school_id)
    OR (
      school_id = public.get_user_school_id(auth.uid())
      AND public.teacher_teaches_class(auth.uid(), class_id)
      AND status IN ('draft', 'saved', 'pending_review', 'rejected')
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR public.is_school_admin(auth.uid(), school_id)
    OR (
      school_id = public.get_user_school_id(auth.uid())
      AND public.teacher_teaches_class(auth.uid(), class_id)
      AND (teacher_id IS NULL OR teacher_id = auth.uid())
      AND status IN ('draft', 'saved', 'pending_review', 'rejected')
    )
  );

DROP POLICY IF EXISTS "admins delete term class reports" ON public.term_class_reports;
CREATE POLICY "admins delete term class reports"
  ON public.term_class_reports
  FOR DELETE
  USING (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR public.is_school_admin(auth.uid(), school_id)
  );

CREATE TABLE IF NOT EXISTS public.term_class_report_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.term_class_reports(id) ON DELETE CASCADE,
  version integer NOT NULL,
  status public.report_card_status NOT NULL,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  changed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (report_id, version)
);

ALTER TABLE public.term_class_report_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff read term class report versions" ON public.term_class_report_versions;
CREATE POLICY "staff read term class report versions"
  ON public.term_class_report_versions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.term_class_reports t
      WHERE t.id = report_id
        AND (
          public.has_role(auth.uid(), 'super_admin'::app_role)
          OR public.is_school_admin(auth.uid(), t.school_id)
          OR (
            t.school_id = public.get_user_school_id(auth.uid())
            AND public.teacher_teaches_class(auth.uid(), t.class_id)
          )
        )
    )
  );

DROP POLICY IF EXISTS "staff insert term class report versions" ON public.term_class_report_versions;
CREATE POLICY "staff insert term class report versions"
  ON public.term_class_report_versions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.term_class_reports t
      WHERE t.id = report_id
        AND (
          public.has_role(auth.uid(), 'super_admin'::app_role)
          OR public.is_school_admin(auth.uid(), t.school_id)
          OR (
            t.school_id = public.get_user_school_id(auth.uid())
            AND public.teacher_teaches_class(auth.uid(), t.class_id)
          )
        )
    )
  );
