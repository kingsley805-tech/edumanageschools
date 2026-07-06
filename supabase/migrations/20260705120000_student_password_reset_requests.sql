-- Student password reset request workflow (admin-mediated, no plain-text passwords stored)

CREATE TABLE IF NOT EXISTS public.student_password_reset_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  student_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  admission_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'cancelled')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  processed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  parent_dashboard_delivered BOOLEAN,
  sms_delivered BOOLEAN,
  delivery_details JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address TEXT,
  user_agent TEXT,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS student_password_reset_requests_school_status_idx
  ON public.student_password_reset_requests (school_id, status, requested_at DESC);

CREATE INDEX IF NOT EXISTS student_password_reset_requests_admission_idx
  ON public.student_password_reset_requests (admission_number, requested_at DESC);

CREATE INDEX IF NOT EXISTS student_password_reset_requests_student_idx
  ON public.student_password_reset_requests (student_id, requested_at DESC);

ALTER TABLE public.student_password_reset_requests ENABLE ROW LEVEL SECURITY;

-- School admins can view requests for their school
CREATE POLICY student_password_reset_requests_admin_select
  ON public.student_password_reset_requests
  FOR SELECT
  TO authenticated
  USING (
    public.is_platform_super_admin()
    OR school_id = public.get_user_school_id(auth.uid())
  );

-- School admins can update (mark cancelled etc.) — processing goes through edge function
CREATE POLICY student_password_reset_requests_admin_update
  ON public.student_password_reset_requests
  FOR UPDATE
  TO authenticated
  USING (
    public.is_platform_super_admin()
    OR (
      school_id = public.get_user_school_id()
      AND EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.role IN ('admin', 'school_admin', 'super_admin')
      )
    )
  );

GRANT SELECT, UPDATE ON public.student_password_reset_requests TO authenticated;
GRANT ALL ON public.student_password_reset_requests TO service_role;

-- Notify school admins of a new student password reset request
CREATE OR REPLACE FUNCTION public.notify_admins_student_password_reset(
  p_school_id UUID,
  p_request_id UUID,
  p_student_name TEXT,
  p_admission_number TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, title, body, data)
  SELECT
    p.id,
    'Student password reset requested',
    format(
      'Password reset requested for %s (%s). Open Student Password Recovery to process.',
      coalesce(p_student_name, 'Student'),
      p_admission_number
    ),
    jsonb_build_object(
      'type', 'student_password_reset',
      'request_id', p_request_id,
      'admission_number', p_admission_number,
      'link', '/admin/student-password-recovery'
    )
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.id
  WHERE p.school_id = p_school_id
    AND ur.role IN ('admin', 'school_admin');
END;
$$;

