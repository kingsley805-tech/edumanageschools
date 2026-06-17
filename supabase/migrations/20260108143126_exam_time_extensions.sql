-- Add time extension tracking table for teachers to extend exam time for students
CREATE TABLE public.exam_time_extensions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  attempt_id UUID NOT NULL REFERENCES public.online_exam_attempts(id) ON DELETE CASCADE,
  extended_by UUID NOT NULL,
  extension_minutes INTEGER NOT NULL DEFAULT 0,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.exam_time_extensions ENABLE ROW LEVEL SECURITY;

-- Teachers can create extensions for exams they manage
CREATE POLICY "Teachers can create time extensions for their exams"
ON public.exam_time_extensions
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM online_exam_attempts oea
    JOIN online_exams oe ON oea.online_exam_id = oe.id
    WHERE oea.id = attempt_id AND oe.created_by = auth.uid()
  )
);

-- Teachers can view extensions for their exams
CREATE POLICY "Teachers can view time extensions for their exams"
ON public.exam_time_extensions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM online_exam_attempts oea
    JOIN online_exams oe ON oea.online_exam_id = oe.id
    WHERE oea.id = attempt_id AND oe.created_by = auth.uid()
  )
);

-- Students can view their own time extensions
CREATE POLICY "Students can view their own time extensions"
ON public.exam_time_extensions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM online_exam_attempts oea
    JOIN students s ON oea.student_id = s.id
    WHERE oea.id = attempt_id AND s.user_id = auth.uid()
  )
);