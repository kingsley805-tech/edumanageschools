-- Attendance SMS: resolve all linked parent contacts, verify Arkesel delivery, sync parent phone on link

CREATE OR REPLACE FUNCTION public.arkesel_sms_response_ok(p_status int, p_body jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    p_status BETWEEN 200 AND 299
    AND (
      lower(coalesce(p_body->>'code', '')) = 'ok'
      OR lower(coalesce(p_body->>'status', '')) IN ('ok', 'success')
      OR coalesce(p_body->>'message', '') ILIKE '%successfully%'
    );
$$;

CREATE OR REPLACE FUNCTION public.resolve_student_parents(
  p_student_id uuid,
  p_guardian_id uuid DEFAULT NULL
)
RETURNS TABLE (
  parent_id uuid,
  user_id uuid,
  parent_name text,
  contact_raw text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT ON (pa.id)
    pa.id,
    pa.user_id,
    coalesce(nullif(trim(pr.full_name), ''), 'Parent') AS parent_name,
    coalesce(
      nullif(trim(pa.phone), ''),
      nullif(trim(pa.emergency_contact), ''),
      nullif(trim(pr.phone), ''),
      nullif(trim(u.phone), '')
    ) AS contact_raw
  FROM (
    SELECT psl.parent_id AS pid
    FROM public.parent_student_links psl
    WHERE psl.student_id = p_student_id
    UNION
    SELECT p_guardian_id
    WHERE p_guardian_id IS NOT NULL
  ) src
  JOIN public.parents pa ON pa.id = src.pid
  LEFT JOIN public.profiles pr ON pr.id = pa.user_id
  LEFT JOIN auth.users u ON u.id = pa.user_id
  ORDER BY pa.id;
$$;

GRANT EXECUTE ON FUNCTION public.arkesel_sms_response_ok(int, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.resolve_student_parents(uuid, uuid) TO authenticated, service_role;

-- Keep parent.phone in sync with profile phone when linking children
CREATE OR REPLACE FUNCTION public.link_parent_children_by_admission(
  p_admission_numbers text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_parent record;
  v_raw text;
  v_num text;
  v_preview jsonb;
  v_student_id uuid;
  v_school_id uuid;
  v_linked int := 0;
  v_stored text[] := ARRAY[]::text[];
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;

  SELECT id, school_id, signup_child_admission_numbers
  INTO v_parent
  FROM public.parents
  WHERE user_id = v_uid;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Parent profile not found.');
  END IF;

  UPDATE public.parents pa
  SET phone = coalesce(nullif(trim(pa.phone), ''), nullif(trim(pr.phone), ''))
  FROM public.profiles pr
  WHERE pa.id = v_parent.id
    AND pa.user_id = pr.id
    AND coalesce(nullif(trim(pa.phone), ''), '') = ''
    AND coalesce(nullif(trim(pr.phone), ''), '') <> '';

  IF p_admission_numbers IS NULL OR array_length(p_admission_numbers, 1) IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No admission numbers provided.');
  END IF;

  FOREACH v_raw IN ARRAY p_admission_numbers
  LOOP
    v_num := upper(trim(v_raw));
    IF v_num IS NULL OR length(v_num) < 3 THEN
      CONTINUE;
    END IF;

    v_preview := public.resolve_student_by_admission_number(v_num);
    IF coalesce((v_preview->>'valid')::boolean, false) IS NOT TRUE THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', coalesce(v_preview->>'error', 'Invalid admission number'),
        'linked', v_linked
      );
    END IF;

    v_student_id := (v_preview->>'student_id')::uuid;
    v_school_id := (v_preview->>'school_id')::uuid;

    IF v_school_id IS DISTINCT FROM v_parent.school_id THEN
      RETURN jsonb_build_object('ok', false, 'error', 'All children must belong to your school.', 'linked', v_linked);
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = v_student_id
        AND s.guardian_id IS NOT NULL
        AND s.guardian_id <> v_parent.id
    ) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Student already linked to another parent.', 'linked', v_linked);
    END IF;

    INSERT INTO public.parent_student_links (parent_id, student_id, relationship)
    VALUES (v_parent.id, v_student_id, 'parent')
    ON CONFLICT (parent_id, student_id) DO NOTHING;

    UPDATE public.students SET guardian_id = v_parent.id WHERE id = v_student_id;

    v_linked := v_linked + 1;
    v_stored := array_append(v_stored, coalesce(v_preview->>'admission_number', v_num));
  END LOOP;

  IF v_linked = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No students were linked.', 'linked', 0);
  END IF;

  UPDATE public.parents
  SET signup_child_admission_numbers = (
    SELECT coalesce(array_agg(DISTINCT upper(trim(x))), '{}')
    FROM unnest(coalesce(v_parent.signup_child_admission_numbers, ARRAY[]::text[]) || v_stored) AS x
    WHERE x IS NOT NULL AND trim(x) <> ''
  )
  WHERE id = v_parent.id;

  RETURN jsonb_build_object('ok', true, 'linked', v_linked, 'admission_numbers', v_stored);
END;
$$;

-- Patch send_attendance_sms_for_register: all linked parents + Arkesel delivery check
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
  v_att_log_id uuid;
  v_arkesel_url text;
  v_entry_count int := 0;
  v_class_id uuid;
  v_attendance_date date;
  v_student_sms_sent int := 0;
  v_has_linked_parent boolean := false;
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
    RETURN jsonb_build_object('error', 'Attendance SMS is disabled in Register Settings.');
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

  BEGIN
    SELECT public.school_sms_service_active(v_reg.school_id) INTO v_sms_active;
  EXCEPTION WHEN OTHERS THEN
    v_sms_active := true;
  END;

  IF NOT coalesce(v_sms_active, false) THEN
    RETURN jsonb_build_object(
      'error',
      'School SMS is not enabled. Enable Parent SMS Notifications on your subscription or ask your platform administrator.',
      'sent', 0,
      'skipped', 0
    );
  END IF;

  v_sender := coalesce(
    v_sender,
    substring(regexp_replace(coalesce(v_school_name, 'School'), '[^a-zA-Z0-9]', '', 'g') from 1 for 11),
    'School'
  );
  v_date_label := to_char(v_reg.register_date, 'DD Mon YYYY');
  v_class_id := v_reg.class_id;
  v_attendance_date := v_reg.register_date;

  SELECT count(*) INTO v_entry_count
  FROM public.register_student_entries
  WHERE register_id = p_register_id;

  IF v_entry_count = 0 THEN
    SELECT count(*) INTO v_entry_count
    FROM public.attendance a
    WHERE a.class_id = v_class_id AND a.date = v_attendance_date;
  END IF;

  IF v_entry_count = 0 THEN
    RETURN jsonb_build_object('error', 'No attendance records found for this class and date.');
  END IF;

  FOR v_entry IN
    SELECT student_id, status, student_name, guardian_id
    FROM (
      SELECT
        e.student_id,
        lower(trim(coalesce(e.attendance_status, ''))) AS status,
        coalesce(nullif(trim(p.full_name), ''), nullif(trim(st.full_name), ''), 'Student') AS student_name,
        st.guardian_id
      FROM public.register_student_entries e
      JOIN public.students st ON st.id = e.student_id
      LEFT JOIN public.profiles p ON p.id = st.profile_id
      WHERE e.register_id = p_register_id
      UNION ALL
      SELECT
        a.student_id,
        lower(trim(coalesce(a.status, ''))) AS status,
        coalesce(nullif(trim(p.full_name), ''), nullif(trim(st.full_name), ''), 'Student') AS student_name,
        st.guardian_id
      FROM public.attendance a
      JOIN public.students st ON st.id = a.student_id
      LEFT JOIN public.profiles p ON p.id = st.profile_id
      WHERE NOT EXISTS (
        SELECT 1 FROM public.register_student_entries re WHERE re.register_id = p_register_id
      )
        AND a.class_id = v_class_id
        AND a.date = v_attendance_date
    ) src
    WHERE status <> ''
  LOOP
    v_status := v_entry.status;
    v_student_name := v_entry.student_name;
    v_student_sms_sent := 0;

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

    SELECT EXISTS (
      SELECT 1
      FROM public.resolve_student_parents(v_entry.student_id, v_entry.guardian_id)
    ) INTO v_has_linked_parent;

    IF NOT v_has_linked_parent THEN
      v_skipped := v_skipped + 1;
      v_errors := array_append(v_errors, v_student_name || ': no linked parent — link the child to a parent account first');
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

    FOR v_parent IN
      SELECT parent_id AS id, user_id, parent_name, contact_raw
      FROM public.resolve_student_parents(v_entry.student_id, v_entry.guardian_id)
    LOOP
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
        CONTINUE;
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

      v_att_log_id := NULL;
      BEGIN
        INSERT INTO public.attendance_sms_logs (
          school_id, student_id, parent_id, class_id, register_id,
          attendance_date, attendance_status, phone_number, message,
          sms_status, source, triggered_by
        )
        VALUES (
          v_reg.school_id, v_entry.student_id, v_parent.id, v_class_id, p_register_id,
          v_attendance_date, v_status, v_phone, v_message,
          'queued', 'teacher_attendance', v_uid
        )
        RETURNING id INTO v_att_log_id;
      EXCEPTION WHEN OTHERS THEN
        v_att_log_id := NULL;
      END;

      BEGIN
        v_credit := public.consume_school_sms_credit(v_reg.school_id, 1);
        IF coalesce(v_credit->>'ok', 'false') = 'false' THEN
          UPDATE public.sms_logs
          SET sms_status = 'failed', provider_response = v_credit
          WHERE id = v_log_id;
          IF v_att_log_id IS NOT NULL THEN
            UPDATE public.attendance_sms_logs
            SET sms_status = 'failed', error_message = coalesce(v_credit->>'error', 'Insufficient SMS balance'), provider_response = v_credit
            WHERE id = v_att_log_id;
          END IF;
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

        IF public.arkesel_sms_response_ok(v_http.status, v_body) THEN
          UPDATE public.sms_logs
          SET sms_status = 'sent', provider_response = v_body, sent_at = now()
          WHERE id = v_log_id;
          IF v_att_log_id IS NOT NULL THEN
            UPDATE public.attendance_sms_logs
            SET sms_status = 'sent', provider_response = v_body, sent_at = now()
            WHERE id = v_att_log_id;
          END IF;
          v_sent := v_sent + 1;
          v_student_sms_sent := v_student_sms_sent + 1;
        ELSE
          UPDATE public.sms_logs
          SET sms_status = 'failed', provider_response = v_body
          WHERE id = v_log_id;
          IF v_att_log_id IS NOT NULL THEN
            UPDATE public.attendance_sms_logs
            SET sms_status = 'failed',
                error_message = coalesce(v_body->>'message', v_http.content, 'SMS provider rejected the message'),
                provider_response = v_body
            WHERE id = v_att_log_id;
          END IF;
          v_errors := array_append(
            v_errors,
            v_student_name || ' → ' || coalesce(v_body->>'message', v_http.content, 'SMS delivery failed')
          );
        END IF;
      EXCEPTION WHEN OTHERS THEN
        UPDATE public.sms_logs
        SET sms_status = 'failed', provider_response = jsonb_build_object('error', SQLERRM)
        WHERE id = v_log_id;
        IF v_att_log_id IS NOT NULL THEN
          UPDATE public.attendance_sms_logs
          SET sms_status = 'failed', error_message = SQLERRM, provider_response = jsonb_build_object('error', SQLERRM)
          WHERE id = v_att_log_id;
        END IF;
        v_errors := array_append(v_errors, v_student_name || ': ' || SQLERRM);
      END;
    END LOOP;

    IF v_student_sms_sent = 0 AND v_has_linked_parent THEN
      v_skipped := v_skipped + 1;
      IF NOT EXISTS (
        SELECT 1
        FROM public.resolve_student_parents(v_entry.student_id, v_entry.guardian_id) rp
        WHERE coalesce(nullif(trim(rp.contact_raw), ''), '') <> ''
      ) THEN
        v_errors := array_append(
          v_errors,
          v_student_name || ': linked parent has no valid phone — add phone on the parent profile'
        );
      END IF;
    END IF;
  END LOOP;

  IF v_sent = 0 AND array_length(v_errors, 1) IS NULL AND v_skipped > 0 THEN
    RETURN jsonb_build_object(
      'ok', true,
      'sent', 0,
      'skipped', v_skipped,
      'errors', '[]'::jsonb,
      'message', 'No SMS sent. Enable absent/late/present notifications in Register Settings, or link a parent phone number.'
    );
  END IF;

  IF v_sent = 0 AND array_length(v_errors, 1) IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'sent', 0,
      'skipped', v_skipped,
      'errors', to_jsonb(v_errors),
      'message', v_errors[1]
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'sent', v_sent,
    'skipped', v_skipped,
    'errors', to_jsonb(v_errors),
    'message', CASE WHEN v_sent > 0 THEN format('%s SMS delivered to linked parent contact(s)', v_sent) ELSE NULL END
  );
END;
$$;

NOTIFY pgrst, 'reload schema';