-- Student (anon) submits a password reset request by admission number
CREATE OR REPLACE FUNCTION public.request_student_password_reset(
  p_admission_number TEXT,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admission TEXT;
  v_student RECORD;
  v_existing UUID;
  v_request_id UUID;
BEGIN
  v_admission := upper(trim(coalesce(p_admission_number, '')));
  IF v_admission = '' THEN
    RETURN jsonb_build_object('ok', true, 'message', 'If your admission number is registered, your school administrator has been notified.');
  END IF;

  SELECT
    s.id,
    s.user_id,
    s.school_id,
    coalesce(s.admission_number, s.admission_no) AS admission_number,
    coalesce(sp.full_name, s.full_name, 'Student') AS student_name
  INTO v_student
  FROM public.students s
  LEFT JOIN public.profiles sp ON sp.id = s.user_id
  WHERE upper(coalesce(s.admission_number, s.admission_no, '')) = v_admission
  LIMIT 1;

  IF v_student.id IS NULL OR v_student.user_id IS NULL THEN
    -- Generic response to reduce enumeration
    RETURN jsonb_build_object(
      'ok', true,
      'message', 'If your admission number is registered, your school administrator has been notified.'
    );
  END IF;

  -- Rate limit: one pending request per student; max 3 requests per 24h
  SELECT id INTO v_existing
  FROM public.student_password_reset_requests
  WHERE student_id = v_student.id
    AND status = 'pending'
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ok', true,
      'message', 'A password reset request is already pending. Your administrator will process it soon.',
      'already_pending', true
    );
  END IF;

  IF (
    SELECT count(*)
    FROM public.student_password_reset_requests
    WHERE student_id = v_student.id
      AND requested_at > now() - interval '24 hours'
  ) >= 3 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'rate_limited', true,
      'message', 'Too many reset requests today. Please contact your school administrator directly.'
    );
  END IF;

  INSERT INTO public.student_password_reset_requests (
    school_id,
    student_id,
    student_user_id,
    admission_number,
    status,
    ip_address,
    user_agent
  ) VALUES (
    v_student.school_id,
    v_student.id,
    v_student.user_id,
    v_student.admission_number,
    'pending',
    p_ip_address,
    p_user_agent
  )
  RETURNING id INTO v_request_id;

  PERFORM public.notify_admins_student_password_reset(
    v_student.school_id,
    v_request_id,
    v_student.student_name,
    v_student.admission_number
  );

  INSERT INTO public.audit_logs (
    school_id,
    action_type,
    entity_type,
    entity_id,
    module,
    details
  ) VALUES (
    v_student.school_id,
    'student_password_reset_requested',
    'student_password_reset',
    v_request_id,
    'auth',
    jsonb_build_object(
      'admission_number', v_student.admission_number,
      'student_id', v_student.id,
      'student_user_id', v_student.user_id,
      'ip_address', p_ip_address
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'message', 'Your password reset request has been submitted. Your school administrator will verify your admission number and contact your parent/guardian with next steps.',
    'request_id', v_request_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_student_password_reset(TEXT, TEXT, TEXT) TO anon, authenticated, service_role;

-- Admin overview: all students with parent info and latest reset status
CREATE OR REPLACE FUNCTION public.get_student_password_recovery_overview(p_school_id UUID)
RETURNS TABLE (
  student_id UUID,
  student_user_id UUID,
  student_name TEXT,
  admission_number TEXT,
  class_name TEXT,
  parent_name TEXT,
  parent_phone TEXT,
  parent_has_dashboard BOOLEAN,
  reset_status TEXT,
  reset_requested_at TIMESTAMPTZ,
  reset_request_id UUID,
  parent_notification_sent BOOLEAN,
  sms_sent BOOLEAN,
  processed_at TIMESTAMPTZ,
  processed_by_name TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    public.is_platform_super_admin()
    OR (
      p_school_id = public.get_user_school_id(auth.uid())
      AND EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.role IN ('admin', 'school_admin', 'super_admin')
      )
    )
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  WITH latest_request AS (
    SELECT DISTINCT ON (r.student_id)
      r.id,
      r.student_id,
      r.status,
      r.requested_at,
      r.parent_dashboard_delivered,
      r.sms_delivered,
      r.processed_at,
      r.processed_by
    FROM public.student_password_reset_requests r
    WHERE r.school_id = p_school_id
    ORDER BY r.student_id, r.requested_at DESC
  ),
  primary_parent AS (
    SELECT DISTINCT ON (s.id)
      s.id AS student_id,
      coalesce(pp.full_name, '—') AS parent_name,
      coalesce(nullif(trim(p.phone), ''), nullif(trim(pp.phone), ''), '—') AS parent_phone,
      (p.user_id IS NOT NULL) AS parent_has_dashboard
    FROM public.students s
    LEFT JOIN public.parents p ON p.id = s.guardian_id
    LEFT JOIN public.profiles pp ON pp.id = p.user_id
    WHERE s.school_id = p_school_id
    ORDER BY s.id, (p.user_id IS NOT NULL) DESC, p.created_at NULLS LAST
  ),
  linked_parent AS (
    SELECT DISTINCT ON (s.id)
      s.id AS student_id,
      coalesce(pp.full_name, '—') AS parent_name,
      coalesce(nullif(trim(p.phone), ''), nullif(trim(pp.phone), ''), '—') AS parent_phone,
      (p.user_id IS NOT NULL) AS parent_has_dashboard
    FROM public.students s
    JOIN public.parent_student_links psl ON psl.student_id = s.id
    JOIN public.parents p ON p.id = psl.parent_id
    LEFT JOIN public.profiles pp ON pp.id = p.user_id
    WHERE s.school_id = p_school_id
      AND NOT EXISTS (SELECT 1 FROM public.students s2 WHERE s2.id = s.id AND s2.guardian_id IS NOT NULL)
    ORDER BY s.id, (p.user_id IS NOT NULL) DESC
  )
  SELECT
    s.id,
    s.user_id,
    coalesce(sp.full_name, s.full_name, '—')::TEXT,
    coalesce(s.admission_number, s.admission_no, '—')::TEXT,
    coalesce(c.name, '—')::TEXT,
    coalesce(pr.parent_name, lp.parent_name, '—')::TEXT,
    coalesce(pr.parent_phone, lp.parent_phone, '—')::TEXT,
    coalesce(pr.parent_has_dashboard, lp.parent_has_dashboard, false),
    coalesce(lr.status, 'none')::TEXT,
    lr.requested_at,
    lr.id,
    coalesce(lr.parent_dashboard_delivered, false),
    coalesce(lr.sms_delivered, false),
    lr.processed_at,
    coalesce(ap.full_name, '—')::TEXT
  FROM public.students s
  LEFT JOIN public.profiles sp ON sp.id = s.user_id
  LEFT JOIN public.classes c ON c.id = s.class_id
  LEFT JOIN primary_parent pr ON pr.student_id = s.id
  LEFT JOIN linked_parent lp ON lp.student_id = s.id AND pr.student_id IS NULL
  LEFT JOIN latest_request lr ON lr.student_id = s.id
  LEFT JOIN public.profiles ap ON ap.id = lr.processed_by
  WHERE s.school_id = p_school_id
    AND s.user_id IS NOT NULL
  ORDER BY coalesce(lr.requested_at, '1970-01-01'::timestamptz) DESC, coalesce(sp.full_name, s.full_name);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_student_password_recovery_overview(UUID) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
