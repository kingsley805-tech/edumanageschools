-- Live Classes / Google Meet (run in Supabase SQL Editor)
-- Project: https://supabase.com/dashboard/project/xbhhpjtwawfawifhpxbe/sql/new
-- After running: deploy edge function `google-meet` and set Google OAuth secrets.

-- Google Workspace OAuth connections (per school)
CREATE TABLE IF NOT EXISTS public.google_workspace_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  google_account_id text NOT NULL,
  google_email text NOT NULL,
  access_token text NOT NULL,
  refresh_token text,
  token_expires_at timestamptz,
  scopes text[] DEFAULT '{}',
  connected_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  connected_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id)
);

CREATE TABLE IF NOT EXISTS public.live_classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  schedule_id uuid REFERENCES public.schedules(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  session_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  timezone text NOT NULL DEFAULT 'Africa/Accra',
  recurrence_type text NOT NULL DEFAULT 'none'
    CHECK (recurrence_type IN ('none', 'daily', 'weekly', 'monthly', 'custom')),
  recurrence_rule jsonb DEFAULT '{}',
  recurrence_end_date date,
  status text NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('draft', 'scheduled', 'live', 'ended', 'cancelled')),
  recording_enabled boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.live_class_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  live_class_id uuid NOT NULL REFERENCES public.live_classes(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  schedule_id uuid REFERENCES public.schedules(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  session_date date NOT NULL,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  meet_link text,
  meet_id text,
  google_event_id text,
  status text NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'live', 'ended', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_live_class_sessions_school_date ON public.live_class_sessions (school_id, session_date);
CREATE INDEX IF NOT EXISTS idx_live_class_sessions_class_date ON public.live_class_sessions (class_id, session_date);
CREATE INDEX IF NOT EXISTS idx_live_class_sessions_teacher ON public.live_class_sessions (teacher_id, start_at);

CREATE TABLE IF NOT EXISTS public.live_class_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.live_class_sessions(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  join_time timestamptz,
  leave_time timestamptz,
  duration_seconds integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'absent' CHECK (status IN ('present', 'absent', 'late')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, student_id)
);

CREATE TABLE IF NOT EXISTS public.live_class_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  live_class_id uuid NOT NULL REFERENCES public.live_classes(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  title text NOT NULL,
  resource_type text NOT NULL DEFAULT 'file'
    CHECK (resource_type IN ('pdf', 'notes', 'ppt', 'video', 'assignment', 'link', 'file')),
  file_url text,
  file_name text,
  mime_type text,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.live_class_recordings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.live_class_sessions(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  recording_url text NOT NULL,
  recording_date timestamptz NOT NULL DEFAULT now(),
  duration_seconds integer,
  title text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.live_class_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.platform_modules (module_key, category, label, portal_module_key, sort_order)
VALUES ('live_classes', 'academic', 'Live Classes / Google Meet', 'live_classes', 88)
ON CONFLICT (module_key) DO UPDATE SET
  label = EXCLUDED.label,
  portal_module_key = EXCLUDED.portal_module_key,
  sort_order = EXCLUDED.sort_order;

ALTER TABLE public.google_workspace_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_class_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_class_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_class_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_class_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_class_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.user_can_access_live_session(p_session_id uuid, p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.live_class_sessions s
    WHERE s.id = p_session_id AND (
      public.has_role(p_user_id, 'admin'::app_role) OR public.has_role(p_user_id, 'super_admin'::app_role)
      OR EXISTS (SELECT 1 FROM public.teachers t WHERE t.id = s.teacher_id AND t.user_id = p_user_id)
      OR EXISTS (SELECT 1 FROM public.students st WHERE st.class_id = s.class_id AND st.user_id = p_user_id)
      OR EXISTS (SELECT 1 FROM public.students st JOIN public.parents p ON p.id = st.guardian_id WHERE st.class_id = s.class_id AND p.user_id = p_user_id)
      OR EXISTS (SELECT 1 FROM public.parent_students ps JOIN public.students st ON st.id = ps.student_id JOIN public.parents par ON par.id = ps.parent_id WHERE st.class_id = s.class_id AND par.user_id = p_user_id)
    )
  );
$$;

DROP POLICY IF EXISTS "google workspace school admin" ON public.google_workspace_connections;
CREATE POLICY "google workspace school admin" ON public.google_workspace_connections FOR ALL TO authenticated
  USING (school_id = public.get_user_school_id(auth.uid()) AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role)))
  WITH CHECK (school_id = public.get_user_school_id(auth.uid()) AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role)));

DROP POLICY IF EXISTS "live classes school read" ON public.live_classes;
CREATE POLICY "live classes school read" ON public.live_classes FOR SELECT TO authenticated
  USING (school_id = public.get_user_school_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.teachers t WHERE t.id = teacher_id AND t.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.students s WHERE s.class_id = live_classes.class_id AND s.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.students s JOIN public.parents p ON p.id = s.guardian_id WHERE s.class_id = live_classes.class_id AND p.user_id = auth.uid()));

