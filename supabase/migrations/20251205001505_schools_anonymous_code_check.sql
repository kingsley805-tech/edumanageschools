-- Allow anonymous users to check if a school code exists (for login validation)
CREATE POLICY "Allow anonymous school code verification" 
ON public.schools 
FOR SELECT 
TO anon
USING (true);

-- Allow authenticated users to view their own school
CREATE POLICY "Users can view their own school" 
ON public.schools 
FOR SELECT 
TO authenticated
USING (id = (SELECT school_id FROM profiles WHERE id = auth.uid()));

-- Create table for super_admin to manage multiple schools
CREATE TABLE IF NOT EXISTS public.super_admin_schools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, school_id)
);

ALTER TABLE public.super_admin_schools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view their assigned schools"
ON public.super_admin_schools
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Super admins can manage their school assignments"
ON public.super_admin_schools
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'super_admin'::app_role
  )
);