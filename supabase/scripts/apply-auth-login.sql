-- Login RPC: resolve email from admission/employee number or email
-- Run in Supabase SQL Editor, then Settings → API → Reload schema

ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS admission_prefix TEXT;

ALTER TABLE public.parents
  ADD COLUMN IF NOT EXISTS phone TEXT;

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS admission_number text,
  ADD COLUMN IF NOT EXISTS full_name text;

UPDATE public.students
SET admission_number = admission_no
WHERE admission_number IS NULL AND admission_no IS NOT NULL;

CREATE INDEX IF NOT EXISTS students_admission_lookup_idx
  ON public.students (upper(coalesce(admission_no, admission_number)));

CREATE INDEX IF NOT EXISTS teachers_employee_lookup_idx
  ON public.teachers (school_id, upper(employee_no));

-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_student_by_admission_number(p_admission_number text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_num text := upper(trim(p_admission_number));
  v_student record;
  v_class_name text;
BEGIN
  IF v_num IS NULL OR length(v_num) < 5 THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Admission number is required.');
  END IF;

  SELECT
    s.id,
    s.school_id,
    s.user_id,
    s.guardian_id,
    coalesce(s.admission_no, s.admission_number) AS admission_number,
    coalesce(s.full_name, p.full_name) AS full_name,
    sch.school_name,
    sch.is_active AS school_active
  INTO v_student
  FROM public.students s
  LEFT JOIN public.profiles p ON p.id = s.user_id
  JOIN public.schools sch ON sch.id = s.school_id
  WHERE upper(coalesce(s.admission_no, s.admission_number)) = v_num
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'No student found with this admission number.');
  END IF;

  IF NOT v_student.school_active THEN
    RETURN jsonb_build_object('valid', false, 'error', 'This student''s school is not active.');
  END IF;

  IF v_student.user_id IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Student account is not active yet. Contact your school administrator.');
  END IF;

  SELECT c.name INTO v_class_name
  FROM public.students s
  LEFT JOIN public.classes c ON c.id = s.class_id
  WHERE s.id = v_student.id;

  RETURN jsonb_build_object(
    'valid', true,
    'student_id', v_student.id,
    'school_id', v_student.school_id,
    'student_name', v_student.full_name,
    'admission_number', v_student.admission_number,
    'class_name', coalesce(v_class_name, 'Not assigned'),
    'school_name', v_student.school_name,
    'has_guardian', v_student.guardian_id IS NOT NULL
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_student_by_admission_number(text) TO anon, authenticated;

-- ---------------------------------------------------------------------------
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
BEGIN
  IF v_raw IS NULL OR length(v_raw) < 3 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Enter your email or admission number.');
  END IF;

  IF position('@' in v_raw) > 0 THEN
    SELECT p.email, ur.role
    INTO v_email, v_role
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id
    WHERE lower(p.email) = lower(v_raw)
    LIMIT 1;

    IF v_email IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'No account found for this email.');
    END IF;

    RETURN jsonb_build_object('ok', true, 'email', v_email, 'role', v_role);
  END IF;

  SELECT p.email, ur.role
  INTO v_email, v_role
  FROM public.students s
  JOIN public.profiles p ON p.id = s.user_id
  JOIN public.user_roles ur ON ur.user_id = s.user_id
  WHERE upper(coalesce(s.admission_no, s.admission_number)) = v_upper
    AND s.user_id IS NOT NULL
  LIMIT 1;

  IF v_email IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'email', v_email, 'role', v_role);
  END IF;

  SELECT p.email, ur.role
  INTO v_email, v_role
  FROM public.teachers t
  JOIN public.profiles p ON p.id = t.user_id
  JOIN public.user_roles ur ON ur.user_id = t.user_id
  WHERE upper(coalesce(t.employee_no, '')) = v_upper
    AND t.user_id IS NOT NULL
  LIMIT 1;

  IF v_email IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'email', v_email, 'role', v_role);
  END IF;

  RETURN jsonb_build_object('ok', false, 'error', 'No account found. Use your email or admission/employee number.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_login_identifier(text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
