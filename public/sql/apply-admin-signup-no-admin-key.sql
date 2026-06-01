-- Admin signup: no admin key; create pending subscription for new schools

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_school_id uuid;
  v_school_code text;
  v_school_name text;
  v_school_id_meta text;
  v_role public.app_role;
  v_super_admin_key text;
  v_registration_number text;
  v_gender text;
  v_phone text;
  v_admission_prefix text;
  v_full_name text;
BEGIN
  v_role := (NEW.raw_user_meta_data->>'role')::public.app_role;
  v_school_code := NULLIF(trim(NEW.raw_user_meta_data->>'school_code'), '');
  v_school_id_meta := NULLIF(trim(NEW.raw_user_meta_data->>'school_id'), '');
  v_registration_number := NULLIF(trim(NEW.raw_user_meta_data->>'registration_number'), '');
  v_gender := NULLIF(trim(NEW.raw_user_meta_data->>'gender'), '');
  v_phone := NULLIF(trim(NEW.raw_user_meta_data->>'phone'), '');
  v_admission_prefix := NULLIF(trim(NEW.raw_user_meta_data->>'admission_prefix'), '');
  v_full_name := NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), '');

  IF v_role = 'super_admin' THEN
    SELECT decrypted_secret INTO v_super_admin_key
    FROM vault.decrypted_secrets
    WHERE name = 'SUPER_ADMIN'
    LIMIT 1;

    IF NEW.raw_user_meta_data->>'admin_key' IS DISTINCT FROM v_super_admin_key THEN
      RAISE EXCEPTION 'Invalid super admin key';
    END IF;

    INSERT INTO public.profiles (id, email, full_name, school_id)
    VALUES (NEW.id, NEW.email, v_full_name, NULL);

    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, v_role);
    RETURN NEW;
  END IF;

  IF v_role = 'admin' THEN
    v_school_name := NEW.raw_user_meta_data->>'school_name';

    IF v_school_code IS NULL OR v_school_name IS NULL THEN
      RAISE EXCEPTION 'School name and school code are required';
    END IF;

    IF EXISTS (SELECT 1 FROM public.schools WHERE school_code = upper(v_school_code)) THEN
      RAISE EXCEPTION 'School code already exists. Please choose a different code.';
    END IF;

    INSERT INTO public.schools (school_code, school_name, is_active, admission_prefix)
    VALUES (
      upper(v_school_code),
      v_school_name,
      true,
      upper(coalesce(
        v_admission_prefix,
        CASE
          WHEN length(regexp_replace(coalesce(v_school_name, ''), '[^a-zA-Z]', '', 'g')) >= 3 THEN
            substring(regexp_replace(coalesce(v_school_name, ''), '[^a-zA-Z]', '', 'g') from 1 for 3)
          WHEN length(regexp_replace(coalesce(v_school_name, ''), '[^a-zA-Z0-9]', '', 'g')) >= 3 THEN
            substring(regexp_replace(coalesce(v_school_name, ''), '[^a-zA-Z0-9]', '', 'g') from 1 for 3)
          ELSE upper(left(coalesce(v_school_code, 'SCH'), 3))
        END
      ))
    )
    RETURNING id INTO v_school_id;

    INSERT INTO public.school_subscriptions (school_id, status, read_only_on_expiry, block_login_on_expiry)
    VALUES (v_school_id, 'pending', true, false);

    PERFORM public.log_subscription_audit(
      v_school_id,
      'organization_registered',
      jsonb_build_object('school_code', upper(v_school_code), 'admin_user_id', NEW.id),
      NULL,
      NEW.id
    );
  ELSE
    IF v_school_id_meta IS NOT NULL THEN
      SELECT id INTO v_school_id
      FROM public.schools
      WHERE id = v_school_id_meta::uuid
        AND is_active = true;
    END IF;

    IF v_school_id IS NULL AND v_school_code IS NOT NULL THEN
      SELECT id INTO v_school_id
      FROM public.schools
      WHERE school_code = upper(v_school_code)
        AND is_active = true;
    END IF;

    IF v_school_id IS NULL THEN
      RAISE EXCEPTION 'Could not determine school for this account. Use a valid admission number or contact your school.';
    END IF;
  END IF;

  INSERT INTO public.profiles (id, email, full_name, school_id, phone)
  VALUES (NEW.id, NEW.email, v_full_name, v_school_id, v_phone);

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, v_role);

  IF v_role = 'student' THEN
    INSERT INTO public.students (user_id, school_id, admission_no, admission_number, gender, full_name)
    VALUES (
      NEW.id,
      v_school_id,
      v_registration_number,
      v_registration_number,
      v_gender,
      v_full_name
    );
  ELSIF v_role = 'teacher' THEN
    INSERT INTO public.teachers (user_id, school_id, employee_no)
    VALUES (NEW.id, v_school_id, v_registration_number);
  ELSIF v_role = 'parent' THEN
    INSERT INTO public.parents (user_id, school_id, phone)
    VALUES (NEW.id, v_school_id, v_phone);
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'This admission or employee number is already registered.';
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Signup failed: %', SQLERRM;
END;
$$;

NOTIFY pgrst, 'reload schema';
