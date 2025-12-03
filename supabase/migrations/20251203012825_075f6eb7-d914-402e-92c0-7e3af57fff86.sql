-- Allow teachers to view profiles of parents whose children are in their classes
CREATE POLICY "Teachers can view parent profiles"
ON public.profiles
FOR SELECT
USING (
  has_role(auth.uid(), 'teacher'::app_role)
  AND EXISTS (
    SELECT 1 FROM teachers t
    JOIN class_subjects cs ON cs.teacher_id = t.id
    JOIN students s ON s.class_id = cs.class_id
    JOIN parents p ON p.id = s.guardian_id
    WHERE t.user_id = auth.uid()
    AND p.user_id = profiles.id
  )
);

-- Allow parents to view profiles of teachers who teach their children
CREATE POLICY "Parents can view teacher profiles"
ON public.profiles
FOR SELECT
USING (
  has_role(auth.uid(), 'parent'::app_role)
  AND EXISTS (
    SELECT 1 FROM parents p
    JOIN students s ON s.guardian_id = p.id
    JOIN class_subjects cs ON cs.class_id = s.class_id
    JOIN teachers t ON t.id = cs.teacher_id
    WHERE p.user_id = auth.uid()
    AND t.user_id = profiles.id
  )
);