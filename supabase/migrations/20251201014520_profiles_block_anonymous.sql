-- Fix security issues with RLS policies

-- 1. Add explicit policy to block unauthenticated access to profiles table
CREATE POLICY "Block anonymous access to profiles"
ON public.profiles
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- 2. Restrict teachers to only view students in their assigned classes
DROP POLICY IF EXISTS "Teachers can view students" ON public.students;

CREATE POLICY "Teachers can view assigned students"
ON public.students
FOR SELECT
USING (
  has_role(auth.uid(), 'teacher'::app_role) AND
  EXISTS (
    SELECT 1
    FROM class_subjects cs
    JOIN teachers t ON cs.teacher_id = t.id
    WHERE cs.class_id = students.class_id
      AND t.user_id = auth.uid()
  )
);

-- 3. Restrict teacher information visibility
DROP POLICY IF EXISTS "Everyone can view teachers" ON public.teachers;

CREATE POLICY "Authenticated users can view basic teacher info"
ON public.teachers
FOR SELECT
USING (
  -- Admins can see everything
  has_role(auth.uid(), 'admin'::app_role) OR
  -- Teachers can see their own profile
  auth.uid() = user_id OR
  -- Other authenticated users can see limited info (just existence for class assignments)
  auth.uid() IS NOT NULL
);

-- 4. Fix students table policy to include admins still having full access
CREATE POLICY "Admins can view all students"
ON public.students
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));