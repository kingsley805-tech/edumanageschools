-- Allow students to view questions that are part of online exams they can take
CREATE POLICY "Students can view exam questions from question bank"
ON public.question_bank
FOR SELECT
USING (
  has_role(auth.uid(), 'student'::app_role) 
  AND EXISTS (
    SELECT 1 FROM online_exam_questions oeq
    JOIN online_exams oe ON oeq.online_exam_id = oe.id
    JOIN students s ON s.class_id = oe.class_id
    WHERE oeq.question_id = question_bank.id
    AND s.user_id = auth.uid()
  )
);