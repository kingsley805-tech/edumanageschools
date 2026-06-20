-- Patch: create live classes without Edge Functions
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/xbhhpjtwawfawifhpxbe/sql/new
-- Then: Settings → API → Reload schema

CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;

-- (Full function bodies match supabase/migrations/20260620120000_create_live_class_rpc.sql)

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
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Connect Google Workspace before creating live classes.';
  END IF;

  IF v_conn.token_expires_at IS NOT NULL
     AND v_conn.token_expires_at > now() + interval '60 seconds' THEN
    RETURN v_conn.access_token;
  END IF;

  IF coalesce(v_conn.refresh_token, '') = '' THEN
    RAISE EXCEPTION 'Google token expired. Reconnect your account.';
  END IF;

  SELECT * INTO v_cfg FROM public.school_google_oauth_config WHERE school_id = p_school_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Google OAuth is not configured for this school.';
  END IF;

  SELECT * INTO v_http FROM extensions.http((
    'POST',
    'https://oauth2.googleapis.com/token',
    ARRAY[extensions.http_header('Content-Type', 'application/x-www-form-urlencoded')],
    'application/x-www-form-urlencoded',
    'client_id=' || replace(v_cfg.client_id, '&', '%26')
      || '&client_secret=' || replace(v_cfg.client_secret, '&', '%26')
      || '&refresh_token=' || replace(v_conn.refresh_token, '&', '%26')
      || '&grant_type=refresh_token'
  )::extensions.http_request);

  IF v_http.status IS NULL OR v_http.status < 200 OR v_http.status >= 300 THEN
    BEGIN v_tokens := v_http.content::jsonb; EXCEPTION WHEN OTHERS THEN v_tokens := '{}'::jsonb; END;
    RAISE EXCEPTION '%', coalesce(v_tokens ->> 'error_description', v_tokens ->> 'error', 'Token refresh failed');
  END IF;

  v_tokens := v_http.content::jsonb;
  UPDATE public.google_workspace_connections
  SET access_token = v_tokens ->> 'access_token',
      token_expires_at = now() + make_interval(secs => coalesce((v_tokens ->> 'expires_in')::int, 3600)),
      updated_at = now()
  WHERE school_id = p_school_id;

  RETURN v_tokens ->> 'access_token';
END;
$$;

