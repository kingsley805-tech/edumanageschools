-- Add shuffle_answers column to online_exams table
ALTER TABLE public.online_exams ADD COLUMN IF NOT EXISTS shuffle_answers BOOLEAN DEFAULT false;

