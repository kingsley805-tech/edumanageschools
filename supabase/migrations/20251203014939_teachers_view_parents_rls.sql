-- Add policy for teachers to view parents of students in their assigned classes
CREATE POLICY "Teachers can view parents of their students"
ON public.parents
FOR SELECT
USING (
  has_role(auth.uid(), 'teacher'::app_role) 
  AND EXISTS (
    SELECT 1 FROM teachers t
    JOIN class_subjects cs ON cs.teacher_id = t.id
    JOIN students s ON s.class_id = cs.class_id
    WHERE t.user_id = auth.uid()
    AND s.guardian_id = parents.id
  )
);

-- Add policy for parents to view teachers of their children's classes  
CREATE POLICY "Parents can view teachers of their children"
ON public.teachers
FOR SELECT
USING (
  has_role(auth.uid(), 'parent'::app_role)
  AND EXISTS (
    SELECT 1 FROM parents p
    JOIN students s ON s.guardian_id = p.id
    JOIN class_subjects cs ON cs.class_id = s.class_id
    WHERE p.user_id = auth.uid()
    AND cs.teacher_id = teachers.id
  )
);