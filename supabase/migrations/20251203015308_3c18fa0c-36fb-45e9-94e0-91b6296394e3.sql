-- Create a security definer function to check if teacher can view parent
CREATE OR REPLACE FUNCTION public.teacher_can_view_parent(teacher_user_id uuid, parent_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM teachers t
    JOIN class_subjects cs ON cs.teacher_id = t.id
    JOIN students s ON s.class_id = cs.class_id
    WHERE t.user_id = teacher_user_id
    AND s.guardian_id = parent_id
  )
$$;

-- Drop the existing policy and recreate with the function
DROP POLICY IF EXISTS "Teachers can view parents of their students" ON public.parents;

CREATE POLICY "Teachers can view parents of their students"
ON public.parents
FOR SELECT
USING (
  has_role(auth.uid(), 'teacher'::app_role) 
  AND teacher_can_view_parent(auth.uid(), id)
);