DROP POLICY IF EXISTS "live classes teacher admin write" ON public.live_classes;
CREATE POLICY "live classes teacher admin write" ON public.live_classes FOR ALL TO authenticated
  USING (school_id = public.get_user_school_id(auth.uid()) AND (public.has_role(auth.uid(), 'admin'::app_role) OR EXISTS (SELECT 1 FROM public.teachers t WHERE t.id = teacher_id AND t.user_id = auth.uid())))
  WITH CHECK (school_id = public.get_user_school_id(auth.uid()) AND (public.has_role(auth.uid(), 'admin'::app_role) OR EXISTS (SELECT 1 FROM public.teachers t WHERE t.id = teacher_id AND t.user_id = auth.uid())));

DROP POLICY IF EXISTS "live sessions read" ON public.live_class_sessions;
CREATE POLICY "live sessions read" ON public.live_class_sessions FOR SELECT TO authenticated
  USING (public.user_can_access_live_session(id, auth.uid()));

DROP POLICY IF EXISTS "live sessions teacher admin write" ON public.live_class_sessions;
CREATE POLICY "live sessions teacher admin write" ON public.live_class_sessions FOR ALL TO authenticated
  USING (school_id = public.get_user_school_id(auth.uid()) AND (public.has_role(auth.uid(), 'admin'::app_role) OR EXISTS (SELECT 1 FROM public.teachers t WHERE t.id = teacher_id AND t.user_id = auth.uid())))
  WITH CHECK (school_id = public.get_user_school_id(auth.uid()) AND (public.has_role(auth.uid(), 'admin'::app_role) OR EXISTS (SELECT 1 FROM public.teachers t WHERE t.id = teacher_id AND t.user_id = auth.uid())));

DROP POLICY IF EXISTS "live attendance read" ON public.live_class_attendance;
CREATE POLICY "live attendance read" ON public.live_class_attendance FOR SELECT TO authenticated
  USING (public.user_can_access_live_session(session_id, auth.uid()) OR EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.user_id = auth.uid()));

DROP POLICY IF EXISTS "live attendance write" ON public.live_class_attendance;
CREATE POLICY "live attendance write" ON public.live_class_attendance FOR ALL TO authenticated
  USING (public.user_can_access_live_session(session_id, auth.uid())) WITH CHECK (public.user_can_access_live_session(session_id, auth.uid()));

DROP POLICY IF EXISTS "live resources read" ON public.live_class_resources;
CREATE POLICY "live resources read" ON public.live_class_resources FOR SELECT TO authenticated
  USING (school_id = public.get_user_school_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.live_classes lc JOIN public.students s ON s.class_id = lc.class_id WHERE lc.id = live_class_id AND s.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.live_classes lc JOIN public.teachers t ON t.id = lc.teacher_id WHERE lc.id = live_class_id AND t.user_id = auth.uid()));

DROP POLICY IF EXISTS "live resources teacher write" ON public.live_class_resources;
CREATE POLICY "live resources teacher write" ON public.live_class_resources FOR ALL TO authenticated
  USING (school_id = public.get_user_school_id(auth.uid()) AND (public.has_role(auth.uid(), 'admin'::app_role) OR EXISTS (SELECT 1 FROM public.live_classes lc JOIN public.teachers t ON t.id = lc.teacher_id WHERE lc.id = live_class_id AND t.user_id = auth.uid())))
  WITH CHECK (school_id = public.get_user_school_id(auth.uid()));

DROP POLICY IF EXISTS "live recordings read" ON public.live_class_recordings;
CREATE POLICY "live recordings read" ON public.live_class_recordings FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.live_class_sessions s WHERE s.id = session_id AND public.user_can_access_live_session(s.id, auth.uid())));

DROP POLICY IF EXISTS "live recordings teacher write" ON public.live_class_recordings;
CREATE POLICY "live recordings teacher write" ON public.live_class_recordings FOR ALL TO authenticated
  USING (school_id = public.get_user_school_id(auth.uid()) AND (public.has_role(auth.uid(), 'admin'::app_role) OR EXISTS (SELECT 1 FROM public.live_class_sessions s JOIN public.teachers t ON t.id = s.teacher_id WHERE s.id = session_id AND t.user_id = auth.uid())))
  WITH CHECK (school_id = public.get_user_school_id(auth.uid()));

DROP POLICY IF EXISTS "live audit admin read" ON public.live_class_audit_logs;
CREATE POLICY "live audit admin read" ON public.live_class_audit_logs FOR SELECT TO authenticated
  USING (school_id = public.get_user_school_id(auth.uid()) AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role)));

DROP POLICY IF EXISTS "live audit insert" ON public.live_class_audit_logs;
CREATE POLICY "live audit insert" ON public.live_class_audit_logs FOR INSERT TO authenticated WITH CHECK (school_id = public.get_user_school_id(auth.uid()));

