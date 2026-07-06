-- Teacher account status: activate/deactivate with login blocking and audit trail

ALTER TABLE public.teachers
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS deactivated_at timestamptz,
  ADD COLUMN IF NOT EXISTS deactivated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS module text;

CREATE INDEX IF NOT EXISTS idx_teachers_school_active ON public.teachers(school_id, is_active);

-- Returns a login block message when the teacher account is inactive, else NULL.
CREATE OR REPLACE FUNCTION public.teacher_login_blocked_message(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_active boolean;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT t.is_active INTO v_active
  FROM public.teachers t
  WHERE t.user_id = p_user_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_active IS FALSE THEN
    RETURN 'Your teacher account has been deactivated. Please contact your school administrator.';
  END IF;

  RETURN NULL;
END;
$$;

-- Check whether the current authenticated teacher may use the portal.
CREATE OR REPLACE FUNCTION public.check_my_teacher_account_active()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_msg text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;

  v_msg := public.teacher_login_blocked_message(auth.uid());

  IF v_msg IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'active', false, 'error', v_msg);
  END IF;

  RETURN jsonb_build_object('ok', true, 'active', true);
END;
$$;

-- Block login for deactivated teachers (email or employee number).
CREATE OR REPLACE FUNCTION public.resolve_login_identifier(p_identifier text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_raw text := trim(p_identifier);
  v_upper text := upper(v_raw);
  v_email text;
  v_role public.app_role;
  v_user_id uuid;
  v_block text;
BEGIN
  IF v_raw IS NULL OR length(v_raw) < 3 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Enter your email or admission number.');
  END IF;

  IF position('@' in v_raw) > 0 THEN
    SELECT p.id, p.email, ur.role
    INTO v_user_id, v_email, v_role
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id
    WHERE lower(p.email) = lower(v_raw)
    LIMIT 1;

    IF v_email IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'No account found for this email.');
    END IF;

    IF v_role = 'teacher'::public.app_role THEN
      v_block := public.teacher_login_blocked_message(v_user_id);
      IF v_block IS NOT NULL THEN
        RETURN jsonb_build_object(
          'ok', false,
          'error', v_block,
          'error_code', 'teacher_account_deactivated'
        );
      END IF;
    END IF;

    RETURN jsonb_build_object('ok', true, 'email', v_email, 'role', v_role);
  END IF;

  SELECT p.id, p.email, ur.role
  INTO v_user_id, v_email, v_role
  FROM public.students s
  JOIN public.profiles p ON p.id = s.user_id
  JOIN public.user_roles ur ON ur.user_id = s.user_id
  WHERE upper(coalesce(s.admission_no, s.admission_number)) = v_upper
    AND s.user_id IS NOT NULL
  LIMIT 1;

  IF v_email IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'email', v_email, 'role', v_role);
  END IF;

  SELECT p.id, p.email, ur.role
  INTO v_user_id, v_email, v_role
  FROM public.teachers t
  JOIN public.profiles p ON p.id = t.user_id
  JOIN public.user_roles ur ON ur.user_id = t.user_id
  WHERE upper(coalesce(t.employee_no, '')) = v_upper
    AND t.user_id IS NOT NULL
  LIMIT 1;

  IF v_email IS NOT NULL THEN
    v_block := public.teacher_login_blocked_message(v_user_id);
    IF v_block IS NOT NULL THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', v_block,
        'error_code', 'teacher_account_deactivated'
      );
    END IF;

    RETURN jsonb_build_object('ok', true, 'email', v_email, 'role', v_role);
  END IF;

  RETURN jsonb_build_object('ok', false, 'error', 'No account found. Use your email or admission/employee number.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.teacher_login_blocked_message(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_my_teacher_account_active() TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_login_identifier(text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
