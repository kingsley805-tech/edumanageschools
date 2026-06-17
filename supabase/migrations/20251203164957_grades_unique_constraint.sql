-- Add unique constraint for grades table to allow upsert
ALTER TABLE public.grades DROP CONSTRAINT IF EXISTS grades_student_subject_term_unique;
ALTER TABLE public.grades ADD CONSTRAINT grades_student_subject_term_unique UNIQUE (student_id, subject_id, term);