CREATE OR REPLACE FUNCTION public.finalize_live_class_session(p_session_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_session public.live_class_sessions%ROWTYPE; v_term_id uuid; v_rec record; v_duration integer; v_session_minutes integer; v_threshold numeric;
BEGIN
  SELECT * INTO v_session FROM public.live_class_sessions WHERE id = p_session_id;
  IF NOT FOUND THEN RETURN; END IF;
  v_session_minutes := GREATEST(1, EXTRACT(EPOCH FROM (v_session.end_at - v_session.start_at))::int / 60);
  v_threshold := v_session_minutes * 0.5;
  UPDATE public.live_class_sessions SET status = 'ended', updated_at = now() WHERE id = p_session_id AND status IN ('scheduled', 'live');
  FOR v_rec IN SELECT s.id AS student_id, la.join_time, la.leave_time, la.duration_seconds FROM public.students s LEFT JOIN public.live_class_attendance la ON la.student_id = s.id AND la.session_id = p_session_id WHERE s.class_id = v_session.class_id LOOP
    v_duration := COALESCE(v_rec.duration_seconds, 0);
    INSERT INTO public.live_class_attendance (session_id, student_id, join_time, leave_time, duration_seconds, status) VALUES (p_session_id, v_rec.student_id, v_rec.join_time, v_rec.leave_time, v_duration, CASE WHEN v_duration >= v_threshold * 60 THEN 'present' WHEN v_duration > 0 THEN 'late' ELSE 'absent' END)
    ON CONFLICT (session_id, student_id) DO UPDATE SET duration_seconds = EXCLUDED.duration_seconds, status = EXCLUDED.status, leave_time = COALESCE(EXCLUDED.leave_time, live_class_attendance.leave_time), updated_at = now();
  END LOOP;
  SELECT t.id INTO v_term_id FROM public.terms t WHERE t.school_id = v_session.school_id AND v_session.session_date >= t.start_date AND v_session.session_date <= t.end_date ORDER BY t.is_current DESC NULLS LAST LIMIT 1;
  FOR v_rec IN SELECT la.student_id, la.status FROM public.live_class_attendance la WHERE la.session_id = p_session_id LOOP
    IF v_rec.status IN ('present', 'late') THEN
      INSERT INTO public.attendance (student_id, class_id, date, status, recorded_at) VALUES (v_rec.student_id, v_session.class_id, v_session.session_date, CASE WHEN v_rec.status = 'late' THEN 'late' ELSE 'present' END, now())
      ON CONFLICT (student_id, class_id, date) DO UPDATE SET status = EXCLUDED.status, recorded_at = now();
    END IF;
    IF v_term_id IS NOT NULL THEN PERFORM public.recompute_attendance_summary(v_session.school_id, v_rec.student_id, v_term_id); END IF;
  END LOOP;
END; $$;

GRANT EXECUTE ON FUNCTION public.user_can_access_live_session(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_live_class_session(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.notify_live_class_scheduled() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_student record; v_parent record; v_teacher_user uuid; v_start text;
BEGIN
  SELECT user_id INTO v_teacher_user FROM public.teachers WHERE id = NEW.teacher_id;
  v_start := to_char(NEW.start_at, 'DD Mon YYYY HH24:MI');
  IF v_teacher_user IS NOT NULL THEN PERFORM create_notification(v_teacher_user, 'Live class scheduled: ' || NEW.title, 'Your class starts at ' || v_start, jsonb_build_object('type', 'live_class', 'session_id', NEW.id, 'link', '/teacher/live-classes')); END IF;
  FOR v_student IN SELECT s.user_id FROM public.students s WHERE s.class_id = NEW.class_id AND s.user_id IS NOT NULL LOOP
    PERFORM create_notification(v_student.user_id, 'New live class: ' || NEW.title, 'Scheduled for ' || v_start || '. Join from Live Classes.', jsonb_build_object('type', 'live_class', 'session_id', NEW.id, 'link', '/student/live-classes'));
  END LOOP;
  FOR v_parent IN SELECT DISTINCT p.user_id FROM public.students s JOIN public.parents p ON p.id = s.guardian_id WHERE s.class_id = NEW.class_id AND p.user_id IS NOT NULL
    UNION SELECT DISTINCT par.user_id FROM public.parent_students ps JOIN public.students s ON s.id = ps.student_id JOIN public.parents par ON par.id = ps.parent_id WHERE s.class_id = NEW.class_id AND par.user_id IS NOT NULL LOOP
    PERFORM create_notification(v_parent.user_id, 'Online class scheduled', NEW.title || ' on ' || v_start, jsonb_build_object('type', 'live_class', 'session_id', NEW.id, 'link', '/parent/class-schedule'));
  END LOOP;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_live_class_session ON public.live_class_sessions;
CREATE TRIGGER trg_notify_live_class_session AFTER INSERT ON public.live_class_sessions FOR EACH ROW EXECUTE FUNCTION public.notify_live_class_scheduled();

NOTIFY pgrst, 'reload schema';
