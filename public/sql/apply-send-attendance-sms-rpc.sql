-- Send attendance SMS from Postgres (bypasses broken/outdated send-attendance-sms edge deploy).
-- Requires: http extension + Arkesel API key (same value as Edge secret ARKESEL_API_KEY).
-- Run after apply-attendance-sms-system.sql and apply-sms-subscription-billing.sql

CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.platform_sms_gateway (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  api_key text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_sms_gateway ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super admins manage platform sms gateway" ON public.platform_sms_gateway;
CREATE POLICY "super admins manage platform sms gateway" ON public.platform_sms_gateway
  FOR ALL TO authenticated
  USING (public.is_platform_super_admin())
  WITH CHECK (public.is_platform_super_admin());

GRANT SELECT, INSERT, UPDATE ON public.platform_sms_gateway TO authenticated;
GRANT ALL ON public.platform_sms_gateway TO service_role;

-- One-time: save your Arkesel API key (Dashboard → Edge Functions → Secrets, or paste here):
-- INSERT INTO public.platform_sms_gateway (id, api_key)
-- VALUES (true, 'YOUR_ARKESEL_API_KEY')
-- ON CONFLICT (id) DO UPDATE SET api_key = EXCLUDED.api_key, updated_at = now();
-- Uses Arkesel v1 URL: https://sms.arkesel.com/sms/api?action=send-sms&...
CREATE OR REPLACE FUNCTION public.normalize_sms_phone(raw text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  digits text;
BEGIN
  digits := regexp_replace(coalesce(raw, ''), '\D', '', 'g');
  IF digits = '' THEN RETURN NULL; END IF;

  IF digits ~ '^233' AND length(digits) >= 11 THEN RETURN digits; END IF;

  IF digits ~ '^0' AND length(digits) >= 10 THEN
    RETURN '233' || substring(digits from 2);
  END IF;

  IF digits ~ '^0' THEN
    digits := substring(digits from 2);
  END IF;

  -- Ghana local numbers (8–9 digits), e.g. 050688781 → 23350688781
  IF length(digits) BETWEEN 8 AND 9 THEN
    RETURN '233' || digits;
  END IF;

  IF length(digits) >= 10 THEN RETURN digits; END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.sms_phone_for_arkesel(intl_phone text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN coalesce($1, '') ~ '^233' AND length($1) >= 11 THEN '0' || substring($1 from 4)
    WHEN coalesce($1, '') ~ '^0' THEN $1
    ELSE $1
  END;
$$;

CREATE OR REPLACE FUNCTION public.url_query_encode(input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  c text;
  result text := '';
  code int;
  i int;
BEGIN
  IF input IS NULL THEN RETURN ''; END IF;
  FOR i IN 1..length(input) LOOP
    c := substring(input from i for 1);
    code := ascii(c);
    IF (code BETWEEN 48 AND 57) OR (code BETWEEN 65 AND 90) OR (code BETWEEN 97 AND 122)
       OR c IN ('-', '_', '.', '~') THEN
      result := result || c;
    ELSIF c = ' ' THEN
      result := result || '%20';
    ELSE
      result := result || '%' || lpad(upper(to_hex(code)), 2, '0');
    END IF;
  END LOOP;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.build_arkesel_sms_url(
  p_api_key text,
  p_to_phone text,
  p_sender text,
  p_message text
)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT format(
    'https://sms.arkesel.com/sms/api?action=send-sms&api_key=%s&to=%s&from=%s&sms=%s',
    public.url_query_encode(p_api_key),
    public.url_query_encode(public.sms_phone_for_arkesel(p_to_phone)),
    public.url_query_encode(substring(coalesce(p_sender, 'School') from 1 for 11)),
    public.url_query_encode(p_message)
  );
$$;

CREATE OR REPLACE FUNCTION public.send_attendance_sms_for_register(p_register_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_reg public.class_registers%ROWTYPE;
  v_school_name text;
  v_sender text;
  v_api_key text;
  v_notify_absent boolean := true;
  v_notify_late boolean := true;
  v_notify_present boolean := false;
  v_attendance_enabled boolean := true;
  v_sms_active boolean := true;
  v_entry record;
  v_student_name text;
  v_parent record;
  v_phone text;
  v_message text;
  v_status text;
  v_should_notify boolean;
  v_credit jsonb;
  v_http extensions.http_response;
  v_body jsonb;
  v_sent int := 0;
  v_skipped int := 0;
  v_errors text[] := ARRAY[]::text[];
  v_date_label text;
  v_log_id uuid;
  v_arkesel_url text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('error', 'Please sign in again.');
  END IF;

  SELECT * INTO v_reg FROM public.class_registers WHERE id = p_register_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Register not found');
  END IF;

  IF NOT (
    public.has_role(v_uid, 'admin'::app_role)
    AND public.get_user_school_id(v_uid) = v_reg.school_id
  ) AND NOT public.teacher_can_view_student(v_uid, v_reg.class_id) THEN
    RETURN jsonb_build_object('error', 'Not authorized');
  END IF;

  SELECT coalesce(s.school_name, 'School') INTO v_school_name
  FROM public.schools s
  WHERE s.id = v_reg.school_id;

  SELECT
    coalesce(ss.sms_notify_absent, true),
    coalesce(ss.sms_notify_late, true),
    coalesce(ss.sms_notify_present, false),
    coalesce(ss.sms_attendance_enabled, true),
    nullif(trim(coalesce(ss.sms_sender_id, '')), '')
  INTO v_notify_absent, v_notify_late, v_notify_present, v_attendance_enabled, v_sender
  FROM public.school_settings ss
  WHERE ss.school_id = v_reg.school_id;

  IF NOT coalesce(v_attendance_enabled, true) THEN
    RETURN jsonb_build_object('ok', true, 'sent', 0, 'skipped', 0, 'errors', '[]'::jsonb);
  END IF;

  BEGIN
    SELECT public.school_sms_service_active(v_reg.school_id) INTO v_sms_active;
  EXCEPTION WHEN OTHERS THEN
    v_sms_active := true;
  END;

  IF coalesce(v_sms_active, true) = false THEN
    RETURN jsonb_build_object('ok', true, 'sent', 0, 'skipped', 0, 'message', 'SMS not enabled for this school');
  END IF;

  SELECT coalesce(g.api_key, v.decrypted_secret) INTO v_api_key
  FROM (SELECT 1) x
  LEFT JOIN public.platform_sms_gateway g ON g.id = true
  LEFT JOIN vault.decrypted_secrets v ON v.name = 'ARKESEL_API_KEY'
  LIMIT 1;

  IF v_api_key IS NULL OR trim(v_api_key) = '' THEN
    RETURN jsonb_build_object(
      'error',
      'Arkesel API key is not configured. Run apply-send-attendance-sms-rpc.sql and INSERT your key into platform_sms_gateway.'
    );
  END IF;

  v_sender := coalesce(
    v_sender,
    substring(regexp_replace(coalesce(v_school_name, 'School'), '[^a-zA-Z0-9]', '', 'g') from 1 for 11),
    'School'
  );
  v_date_label := to_char(v_reg.register_date, 'DD Mon YYYY');

  FOR v_entry IN
    SELECT
      e.student_id,
      lower(trim(coalesce(e.attendance_status, ''))) AS status,
      e.time_in,
      coalesce(nullif(trim(p.full_name), ''), nullif(trim(st.full_name), ''), 'Student') AS student_name,
      st.guardian_id
    FROM public.register_student_entries e
    JOIN public.students st ON st.id = e.student_id
    LEFT JOIN public.profiles p ON p.id = st.profile_id
    WHERE e.register_id = p_register_id
  LOOP
    v_status := v_entry.status;
    v_student_name := v_entry.student_name;

    IF v_status = '' THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    v_should_notify :=
      (v_notify_absent AND v_status IN ('absent', 'sick', 'excused'))
      OR (v_notify_late AND v_status = 'late')
      OR (v_notify_present AND v_status = 'present');

    IF NOT v_should_notify THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    SELECT DISTINCT ON (pa.id)
      pa.id,
      pa.user_id,
      coalesce(
        nullif(trim(pa.phone), ''),
        nullif(trim(pa.emergency_contact), ''),
        nullif(trim(pr.phone), '')
      ) AS contact_raw,
      coalesce(nullif(trim(pr.full_name), ''), 'Parent') AS parent_name
    INTO v_parent
    FROM (
      SELECT psl.parent_id AS pid
      FROM public.parent_student_links psl
      WHERE psl.student_id = v_entry.student_id
      UNION
      SELECT v_entry.guardian_id
      WHERE v_entry.guardian_id IS NOT NULL
    ) src
    JOIN public.parents pa ON pa.id = src.pid
    LEFT JOIN public.profiles pr ON pr.id = pa.user_id
    WHERE coalesce(
      nullif(trim(pa.phone), ''),
      nullif(trim(pa.emergency_contact), ''),
      nullif(trim(pr.phone), '')
    ) IS NOT NULL
    ORDER BY pa.id
    LIMIT 1;

    IF v_parent.id IS NULL THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    IF v_parent.user_id IS NOT NULL THEN
      BEGIN
        INSERT INTO public.notifications (user_id, title, body, data, read)
        VALUES (
          v_parent.user_id,
          'Attendance Update',
          format(
            'Attendance Update: Your child, %s, was marked %s at %s on %s.',
            v_student_name,
            upper(v_status),
            v_school_name,
            v_date_label
          ),
          jsonb_build_object(
            'type', 'attendance',
            'student_id', v_entry.student_id,
            'register_id', p_register_id,
            'status', v_status,
            'date', v_reg.register_date,
            'school_name', v_school_name
          ),
          false
        );
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END IF;

    v_phone := public.normalize_sms_phone(v_parent.contact_raw);
    IF v_phone IS NULL THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    IF v_status = 'present' THEN
      v_message := format('%s: %s was marked PRESENT on %s.', v_school_name, v_student_name, v_date_label);
    ELSIF v_status = 'late' THEN
      v_message := format('%s: %s was marked LATE on %s.', v_school_name, v_student_name, v_date_label);
    ELSIF v_status IN ('absent', 'sick', 'excused') THEN
      v_message := format(
        '%s: %s was marked %s on %s. Please contact the school if necessary.',
        v_school_name,
        v_student_name,
        upper(v_status),
        v_date_label
      );
    ELSE
      v_message := format('%s: %s was marked %s on %s.', v_school_name, v_student_name, upper(v_status), v_date_label);
    END IF;

    INSERT INTO public.sms_logs (
      school_id, student_id, parent_id, register_id, phone_number, message, sms_status
    )
    VALUES (
      v_reg.school_id,
      v_entry.student_id,
      v_parent.id,
      p_register_id,
      v_phone,
      v_message,
      'queued'
    )
    RETURNING id INTO v_log_id;

    BEGIN
      v_credit := public.consume_school_sms_credit(v_reg.school_id, 1);
      IF coalesce(v_credit->>'ok', 'false') = 'false' THEN
        UPDATE public.sms_logs
        SET sms_status = 'failed', provider_response = v_credit
        WHERE id = v_log_id;
        v_errors := array_append(v_errors, v_student_name || ': ' || coalesce(v_credit->>'error', 'Insufficient SMS balance'));
        CONTINUE;
      END IF;

      v_arkesel_url := public.build_arkesel_sms_url(v_api_key, v_phone, v_sender, v_message);

      SELECT * INTO v_http
      FROM extensions.http((
        'GET',
        v_arkesel_url,
        NULL,
        NULL,
        NULL
      )::extensions.http_request);

      BEGIN
        v_body := v_http.content::jsonb;
      EXCEPTION WHEN OTHERS THEN
        v_body := jsonb_build_object('raw', v_http.content);
      END;

      IF v_http.status BETWEEN 200 AND 299 THEN
        UPDATE public.sms_logs
        SET sms_status = 'sent', provider_response = v_body, sent_at = now()
        WHERE id = v_log_id;
        v_sent := v_sent + 1;
      ELSE
        UPDATE public.sms_logs
        SET sms_status = 'failed', provider_response = v_body
        WHERE id = v_log_id;
        v_errors := array_append(v_errors, v_student_name || ': ' || coalesce(v_http.content, 'SMS provider error'));
      END IF;
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.sms_logs
      SET sms_status = 'failed', provider_response = jsonb_build_object('error', SQLERRM)
      WHERE id = v_log_id;
      v_errors := array_append(v_errors, v_student_name || ': ' || SQLERRM);
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'sent', v_sent,
    'skipped', v_skipped,
    'errors', to_jsonb(v_errors)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.normalize_sms_phone(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sms_phone_for_arkesel(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.url_query_encode(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.build_arkesel_sms_url(text, text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.send_attendance_sms_for_register(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
