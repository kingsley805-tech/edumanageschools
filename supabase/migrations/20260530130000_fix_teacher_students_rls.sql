-- Teachers with class_subjects assignments could not see students when
-- user_roles lacked 'teacher' (has_role failed despite teacher_can_view_student).

DROP POLICY IF EXISTS "Teachers can view assigned students" ON public.students;

CREATE POLICY "Teachers can view assigned students"
ON public.students
FOR SELECT
USING (public.teacher_can_view_student(auth.uid(), class_id));
