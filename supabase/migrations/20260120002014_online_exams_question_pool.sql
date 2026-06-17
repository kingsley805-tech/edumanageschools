-- Add question pool columns to online_exams table
ALTER TABLE public.online_exams
ADD COLUMN IF NOT EXISTS question_pool_size integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS questions_to_answer integer DEFAULT NULL;

-- Add column to store student's assigned question set
ALTER TABLE public.online_exam_attempts
ADD COLUMN IF NOT EXISTS assigned_questions jsonb DEFAULT NULL;

-- Comment on new columns
COMMENT ON COLUMN public.online_exams.question_pool_size IS 'Total number of questions in the pool (e.g., 30)';
COMMENT ON COLUMN public.online_exams.questions_to_answer IS 'Number of questions each student must answer (e.g., 20)';
COMMENT ON COLUMN public.online_exam_attempts.assigned_questions IS 'JSON array of question IDs assigned to this student for randomization';