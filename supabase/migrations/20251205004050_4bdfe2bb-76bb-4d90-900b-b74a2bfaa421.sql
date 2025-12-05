-- Allow admins to update their own school
CREATE POLICY "Admins can update own school" 
ON public.schools 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN profiles p ON p.id = ur.user_id
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('admin', 'super_admin')
    AND p.school_id = schools.id
  )
);

-- Super admins can update any of their assigned schools
CREATE POLICY "Super admins can update assigned schools" 
ON public.schools 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid() 
    AND ur.role = 'super_admin'
  )
  AND 
  EXISTS (
    SELECT 1 FROM super_admin_schools sas
    WHERE sas.user_id = auth.uid()
    AND sas.school_id = schools.id
  )
);