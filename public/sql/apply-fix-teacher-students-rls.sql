-- Run in Supabase SQL editor if Mark Attendance shows no students but class register works.
-- Fixes: teachers row + class_subjects assignment without user_roles.teacher.

DROP POLICY IF EXISTS "Teachers can view assigned students" ON public.students;

CREATE POLICY "Teachers can view assigned students"
ON public.students
FOR SELECT
USING (public.teacher_can_view_student(auth.uid(), class_id));
