-- Add RLS policy for students to view question_bank entries
-- that are part of exams in their class
CREATE POLICY "Students can view questions from their class exams" ON public.question_bank FOR SELECT
USING (
  has_role(auth.uid(), 'student') AND
  EXISTS (
    SELECT 1
    FROM online_exam_questions oeq
    JOIN online_exams oe ON oeq.online_exam_id = oe.id
    JOIN students s ON s.class_id = oe.class_id
    WHERE oeq.question_id = question_bank.id
      AND s.user_id = auth.uid()
  )
);

