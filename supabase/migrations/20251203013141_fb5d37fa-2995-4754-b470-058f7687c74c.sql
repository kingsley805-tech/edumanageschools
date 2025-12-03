-- Allow teachers to view their own teacher record directly
CREATE POLICY "Teachers can view own teacher record"
ON public.teachers
FOR SELECT
USING (auth.uid() = user_id);