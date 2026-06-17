-- Create schools table for multi-tenancy
CREATE TABLE public.schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_code TEXT UNIQUE NOT NULL,
  school_name TEXT NOT NULL,
  admin_key TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  is_active BOOLEAN DEFAULT true
);

-- Enable RLS on schools
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;

-- Add school_id to profiles table FIRST
ALTER TABLE public.profiles ADD COLUMN school_id UUID REFERENCES public.schools(id);

-- Add school_id to other tables for multi-tenancy
ALTER TABLE public.students ADD COLUMN school_id UUID REFERENCES public.schools(id);
ALTER TABLE public.teachers ADD COLUMN school_id UUID REFERENCES public.schools(id);
ALTER TABLE public.parents ADD COLUMN school_id UUID REFERENCES public.schools(id);
ALTER TABLE public.classes ADD COLUMN school_id UUID REFERENCES public.schools(id);
ALTER TABLE public.subjects ADD COLUMN school_id UUID REFERENCES public.schools(id);

-- NOW create the policy that references school_id
CREATE POLICY "Admins can view own school"
ON public.schools
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN profiles p ON ur.user_id = p.id
    WHERE ur.user_id = auth.uid() 
    AND ur.role = 'admin'
    AND p.school_id = schools.id
  )
);

-- Update handle_new_user function to support school code and admin key validation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_school_id UUID;
  v_school_record RECORD;
  v_role app_role;
BEGIN
  -- Get school_code and role from metadata
  v_role := (NEW.raw_user_meta_data->>'role')::app_role;
  
  -- Validate school exists
  SELECT id, admin_key INTO v_school_record
  FROM public.schools
  WHERE school_code = NEW.raw_user_meta_data->>'school_code'
  AND is_active = true;
  
  IF v_school_record.id IS NULL THEN
    RAISE EXCEPTION 'Invalid school code';
  END IF;
  
  -- If user is registering as admin, validate admin key
  IF v_role = 'admin' THEN
    IF NEW.raw_user_meta_data->>'admin_key' != v_school_record.admin_key THEN
      RAISE EXCEPTION 'Invalid admin key';
    END IF;
  END IF;
  
  v_school_id := v_school_record.id;
  
  -- Insert profile with school_id
  INSERT INTO public.profiles (id, email, full_name, school_id)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name', v_school_id);
  
  -- Insert user role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, v_role);
  
  RETURN NEW;
END;
$function$;

-- Update RLS policies to filter by school_id

-- Students table policies
DROP POLICY IF EXISTS "Admins can view all students" ON public.students;
DROP POLICY IF EXISTS "Admins can view school students" ON public.students;
CREATE POLICY "Admins can view school students"
ON public.students
FOR SELECT
USING (
  has_role(auth.uid(), 'admin') 
  AND school_id = (SELECT school_id FROM profiles WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "Admins can manage students" ON public.students;
DROP POLICY IF EXISTS "Admins can manage school students" ON public.students;
CREATE POLICY "Admins can manage school students"
ON public.students
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin') 
  AND school_id = (SELECT school_id FROM profiles WHERE id = auth.uid())
);

CREATE POLICY "Admins can update school students"
ON public.students
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin') 
  AND school_id = (SELECT school_id FROM profiles WHERE id = auth.uid())
);

CREATE POLICY "Admins can delete school students"
ON public.students
FOR DELETE
USING (
  has_role(auth.uid(), 'admin') 
  AND school_id = (SELECT school_id FROM profiles WHERE id = auth.uid())
);

-- Teachers table policies
DROP POLICY IF EXISTS "Authenticated users can view basic teacher info" ON public.teachers;
DROP POLICY IF EXISTS "Users can view school teachers" ON public.teachers;
CREATE POLICY "Users can view school teachers"
ON public.teachers
FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND school_id = (SELECT school_id FROM profiles WHERE id = auth.uid())
);

-- Parents table policies
DROP POLICY IF EXISTS "Admins can view all parents" ON public.parents;
DROP POLICY IF EXISTS "Admins can view school parents" ON public.parents;
CREATE POLICY "Admins can view school parents"
ON public.parents
FOR SELECT
USING (
  has_role(auth.uid(), 'admin')
  AND school_id = (SELECT school_id FROM profiles WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "Admins can manage parents" ON public.parents;
DROP POLICY IF EXISTS "Admins can manage school parents" ON public.parents;
CREATE POLICY "Admins can insert school parents"
ON public.parents
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin')
  AND school_id = (SELECT school_id FROM profiles WHERE id = auth.uid())
);

CREATE POLICY "Admins can update school parents"
ON public.parents
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin')
  AND school_id = (SELECT school_id FROM profiles WHERE id = auth.uid())
);

CREATE POLICY "Admins can delete school parents"
ON public.parents
FOR DELETE
USING (
  has_role(auth.uid(), 'admin')
  AND school_id = (SELECT school_id FROM profiles WHERE id = auth.uid())
);

-- Classes table policies
DROP POLICY IF EXISTS "Admins can manage classes" ON public.classes;
DROP POLICY IF EXISTS "Admins can manage school classes" ON public.classes;
CREATE POLICY "Admins can insert school classes"
ON public.classes
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin')
  AND school_id = (SELECT school_id FROM profiles WHERE id = auth.uid())
);

CREATE POLICY "Admins can update school classes"
ON public.classes
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin')
  AND school_id = (SELECT school_id FROM profiles WHERE id = auth.uid())
);

CREATE POLICY "Admins can delete school classes"
ON public.classes
FOR DELETE
USING (
  has_role(auth.uid(), 'admin')
  AND school_id = (SELECT school_id FROM profiles WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "Everyone can view classes" ON public.classes;
DROP POLICY IF EXISTS "Users can view school classes" ON public.classes;
CREATE POLICY "Users can view school classes"
ON public.classes
FOR SELECT
USING (
  school_id = (SELECT school_id FROM profiles WHERE id = auth.uid())
);

-- Subjects table policies
DROP POLICY IF EXISTS "Admins can manage subjects" ON public.subjects;
DROP POLICY IF EXISTS "Admins can manage school subjects" ON public.subjects;
CREATE POLICY "Admins can insert school subjects"
ON public.subjects
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin')
  AND school_id = (SELECT school_id FROM profiles WHERE id = auth.uid())
);

CREATE POLICY "Admins can update school subjects"
ON public.subjects
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin')
  AND school_id = (SELECT school_id FROM profiles WHERE id = auth.uid())
);

CREATE POLICY "Admins can delete school subjects"
ON public.subjects
FOR DELETE
USING (
  has_role(auth.uid(), 'admin')
  AND school_id = (SELECT school_id FROM profiles WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "Everyone can view subjects" ON public.subjects;
DROP POLICY IF EXISTS "Users can view school subjects" ON public.subjects;
CREATE POLICY "Users can view school subjects"
ON public.subjects
FOR SELECT
USING (
  school_id = (SELECT school_id FROM profiles WHERE id = auth.uid())
);

-- Insert a demo school for testing
INSERT INTO public.schools (school_code, school_name, admin_key)
VALUES ('DEMO2025', 'Demo School', 'ADMIN2025')
ON CONFLICT (school_code) DO NOTHING;