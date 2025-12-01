-- Remove admin_key column from schools table (no longer needed)
ALTER TABLE public.schools DROP COLUMN IF EXISTS admin_key;

-- Update handle_new_user function to validate admin key against ADMIN_ID secret
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_school_id UUID;
  v_school_code TEXT;
  v_role app_role;
  v_admin_key TEXT;
BEGIN
  -- Get school_code and role from metadata
  v_role := (NEW.raw_user_meta_data->>'role')::app_role;
  v_school_code := NEW.raw_user_meta_data->>'school_code';
  
  -- Validate school exists
  SELECT id INTO v_school_id
  FROM public.schools
  WHERE school_code = v_school_code
  AND is_active = true;
  
  IF v_school_id IS NULL THEN
    RAISE EXCEPTION 'Invalid school code';
  END IF;
  
  -- If user is registering as admin, validate against ADMIN_ID secret
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
  END IF;
  
  -- Insert profile with school_id
  INSERT INTO public.profiles (id, email, full_name, school_id)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name', v_school_id);
  
  -- Insert user role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, v_role);
  
  RETURN NEW;
END;
$function$;