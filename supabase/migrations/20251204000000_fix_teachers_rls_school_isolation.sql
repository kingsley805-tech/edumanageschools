-- Fix teachers RLS policy to enforce school isolation
-- The previous policy "Authenticated users can view teachers" was too permissive
-- and allowed users to see teachers from all schools

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can view teachers" ON public.teachers;

-- Create a proper school-isolated policy for teachers
-- Admins can view all teachers in their school
CREATE POLICY "Admins can view school teachers"
ON public.teachers
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND school_id = get_user_school_id(auth.uid())
);

-- Teachers can view other teachers in their school (for collaboration, messaging, etc.)
CREATE POLICY "Teachers can view school teachers"
ON public.teachers
FOR SELECT
USING (
  has_role(auth.uid(), 'teacher'::app_role)
  AND school_id = get_user_school_id(auth.uid())
);

-- Parents can view teachers of their children's classes
CREATE POLICY "Parents can view children teachers"
ON public.teachers
FOR SELECT
USING (
  has_role(auth.uid(), 'parent'::app_role)
  AND school_id = get_user_school_id(auth.uid())
);

-- Students can view teachers in their school (their own teachers)
CREATE POLICY "Students can view school teachers"
ON public.teachers
FOR SELECT
USING (
  has_role(auth.uid(), 'student'::app_role)
  AND school_id = get_user_school_id(auth.uid())
);

-- Admins can manage teachers in their school
CREATE POLICY "Admins can insert school teachers"
ON public.teachers
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  AND school_id = get_user_school_id(auth.uid())
);

CREATE POLICY "Admins can update school teachers"
ON public.teachers
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND school_id = get_user_school_id(auth.uid())
);

CREATE POLICY "Admins can delete school teachers"
ON public.teachers
FOR DELETE
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND school_id = get_user_school_id(auth.uid())
);

-- Teachers can update their own profile
CREATE POLICY "Teachers can update own profile"
ON public.teachers
FOR UPDATE
USING (auth.uid() = user_id);
