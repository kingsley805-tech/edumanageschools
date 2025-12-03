-- Drop problematic policies causing infinite recursion
DROP POLICY IF EXISTS "Parents can view teachers of their children" ON public.teachers;
DROP POLICY IF EXISTS "Teachers can view parents of their students" ON public.parents;
DROP POLICY IF EXISTS "Teachers can view assigned students" ON public.students;

-- Create security definer function to check if parent can view teacher
CREATE OR REPLACE FUNCTION public.parent_can_view_teacher(parent_user_id uuid, teacher_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM parents p
    JOIN students s ON s.guardian_id = p.id
    JOIN class_subjects cs ON cs.class_id = s.class_id
    WHERE p.user_id = parent_user_id
    AND cs.teacher_id = teacher_id
  )
$$;

-- Create security definer function to check if teacher can view student
CREATE OR REPLACE FUNCTION public.teacher_can_view_student(teacher_user_id uuid, student_class_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM teachers t
    JOIN class_subjects cs ON cs.teacher_id = t.id
    WHERE t.user_id = teacher_user_id
    AND cs.class_id = student_class_id
  )
$$;

-- Recreate policies using security definer functions
CREATE POLICY "Teachers can view assigned students"
ON public.students
FOR SELECT
USING (
  has_role(auth.uid(), 'teacher'::app_role) 
  AND teacher_can_view_student(auth.uid(), class_id)
);

CREATE POLICY "Teachers can view parents of their students"
ON public.parents
FOR SELECT
USING (
  has_role(auth.uid(), 'teacher'::app_role) 
  AND teacher_can_view_parent(auth.uid(), id)
);

CREATE POLICY "Parents can view teachers of their children"
ON public.teachers
FOR SELECT
USING (
  has_role(auth.uid(), 'parent'::app_role)
  AND parent_can_view_teacher(auth.uid(), id)
);