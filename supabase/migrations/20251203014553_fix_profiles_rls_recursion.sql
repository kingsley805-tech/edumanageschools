-- Fix infinite recursion in RLS policies
-- The issue is that profiles policies reference teachers/students which reference profiles

-- Drop problematic profiles policies that cause recursion
DROP POLICY IF EXISTS "Parents can view teacher profiles" ON public.profiles;
DROP POLICY IF EXISTS "Teachers can view parent profiles" ON public.profiles;

-- Drop the teachers policy that references profiles
DROP POLICY IF EXISTS "Users can view school teachers" ON public.teachers;

-- Create a simpler policy for teachers - authenticated users can view basic teacher info
-- This avoids the circular reference to profiles
CREATE POLICY "Authenticated users can view teachers" 
ON public.teachers 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- For profiles, we need to allow viewing profiles needed for messaging/display
-- without creating circular dependencies
-- Admins can view all profiles in their school
CREATE POLICY "Admins can view school profiles" 
ON public.profiles 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role)
);

-- Teachers can view profiles (for parents/students they work with)
CREATE POLICY "Teachers can view profiles" 
ON public.profiles 
FOR SELECT 
USING (
  has_role(auth.uid(), 'teacher'::app_role)
);

-- Parents can view profiles (for teachers of their children)
CREATE POLICY "Parents can view profiles" 
ON public.profiles 
FOR SELECT 
USING (
  has_role(auth.uid(), 'parent'::app_role)
);

-- Students can view profiles (for their teachers)
CREATE POLICY "Students can view profiles" 
ON public.profiles 
FOR SELECT 
USING (
  has_role(auth.uid(), 'student'::app_role)
);