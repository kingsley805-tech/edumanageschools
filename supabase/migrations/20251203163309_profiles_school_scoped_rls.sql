-- Fix profiles RLS to restrict access by school and role context
-- Drop overly permissive policies
DROP POLICY IF EXISTS "Admins can view school profiles" ON public.profiles;
DROP POLICY IF EXISTS "Teachers can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Students can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Parents can view profiles" ON public.profiles;

-- Admins can view profiles within their school only
CREATE POLICY "Admins can view school profiles" ON public.profiles
FOR SELECT USING (
  has_role(auth.uid(), 'admin'::app_role) AND 
  school_id = (SELECT school_id FROM profiles WHERE id = auth.uid())
);

-- Teachers can view profiles of students in their classes and parents of those students
CREATE POLICY "Teachers can view relevant profiles" ON public.profiles
FOR SELECT USING (
  has_role(auth.uid(), 'teacher'::app_role) AND (
    -- Can view students in their assigned classes
    id IN (
      SELECT s.user_id FROM students s
      JOIN class_subjects cs ON cs.class_id = s.class_id
      JOIN teachers t ON t.id = cs.teacher_id
      WHERE t.user_id = auth.uid()
    )
    OR
    -- Can view parents of students in their assigned classes
    id IN (
      SELECT p.user_id FROM parents p
      JOIN students s ON s.guardian_id = p.id
      JOIN class_subjects cs ON cs.class_id = s.class_id
      JOIN teachers t ON t.id = cs.teacher_id
      WHERE t.user_id = auth.uid()
    )
    OR
    -- Can view other teachers in same school
    (id IN (SELECT user_id FROM teachers WHERE school_id = (SELECT school_id FROM teachers WHERE user_id = auth.uid())))
  )
);

-- Students can only view profiles of teachers and classmates
CREATE POLICY "Students can view relevant profiles" ON public.profiles
FOR SELECT USING (
  has_role(auth.uid(), 'student'::app_role) AND (
    -- Can view teachers of their classes
    id IN (
      SELECT t.user_id FROM teachers t
      JOIN class_subjects cs ON cs.teacher_id = t.id
      JOIN students s ON s.class_id = cs.class_id
      WHERE s.user_id = auth.uid()
    )
    OR
    -- Can view classmates
    id IN (
      SELECT s2.user_id FROM students s2
      JOIN students s1 ON s1.class_id = s2.class_id
      WHERE s1.user_id = auth.uid()
    )
  )
);

-- Parents can view profiles of their children's teachers and other parents in same class
CREATE POLICY "Parents can view relevant profiles" ON public.profiles
FOR SELECT USING (
  has_role(auth.uid(), 'parent'::app_role) AND (
    -- Can view children's profiles
    id IN (
      SELECT s.user_id FROM students s
      JOIN parents p ON p.id = s.guardian_id
      WHERE p.user_id = auth.uid()
    )
    OR
    -- Can view teachers of their children
    id IN (
      SELECT t.user_id FROM teachers t
      JOIN class_subjects cs ON cs.teacher_id = t.id
      JOIN students s ON s.class_id = cs.class_id
      JOIN parents p ON p.id = s.guardian_id
      WHERE p.user_id = auth.uid()
    )
  )
);