CREATE OR REPLACE FUNCTION public.create_live_class_via_google(
  p_school_id uuid,
  p_class_id uuid,
  p_subject_id uuid,
  p_teacher_id uuid,
  p_title text,
  p_session_date date,
  p_start_time time,
  p_end_time time,
  p_description text DEFAULT NULL,
  p_timezone text DEFAULT 'Africa/Accra',
  p_recurrence_type text DEFAULT 'none',
  p_recurrence_end_date date DEFAULT NULL,
  p_recurrence_rule jsonb DEFAULT '{}'::jsonb,
  p_recording_enabled boolean DEFAULT false,
  p_schedule_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_access_token text;
  v_conn public.google_workspace_connections%ROWTYPE;
  v_tz text := coalesce(nullif(trim(p_timezone), ''), 'Africa/Accra');
  v_week_days int[];
  v_dates date[];
  v_current date;
  v_end date;
  v_count int := 0;
  v_recurrence text[];
  v_until text;
  v_http extensions.http_response;
  v_event jsonb;
  v_body jsonb;
  v_meet_link text;
  v_meet_id text;
  v_event_id text;
  v_live_class public.live_classes%ROWTYPE;
  v_sessions jsonb := '[]'::jsonb;
  v_date date;
  v_idx int := 0;
  v_day_of_week int;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Unauthorized');
  END IF;

  IF coalesce(trim(p_title), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Title is required');
  END IF;

  IF p_school_id IS DISTINCT FROM public.get_user_school_id(v_uid)
     AND NOT public.has_role(v_uid, 'super_admin'::app_role) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'School access denied');
  END IF;

  IF NOT (
    public.has_role(v_uid, 'admin'::app_role)
    OR public.has_role(v_uid, 'super_admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.teachers t
      WHERE t.id = p_teacher_id AND t.user_id = v_uid
    )
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized to create live classes');
  END IF;

  SELECT * INTO v_conn FROM public.google_workspace_connections WHERE school_id = p_school_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Connect Google Workspace before creating live classes.');
  END IF;

  BEGIN
    v_access_token := public._google_refresh_access_token(p_school_id);
  EXCEPTION
    WHEN OTHERS THEN
      RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
  END;

  IF jsonb_typeof(p_recurrence_rule -> 'daysOfWeek') = 'array' THEN
    SELECT coalesce(array_agg((elem)::int), ARRAY[]::int[])
    INTO v_week_days
    FROM jsonb_array_elements_text(p_recurrence_rule -> 'daysOfWeek') elem;
  ELSE
    v_week_days := ARRAY[]::int[];
  END IF;

  v_dates := ARRAY[p_session_date];
  v_current := p_session_date;
  v_end := p_recurrence_end_date;

  IF coalesce(p_recurrence_type, 'none') <> 'none' THEN
    WHILE v_count < 52 LOOP
      IF p_recurrence_type = 'daily' THEN
        v_current := v_current + 1;
      ELSIF p_recurrence_type = 'weekly' THEN
        v_current := v_current + 1;
        IF cardinality(v_week_days) > 0 AND NOT (extract(dow FROM v_current)::int = ANY (v_week_days)) THEN
          CONTINUE;
        END IF;
      ELSIF p_recurrence_type = 'monthly' THEN
        v_current := (v_current + interval '1 month')::date;
      ELSE
        EXIT;
      END IF;

      IF v_end IS NOT NULL AND v_current > v_end THEN EXIT; END IF;
      IF v_current > p_session_date THEN
        v_dates := array_append(v_dates, v_current);
      END IF;
      v_count := v_count + 1;
    END LOOP;
  END IF;

  IF p_recurrence_end_date IS NOT NULL THEN
    v_until := to_char(p_recurrence_end_date, 'YYYYMMDD') || 'T235959Z';
  END IF;

  IF p_recurrence_type = 'daily' THEN
    v_recurrence := ARRAY['RRULE:FREQ=DAILY' || coalesce(';UNTIL=' || v_until, '')];
  ELSIF p_recurrence_type = 'weekly' AND cardinality(v_week_days) > 0 THEN
    v_recurrence := ARRAY[
      'RRULE:FREQ=WEEKLY;BYDAY='
      || array_to_string(
        ARRAY(
          SELECT (ARRAY['SU','MO','TU','WE','TH','FR','SA'])[d + 1]
          FROM unnest(v_week_days) AS d
        ),
        ','
      ) || coalesce(';UNTIL=' || v_until, '')
    ];
  ELSIF p_recurrence_type = 'weekly' THEN
    v_recurrence := ARRAY['RRULE:FREQ=WEEKLY' || coalesce(';UNTIL=' || v_until, '')];
  ELSIF p_recurrence_type = 'monthly' THEN
    v_recurrence := ARRAY['RRULE:FREQ=MONTHLY' || coalesce(';UNTIL=' || v_until, '')];
  ELSE
    v_recurrence := ARRAY[]::text[];
  END IF;

  v_body := jsonb_build_object(
    'summary', trim(p_title),
    'description', coalesce(p_description, ''),
    'start', jsonb_build_object('dateTime', p_session_date::text || 'T' || p_start_time::text, 'timeZone', v_tz),
    'end', jsonb_build_object('dateTime', p_session_date::text || 'T' || p_end_time::text, 'timeZone', v_tz),
    'conferenceData', jsonb_build_object(
      'createRequest', jsonb_build_object(
        'requestId', gen_random_uuid()::text,
        'conferenceSolutionKey', jsonb_build_object('type', 'hangoutsMeet')
      )
    )
  );

  IF cardinality(v_recurrence) > 0 THEN
    v_body := v_body || jsonb_build_object('recurrence', to_jsonb(v_recurrence));
  END IF;

  BEGIN
    SELECT * INTO v_http FROM extensions.http((
      'POST',
      'https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1',
      ARRAY[
        extensions.http_header('Authorization', 'Bearer ' || v_access_token),
        extensions.http_header('Content-Type', 'application/json')
      ],
      'application/json',
      v_body::text
    )::extensions.http_request);
  EXCEPTION
    WHEN OTHERS THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Enable the http extension in Supabase → Database → Extensions.');
  END;

  IF v_http.status IS NULL OR v_http.status < 200 OR v_http.status >= 300 THEN
    BEGIN v_event := v_http.content::jsonb; EXCEPTION WHEN OTHERS THEN v_event := '{}'::jsonb; END;
    RETURN jsonb_build_object(
      'ok', false,
      'error', coalesce(v_event #>> '{error,message}', v_event ->> 'error', 'Failed to create Google Meet event')
    );
  END IF;

  v_event := v_http.content::jsonb;
  SELECT ep ->> 'uri'
  INTO v_meet_link
  FROM jsonb_array_elements(coalesce(v_event -> 'conferenceData' -> 'entryPoints', '[]'::jsonb)) ep
  WHERE ep ->> 'entryPointType' = 'video'
  LIMIT 1;

  v_meet_link := coalesce(v_meet_link, v_event ->> 'hangoutLink');
  v_meet_id := coalesce(v_event -> 'conferenceData' ->> 'conferenceId', v_event ->> 'id');
  v_event_id := v_event ->> 'id';

  INSERT INTO public.live_classes (
    school_id, class_id, subject_id, teacher_id, schedule_id, title, description,
    session_date, start_time, end_time, timezone, recurrence_type, recurrence_rule,
    recurrence_end_date, recording_enabled, status, created_by
  ) VALUES (
    p_school_id, p_class_id, p_subject_id, p_teacher_id, p_schedule_id, trim(p_title), p_description,
    p_session_date, p_start_time, p_end_time, v_tz, coalesce(p_recurrence_type, 'none'),
    coalesce(p_recurrence_rule, '{}'::jsonb), p_recurrence_end_date, coalesce(p_recording_enabled, false),
    'scheduled', v_uid
  )
  RETURNING * INTO v_live_class;

  FOREACH v_date IN ARRAY v_dates LOOP
    v_idx := v_idx + 1;
    INSERT INTO public.live_class_sessions (
      live_class_id, school_id, class_id, subject_id, teacher_id, schedule_id,
      title, description, session_date, start_at, end_at,
      meet_link, meet_id, google_event_id, status
    ) VALUES (
      v_live_class.id, p_school_id, p_class_id, p_subject_id, p_teacher_id, p_schedule_id,
      trim(p_title), p_description, v_date,
      (v_date::text || 'T' || p_start_time::text)::timestamptz,
      (v_date::text || 'T' || p_end_time::text)::timestamptz,
      v_meet_link, v_meet_id, CASE WHEN v_idx = 1 THEN v_event_id ELSE NULL END, 'scheduled'
    );
  END LOOP;

  SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.start_at), '[]'::jsonb)
  INTO v_sessions
  FROM public.live_class_sessions s
  WHERE s.live_class_id = v_live_class.id;

  IF p_schedule_id IS NOT NULL THEN
    UPDATE public.schedules SET status = 'published' WHERE id = p_schedule_id;
  ELSE
    v_day_of_week := extract(dow FROM p_session_date)::int;
    INSERT INTO public.schedules (
      school_id, class_id, subject_id, teacher_id, day_of_week, start_time, end_time, room, status
    ) VALUES (
      p_school_id, p_class_id, p_subject_id, p_teacher_id, v_day_of_week,
      p_start_time, p_end_time, 'Google Meet', 'published'
    );
  END IF;

  INSERT INTO public.live_class_audit_logs (
    school_id, actor_id, action, entity_type, entity_id, metadata
  ) VALUES (
    p_school_id, v_uid, 'live_class_created', 'live_classes', v_live_class.id,
    jsonb_build_object('sessionCount', jsonb_array_length(v_sessions), 'meetLink', v_meet_link)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'liveClass', to_jsonb(v_live_class),
    'sessions', v_sessions,
    'meetLink', v_meet_link
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_live_class_via_google(
  uuid, uuid, uuid, uuid, text, date, time, time, text, text, text, date, jsonb, boolean, uuid
) TO authenticated;

NOTIFY pgrst, 'reload schema';
