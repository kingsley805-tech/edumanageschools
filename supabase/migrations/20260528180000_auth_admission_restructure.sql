-- Auth restructure: standardized admission numbers, login without school code, parent linking

-- School admission prefix (e.g. MINGO) — distinct from login school_code if needed
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS admission_prefix TEXT;

UPDATE public.schools
SET admission_prefix = COALESCE(NULLIF(trim(admission_prefix), ''), school_code)
WHERE admission_prefix IS NULL OR trim(admission_prefix) = '';

-- Parent contact on signup
ALTER TABLE public.parents
  ADD COLUMN IF NOT EXISTS phone TEXT;

-- Composite uniqueness per school (allow same format across tenants)
DROP INDEX IF EXISTS students_admission_no_key;
CREATE UNIQUE INDEX IF NOT EXISTS students_school_admission_no_uidx
  ON public.students (school_id, upper(coalesce(admission_no, admission_number)))
  WHERE coalesce(admission_no, admission_number) IS NOT NULL AND school_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS students_admission_lookup_idx
  ON public.students (upper(coalesce(admission_no, admission_number)));

CREATE INDEX IF NOT EXISTS teachers_employee_lookup_idx
  ON public.teachers (school_id, upper(employee_no));

-- Normalize admission_number column from admission_no
UPDATE public.students
SET admission_number = admission_no
WHERE admission_number IS NULL AND admission_no IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Resolve student by admission number (parent signup preview + validation)
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
  v_school_name text;
  v_student_name text;
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
-- Resolve login identifier → auth email (email or admission / employee number)
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

  -- Email login
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

  -- Student admission number
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

  -- Teacher employee number
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

-- ---------------------------------------------------------------------------
-- Updated handle_new_user — school_id metadata for parents; admission_prefix on new schools
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_school_id UUID;
  v_school_code TEXT;
  v_school_name TEXT;
  v_school_id_meta TEXT;
  v_role app_role;
  v_admin_key TEXT;
  v_super_admin_key TEXT;
  v_registration_number TEXT;
  v_gender TEXT;
  v_phone TEXT;
  v_admission_prefix TEXT;
BEGIN
  v_role := (NEW.raw_user_meta_data->>'role')::app_role;
  v_school_code := NULLIF(trim(NEW.raw_user_meta_data->>'school_code'), '');
  v_school_id_meta := NULLIF(trim(NEW.raw_user_meta_data->>'school_id'), '');
  v_registration_number := NULLIF(trim(NEW.raw_user_meta_data->>'registration_number'), '');
  v_gender := NULLIF(trim(NEW.raw_user_meta_data->>'gender'), '');
  v_phone := NULLIF(trim(NEW.raw_user_meta_data->>'phone'), '');
  v_admission_prefix := NULLIF(trim(NEW.raw_user_meta_data->>'admission_prefix'), '');

  IF v_role = 'super_admin' THEN
    SELECT decrypted_secret INTO v_super_admin_key
    FROM vault.decrypted_secrets
    WHERE name = 'SUPER_ADMIN'
    LIMIT 1;

    IF NEW.raw_user_meta_data->>'admin_key' IS DISTINCT FROM v_super_admin_key THEN
      RAISE EXCEPTION 'Invalid super admin key';
    END IF;

    INSERT INTO public.profiles (id, email, full_name, school_id)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name', NULL);

    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, v_role);

    RETURN NEW;
  END IF;

  IF v_role = 'admin' THEN
    SELECT decrypted_secret INTO v_admin_key
    FROM vault.decrypted_secrets
    WHERE name = 'ADMIN_ID'
    LIMIT 1;

    IF v_admin_key IS NULL THEN
      v_admin_key := current_setting('app.settings.admin_id', true);
    END IF;

    IF NEW.raw_user_meta_data->>'admin_key' IS DISTINCT FROM v_admin_key THEN
      RAISE EXCEPTION 'Invalid admin key';
    END IF;

    v_school_name := NEW.raw_user_meta_data->>'school_name';

    IF EXISTS (SELECT 1 FROM public.schools WHERE school_code = upper(v_school_code)) THEN
      RAISE EXCEPTION 'School code already exists. Please choose a different code.';
    END IF;

    INSERT INTO public.schools (school_code, school_name, is_active, admission_prefix)
    VALUES (
      upper(v_school_code),
      v_school_name,
      true,
      upper(coalesce(v_admission_prefix, v_school_code))
    )
    RETURNING id INTO v_school_id;
  ELSE
    IF v_school_id_meta IS NOT NULL THEN
      SELECT id INTO v_school_id
      FROM public.schools
      WHERE id = v_school_id_meta::uuid
        AND is_active = true;
    ELSIF v_school_code IS NOT NULL THEN
      SELECT id INTO v_school_id
      FROM public.schools
      WHERE school_code = upper(v_school_code)
        AND is_active = true;
    END IF;

    IF v_school_id IS NULL THEN
      RAISE EXCEPTION 'Could not determine school for this account. Use a valid admission number or contact your school.';
    END IF;
  END IF;

  INSERT INTO public.profiles (id, email, full_name, school_id)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name', v_school_id);

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, v_role);

  IF v_role = 'student' THEN
    INSERT INTO public.students (user_id, school_id, admission_no, admission_number, gender, full_name)
    VALUES (
      NEW.id,
      v_school_id,
      v_registration_number,
      v_registration_number,
      v_gender,
      NEW.raw_user_meta_data->>'full_name'
    );
  ELSIF v_role = 'teacher' THEN
    INSERT INTO public.teachers (user_id, school_id, employee_no)
    VALUES (NEW.id, v_school_id, v_registration_number);
  ELSIF v_role = 'parent' THEN
    INSERT INTO public.parents (user_id, school_id, phone)
    VALUES (NEW.id, v_school_id, v_phone);
  END IF;

  RETURN NEW;
END;
$$;
