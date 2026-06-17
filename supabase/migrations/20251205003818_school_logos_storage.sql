-- Add logo_url column to schools table
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Create storage bucket for school logos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('school-logos', 'school-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policy for school logos - anyone can view
CREATE POLICY "School logos are publicly accessible" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'school-logos');

-- Storage policy - admins can upload logos for their school
CREATE POLICY "Admins can upload school logos" 
ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id = 'school-logos' 
  AND auth.uid() IS NOT NULL
  AND (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid() 
      AND ur.role IN ('admin', 'super_admin')
    )
  )
);

-- Storage policy - admins can update logos
CREATE POLICY "Admins can update school logos" 
ON storage.objects FOR UPDATE 
USING (
  bucket_id = 'school-logos' 
  AND auth.uid() IS NOT NULL
  AND (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid() 
      AND ur.role IN ('admin', 'super_admin')
    )
  )
);

-- Storage policy - admins can delete logos
CREATE POLICY "Admins can delete school logos" 
ON storage.objects FOR DELETE 
USING (
  bucket_id = 'school-logos' 
  AND auth.uid() IS NOT NULL
  AND (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid() 
      AND ur.role IN ('admin', 'super_admin')
    )
  )
);

-- Update handle_new_user to support super_admin with SUPER_ADMIN key
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school_id UUID;
  v_school_code TEXT;
  v_school_name TEXT;
  v_role app_role;
  v_admin_key TEXT;
  v_super_admin_key TEXT;
BEGIN
  -- Get role and school_code from metadata
  v_role := (NEW.raw_user_meta_data->>'role')::app_role;
  v_school_code := NEW.raw_user_meta_data->>'school_code';
  
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
    
    -- Super admin doesn't need a school, but we can optionally assign them to one
    -- For now, set school_id to NULL for super admins
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
  
  -- Create role-specific records
  IF v_role = 'student' THEN
    INSERT INTO public.students (user_id, school_id)
    VALUES (NEW.id, v_school_id);
  ELSIF v_role = 'teacher' THEN
    INSERT INTO public.teachers (user_id, school_id)
    VALUES (NEW.id, v_school_id);
  ELSIF v_role = 'parent' THEN
    INSERT INTO public.parents (user_id, school_id)
    VALUES (NEW.id, v_school_id);
  END IF;
  
  RETURN NEW;
END;
$$;