-- Live Classes / Google Meet (run in Supabase SQL Editor)
-- Project: https://supabase.com/dashboard/project/xbhhpjtwawfawifhpxbe/sql/new
-- After running: Supabase → Settings → API → Reload schema

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

-- ---------------------------------------------------------------------------
-- Google Meet OAuth (RPC — no Edge Function required for connect)
-- ---------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.school_google_oauth_config (
  school_id uuid PRIMARY KEY REFERENCES public.schools(id) ON DELETE CASCADE,
  client_id text NOT NULL,
  client_secret text NOT NULL,
  redirect_uri text NOT NULL DEFAULT 'http://localhost:8080/admin/online-learning/oauth/callback',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.school_google_oauth_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "school google oauth admin" ON public.school_google_oauth_config;
CREATE POLICY "school google oauth admin" ON public.school_google_oauth_config
  FOR ALL TO authenticated
  USING (
    school_id = public.get_user_school_id(auth.uid())
    AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role))
  )
  WITH CHECK (
    school_id = public.get_user_school_id(auth.uid())
    AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role))
  );

CREATE OR REPLACE FUNCTION public.get_google_oauth_public_config(p_school_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('error', 'Unauthorized'); END IF;
  IF NOT (public.has_role(v_uid, 'admin'::app_role) OR public.has_role(v_uid, 'super_admin'::app_role)) THEN
    RETURN jsonb_build_object('error', 'Admin access required');
  END IF;
  IF p_school_id IS DISTINCT FROM public.get_user_school_id(v_uid) AND NOT public.has_role(v_uid, 'super_admin'::app_role) THEN
    RETURN jsonb_build_object('error', 'School access denied');
  END IF;
  RETURN (
    SELECT jsonb_build_object('client_id', c.client_id, 'redirect_uri', c.redirect_uri, 'configured', true)
    FROM public.school_google_oauth_config c WHERE c.school_id = p_school_id
  ) ?? jsonb_build_object('configured', false);
END; $$;

GRANT EXECUTE ON FUNCTION public.get_google_oauth_public_config(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.upsert_google_oauth_config(
  p_school_id uuid, p_client_id text, p_client_secret text, p_redirect_uri text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Unauthorized'); END IF;
  IF NOT (public.has_role(v_uid, 'admin'::app_role) OR public.has_role(v_uid, 'super_admin'::app_role)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Admin access required');
  END IF;
  IF coalesce(trim(p_client_id), '') = '' OR coalesce(trim(p_client_secret), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Client ID and Client Secret are required');
  END IF;
  INSERT INTO public.school_google_oauth_config (school_id, client_id, client_secret, redirect_uri, updated_at)
  VALUES (p_school_id, trim(p_client_id), trim(p_client_secret),
    coalesce(nullif(trim(p_redirect_uri), ''), 'http://localhost:8080/admin/online-learning/oauth/callback'), now())
  ON CONFLICT (school_id) DO UPDATE SET
    client_id = EXCLUDED.client_id, client_secret = EXCLUDED.client_secret,
    redirect_uri = EXCLUDED.redirect_uri, updated_at = now();
  RETURN jsonb_build_object('ok', true);
END; $$;

GRANT EXECUTE ON FUNCTION public.upsert_google_oauth_config(uuid, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.exchange_google_oauth_code(
  p_code text, p_redirect_uri text, p_state text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid(); v_code text := trim(coalesce(p_code, '')); v_redirect text := trim(coalesce(p_redirect_uri, ''));
  v_school_id uuid; v_cfg record; v_http extensions.http_response; v_tokens jsonb;
  v_user_http extensions.http_response; v_user jsonb; v_expires_at timestamptz;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Unauthorized'); END IF;
  IF v_code = '' THEN RETURN jsonb_build_object('ok', false, 'error', 'Missing authorization code'); END IF;
  v_school_id := public.get_user_school_id(v_uid);
  IF p_state IS NOT NULL AND p_state <> '' THEN
    BEGIN
      v_school_id := coalesce((convert_from(decode(p_state, 'base64'), 'utf8')::jsonb ->> 'schoolId')::uuid, v_school_id);
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;
  IF v_school_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'School context required'); END IF;
  SELECT * INTO v_cfg FROM public.school_google_oauth_config WHERE school_id = v_school_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Google OAuth is not configured on this page.'); END IF;
  IF v_redirect = '' THEN v_redirect := v_cfg.redirect_uri; END IF;
  BEGIN
    SELECT * INTO v_http FROM extensions.http((
      'POST', 'https://oauth2.googleapis.com/token',
      ARRAY[extensions.http_header('Content-Type', 'application/x-www-form-urlencoded')],
      'application/x-www-form-urlencoded',
      'code=' || replace(v_code, '&', '%26') || '&client_id=' || replace(v_cfg.client_id, '&', '%26')
        || '&client_secret=' || replace(v_cfg.client_secret, '&', '%26')
        || '&redirect_uri=' || replace(v_redirect, '&', '%26') || '&grant_type=authorization_code'
    )::extensions.http_request);
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Enable the http extension in Supabase → Database → Extensions.');
  END;
  IF v_http.status IS NULL OR v_http.status < 200 OR v_http.status >= 300 THEN
    BEGIN v_tokens := v_http.content::jsonb; EXCEPTION WHEN OTHERS THEN v_tokens := '{}'::jsonb; END;
    RETURN jsonb_build_object('ok', false, 'error', coalesce(v_tokens ->> 'error_description', v_tokens ->> 'error', 'Token exchange failed'));
  END IF;
  v_tokens := v_http.content::jsonb;
  SELECT * INTO v_user_http FROM extensions.http((
    'GET', 'https://www.googleapis.com/oauth2/v2/userinfo',
    ARRAY[extensions.http_header('Authorization', 'Bearer ' || (v_tokens ->> 'access_token'))], NULL::text, NULL::text
  )::extensions.http_request);
  IF v_user_http.status IS NULL OR v_user_http.status < 200 OR v_user_http.status >= 300 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Failed to fetch Google profile');
  END IF;
  v_user := v_user_http.content::jsonb;
  v_expires_at := now() + make_interval(secs => coalesce((v_tokens ->> 'expires_in')::int, 3600));
  INSERT INTO public.google_workspace_connections (
    school_id, google_account_id, google_email, access_token, refresh_token, token_expires_at,
    scopes, connected_by, connected_at, updated_at
  ) VALUES (
    v_school_id, v_user ->> 'id', v_user ->> 'email', v_tokens ->> 'access_token', v_tokens ->> 'refresh_token',
    v_expires_at, ARRAY['https://www.googleapis.com/auth/calendar','openid','email','profile'],
    v_uid, now(), now()
  ) ON CONFLICT (school_id) DO UPDATE SET
    google_account_id = EXCLUDED.google_account_id, google_email = EXCLUDED.google_email,
    access_token = EXCLUDED.access_token,
    refresh_token = coalesce(EXCLUDED.refresh_token, public.google_workspace_connections.refresh_token),
    token_expires_at = EXCLUDED.token_expires_at, connected_by = EXCLUDED.connected_by, updated_at = now();
  RETURN jsonb_build_object('ok', true, 'email', v_user ->> 'email');
END; $$;

GRANT EXECUTE ON FUNCTION public.exchange_google_oauth_code(text, text, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- Create live class + Google Meet (RPC — no Edge Function required)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public._google_refresh_access_token(p_school_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conn public.google_workspace_connections%ROWTYPE;
  v_cfg public.school_google_oauth_config%ROWTYPE;
  v_http extensions.http_response;
  v_tokens jsonb;
BEGIN
  SELECT * INTO v_conn FROM public.google_workspace_connections WHERE school_id = p_school_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Connect Google Workspace before creating live classes.'; END IF;
  IF v_conn.token_expires_at IS NOT NULL AND v_conn.token_expires_at > now() + interval '60 seconds' THEN
    RETURN v_conn.access_token;
  END IF;
  IF coalesce(v_conn.refresh_token, '') = '' THEN RAISE EXCEPTION 'Google token expired. Reconnect your account.'; END IF;
  SELECT * INTO v_cfg FROM public.school_google_oauth_config WHERE school_id = p_school_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Google OAuth is not configured for this school.'; END IF;
  SELECT * INTO v_http FROM extensions.http((
    'POST', 'https://oauth2.googleapis.com/token',
    ARRAY[extensions.http_header('Content-Type', 'application/x-www-form-urlencoded')],
    'application/x-www-form-urlencoded',
    'client_id=' || replace(v_cfg.client_id, '&', '%26')
      || '&client_secret=' || replace(v_cfg.client_secret, '&', '%26')
      || '&refresh_token=' || replace(v_conn.refresh_token, '&', '%26') || '&grant_type=refresh_token'
  )::extensions.http_request);
  IF v_http.status IS NULL OR v_http.status < 200 OR v_http.status >= 300 THEN
    BEGIN v_tokens := v_http.content::jsonb; EXCEPTION WHEN OTHERS THEN v_tokens := '{}'::jsonb; END;
    RAISE EXCEPTION '%', coalesce(v_tokens ->> 'error_description', v_tokens ->> 'error', 'Token refresh failed');
  END IF;
  v_tokens := v_http.content::jsonb;
  UPDATE public.google_workspace_connections SET access_token = v_tokens ->> 'access_token',
    token_expires_at = now() + make_interval(secs => coalesce((v_tokens ->> 'expires_in')::int, 3600)), updated_at = now()
  WHERE school_id = p_school_id;
  RETURN v_tokens ->> 'access_token';
END; $$;

CREATE OR REPLACE FUNCTION public.create_live_class_via_google(
  p_school_id uuid, p_class_id uuid, p_subject_id uuid, p_teacher_id uuid, p_title text,
  p_session_date date, p_start_time time, p_end_time time, p_description text DEFAULT NULL,
  p_timezone text DEFAULT 'Africa/Accra', p_recurrence_type text DEFAULT 'none',
  p_recurrence_end_date date DEFAULT NULL, p_recurrence_rule jsonb DEFAULT '{}'::jsonb,
  p_recording_enabled boolean DEFAULT false, p_schedule_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid(); v_access_token text; v_conn public.google_workspace_connections%ROWTYPE;
  v_tz text := coalesce(nullif(trim(p_timezone), ''), 'Africa/Accra'); v_week_days int[];
  v_dates date[]; v_current date; v_end date; v_count int := 0; v_recurrence text[]; v_until text;
  v_http extensions.http_response; v_event jsonb; v_body jsonb; v_meet_link text; v_meet_id text; v_event_id text;
  v_live_class public.live_classes%ROWTYPE; v_sessions jsonb := '[]'::jsonb; v_date date; v_idx int := 0; v_day_of_week int;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Unauthorized'); END IF;
  IF coalesce(trim(p_title), '') = '' THEN RETURN jsonb_build_object('ok', false, 'error', 'Title is required'); END IF;
  IF p_school_id IS DISTINCT FROM public.get_user_school_id(v_uid) AND NOT public.has_role(v_uid, 'super_admin'::app_role) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'School access denied');
  END IF;
  IF NOT (public.has_role(v_uid, 'admin'::app_role) OR public.has_role(v_uid, 'super_admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.teachers t WHERE t.id = p_teacher_id AND t.user_id = v_uid)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized to create live classes');
  END IF;
  SELECT * INTO v_conn FROM public.google_workspace_connections WHERE school_id = p_school_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Connect Google Workspace before creating live classes.'); END IF;
  BEGIN v_access_token := public._google_refresh_access_token(p_school_id);
  EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('ok', false, 'error', SQLERRM); END;
  IF jsonb_typeof(p_recurrence_rule -> 'daysOfWeek') = 'array' THEN
    SELECT coalesce(array_agg((elem)::int), ARRAY[]::int[]) INTO v_week_days
    FROM jsonb_array_elements_text(p_recurrence_rule -> 'daysOfWeek') elem;
  ELSE v_week_days := ARRAY[]::int[]; END IF;
  v_dates := ARRAY[p_session_date]; v_current := p_session_date; v_end := p_recurrence_end_date;
  IF coalesce(p_recurrence_type, 'none') <> 'none' THEN
    WHILE v_count < 52 LOOP
      IF p_recurrence_type = 'daily' THEN v_current := v_current + 1;
      ELSIF p_recurrence_type = 'weekly' THEN
        v_current := v_current + 1;
        IF cardinality(v_week_days) > 0 AND NOT (extract(dow FROM v_current)::int = ANY (v_week_days)) THEN CONTINUE; END IF;
      ELSIF p_recurrence_type = 'monthly' THEN v_current := (v_current + interval '1 month')::date;
      ELSE EXIT; END IF;
      IF v_end IS NOT NULL AND v_current > v_end THEN EXIT; END IF;
      IF v_current > p_session_date THEN v_dates := array_append(v_dates, v_current); END IF;
      v_count := v_count + 1;
    END LOOP;
  END IF;
  IF p_recurrence_end_date IS NOT NULL THEN v_until := to_char(p_recurrence_end_date, 'YYYYMMDD') || 'T235959Z'; END IF;
  IF p_recurrence_type = 'daily' THEN v_recurrence := ARRAY['RRULE:FREQ=DAILY' || coalesce(';UNTIL=' || v_until, '')];
  ELSIF p_recurrence_type = 'weekly' AND cardinality(v_week_days) > 0 THEN
    v_recurrence := ARRAY['RRULE:FREQ=WEEKLY;BYDAY=' || array_to_string(ARRAY(
      SELECT (ARRAY['SU','MO','TU','WE','TH','FR','SA'])[d + 1] FROM unnest(v_week_days) AS d), ',') || coalesce(';UNTIL=' || v_until, '')];
  ELSIF p_recurrence_type = 'weekly' THEN v_recurrence := ARRAY['RRULE:FREQ=WEEKLY' || coalesce(';UNTIL=' || v_until, '')];
  ELSIF p_recurrence_type = 'monthly' THEN v_recurrence := ARRAY['RRULE:FREQ=MONTHLY' || coalesce(';UNTIL=' || v_until, '')];
  ELSE v_recurrence := ARRAY[]::text[]; END IF;
  v_body := jsonb_build_object('summary', trim(p_title), 'description', coalesce(p_description, ''),
    'start', jsonb_build_object('dateTime', p_session_date::text || 'T' || p_start_time::text, 'timeZone', v_tz),
    'end', jsonb_build_object('dateTime', p_session_date::text || 'T' || p_end_time::text, 'timeZone', v_tz),
    'conferenceData', jsonb_build_object('createRequest', jsonb_build_object('requestId', gen_random_uuid()::text,
      'conferenceSolutionKey', jsonb_build_object('type', 'hangoutsMeet'))));
  IF cardinality(v_recurrence) > 0 THEN v_body := v_body || jsonb_build_object('recurrence', to_jsonb(v_recurrence)); END IF;
  BEGIN
    SELECT * INTO v_http FROM extensions.http(('POST',
      'https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1',
      ARRAY[extensions.http_header('Authorization', 'Bearer ' || v_access_token), extensions.http_header('Content-Type', 'application/json')],
      'application/json', v_body::text)::extensions.http_request);
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Enable the http extension in Supabase → Database → Extensions.');
  END;
  IF v_http.status IS NULL OR v_http.status < 200 OR v_http.status >= 300 THEN
    BEGIN v_event := v_http.content::jsonb; EXCEPTION WHEN OTHERS THEN v_event := '{}'::jsonb; END;
    RETURN jsonb_build_object('ok', false, 'error', coalesce(v_event #>> '{error,message}', v_event ->> 'error', 'Failed to create Google Meet event'));
  END IF;
  v_event := v_http.content::jsonb;
  SELECT ep ->> 'uri' INTO v_meet_link FROM jsonb_array_elements(coalesce(v_event -> 'conferenceData' -> 'entryPoints', '[]'::jsonb)) ep
  WHERE ep ->> 'entryPointType' = 'video' LIMIT 1;
  v_meet_link := coalesce(v_meet_link, v_event ->> 'hangoutLink');
  v_meet_id := coalesce(v_event -> 'conferenceData' ->> 'conferenceId', v_event ->> 'id');
  v_event_id := v_event ->> 'id';
  INSERT INTO public.live_classes (school_id, class_id, subject_id, teacher_id, schedule_id, title, description,
    session_date, start_time, end_time, timezone, recurrence_type, recurrence_rule, recurrence_end_date, recording_enabled, status, created_by)
  VALUES (p_school_id, p_class_id, p_subject_id, p_teacher_id, p_schedule_id, trim(p_title), p_description,
    p_session_date, p_start_time, p_end_time, v_tz, coalesce(p_recurrence_type, 'none'), coalesce(p_recurrence_rule, '{}'::jsonb),
    p_recurrence_end_date, coalesce(p_recording_enabled, false), 'scheduled', v_uid) RETURNING * INTO v_live_class;
  FOREACH v_date IN ARRAY v_dates LOOP
    v_idx := v_idx + 1;
    INSERT INTO public.live_class_sessions (live_class_id, school_id, class_id, subject_id, teacher_id, schedule_id,
      title, description, session_date, start_at, end_at, meet_link, meet_id, google_event_id, status)
    VALUES (v_live_class.id, p_school_id, p_class_id, p_subject_id, p_teacher_id, p_schedule_id, trim(p_title), p_description, v_date,
      (v_date::text || 'T' || p_start_time::text)::timestamptz, (v_date::text || 'T' || p_end_time::text)::timestamptz,
      v_meet_link, v_meet_id, CASE WHEN v_idx = 1 THEN v_event_id ELSE NULL END, 'scheduled');
  END LOOP;
  SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.start_at), '[]'::jsonb) INTO v_sessions
  FROM public.live_class_sessions s WHERE s.live_class_id = v_live_class.id;
  IF p_schedule_id IS NOT NULL THEN UPDATE public.schedules SET status = 'published' WHERE id = p_schedule_id;
  ELSE
    v_day_of_week := extract(dow FROM p_session_date)::int;
    INSERT INTO public.schedules (school_id, class_id, subject_id, teacher_id, day_of_week, start_time, end_time, room, status)
    VALUES (p_school_id, p_class_id, p_subject_id, p_teacher_id, v_day_of_week, p_start_time, p_end_time, 'Google Meet', 'published');
  END IF;
  INSERT INTO public.live_class_audit_logs (school_id, actor_id, action, entity_type, entity_id, metadata)
  VALUES (p_school_id, v_uid, 'live_class_created', 'live_classes', v_live_class.id,
    jsonb_build_object('sessionCount', jsonb_array_length(v_sessions), 'meetLink', v_meet_link));
  RETURN jsonb_build_object('ok', true, 'liveClass', to_jsonb(v_live_class), 'sessions', v_sessions, 'meetLink', v_meet_link);
END; $$;

GRANT EXECUTE ON FUNCTION public.create_live_class_via_google(
  uuid, uuid, uuid, uuid, text, date, time, time, text, text, text, date, jsonb, boolean, uuid
) TO authenticated;

NOTIFY pgrst, 'reload schema';
