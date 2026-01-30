-- Update handle_new_user to use registration_number and gender from metadata
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
  v_role app_role;
  v_admin_key TEXT;
  v_super_admin_key TEXT;
  v_registration_number TEXT;
  v_gender TEXT;
BEGIN
  -- Get role and school_code from metadata
  v_role := (NEW.raw_user_meta_data->>'role')::app_role;
  v_school_code := NEW.raw_user_meta_data->>'school_code';
  v_registration_number := NEW.raw_user_meta_data->>'registration_number';
  v_gender := NEW.raw_user_meta_data->>'gender';
  
  -- Handle super_admin role
  IF v_role = 'super_admin' THEN
    -- Get the SUPER_ADMIN secret from vault
    SELECT decrypted_secret INTO v_super_admin_key
    FROM vault.decrypted_secrets
    WHERE name = 'SUPER_ADMIN'
    LIMIT 1;
    
    -- Validate the provided super admin key
    IF NEW.raw_user_meta_data->>'admin_key' != v_super_admin_key THEN
      RAISE EXCEPTION 'Invalid super admin key';
    END IF;
    
    -- Super admin doesn't need a school
    v_school_id := NULL;
    
    -- Insert profile without school_id
    INSERT INTO public.profiles (id, email, full_name, school_id)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name', v_school_id);
    
    -- Insert user role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, v_role);
    
    RETURN NEW;
  END IF;
  
  -- If user is registering as admin, create a new school
  IF v_role = 'admin' THEN
    -- Get the ADMIN_ID secret from vault
    SELECT decrypted_secret INTO v_admin_key
    FROM vault.decrypted_secrets
    WHERE name = 'ADMIN_ID'
    LIMIT 1;
    
    -- If vault secret doesn't exist, check environment variable as fallback
    IF v_admin_key IS NULL THEN
      v_admin_key := current_setting('app.settings.admin_id', true);
    END IF;
    
    -- Validate the provided admin key
    IF NEW.raw_user_meta_data->>'admin_key' != v_admin_key THEN
      RAISE EXCEPTION 'Invalid admin key';
    END IF;
    
    -- Get school name from metadata
    v_school_name := NEW.raw_user_meta_data->>'school_name';
    
    -- Check if school code already exists
    IF EXISTS (SELECT 1 FROM public.schools WHERE school_code = v_school_code) THEN
      RAISE EXCEPTION 'School code already exists. Please choose a different code.';
    END IF;
    
    -- Create new school
    INSERT INTO public.schools (school_code, school_name, is_active)
    VALUES (v_school_code, v_school_name, true)
    RETURNING id INTO v_school_id;
  ELSE
    -- For non-admin users, validate school exists
    SELECT id INTO v_school_id
    FROM public.schools
    WHERE school_code = v_school_code
    AND is_active = true;
    
    IF v_school_id IS NULL THEN
      RAISE EXCEPTION 'Invalid school code';
    END IF;
  END IF;
  
  -- Insert profile with school_id
  INSERT INTO public.profiles (id, email, full_name, school_id)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name', v_school_id);
  
  -- Insert user role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, v_role);
  
  -- Create role-specific records with registration_number and gender
  IF v_role = 'student' THEN
    INSERT INTO public.students (user_id, school_id, admission_no, gender)
    VALUES (
      NEW.id, 
      v_school_id, 
      NULLIF(v_registration_number, ''),
      NULLIF(v_gender, '')
    );
  ELSIF v_role = 'teacher' THEN
    INSERT INTO public.teachers (user_id, school_id, employee_no)
    VALUES (
      NEW.id, 
      v_school_id,
      NULLIF(v_registration_number, '')
    );
  ELSIF v_role = 'parent' THEN
    INSERT INTO public.parents (user_id, school_id)
    VALUES (NEW.id, v_school_id);
  END IF;
  
  RETURN NEW;
END;
$$;