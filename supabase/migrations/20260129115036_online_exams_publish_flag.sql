-- Add is_published column to online_exams for publish/unpublish functionality
ALTER TABLE public.online_exams 
ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT false;

-- Modify the foreign key constraint on online_exam_questions to allow soft deletion
-- First, check if question_id references are there and modify behavior
ALTER TABLE public.online_exam_questions 
DROP CONSTRAINT IF EXISTS online_exam_questions_question_id_fkey;

ALTER TABLE public.online_exam_questions 
ADD CONSTRAINT online_exam_questions_question_id_fkey 
FOREIGN KEY (question_id) REFERENCES public.question_bank(id) ON DELETE SET NULL;

-- Modify the foreign key constraint on online_exam_answers to allow soft deletion  
ALTER TABLE public.online_exam_answers 
DROP CONSTRAINT IF EXISTS online_exam_answers_question_id_fkey;

ALTER TABLE public.online_exam_answers 
ADD CONSTRAINT online_exam_answers_question_id_fkey 
FOREIGN KEY (question_id) REFERENCES public.question_bank(id) ON DELETE SET NULL;

-- Add phone column to parents table for contact info
ALTER TABLE public.parents 
ADD COLUMN IF NOT EXISTS phone text;

-- Add email column to parents table as well (some may want separate from profile)
ALTER TABLE public.parents 
ADD COLUMN IF NOT EXISTS emergency_contact text;