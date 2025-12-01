-- Drop and recreate the handle_new_user function with updated logic
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

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
BEGIN
  -- Get role and school_code from metadata
  v_role := (NEW.raw_user_meta_data->>'role')::app_role;
  v_school_code := NEW.raw_user_meta_data->>'school_code';
  
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
  
  RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();