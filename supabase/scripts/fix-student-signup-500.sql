-- Run in Supabase Dashboard → SQL Editor to fix POST /auth/v1/signup 500 for students.
-- (Same as migration 20260529130000_fix_student_signup_trigger.sql)

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS admission_number text,
  ADD COLUMN IF NOT EXISTS full_name text;

ALTER TABLE public.parents
  ADD COLUMN IF NOT EXISTS phone text;

-- Then paste the full CREATE OR REPLACE FUNCTION from:
-- supabase/migrations/20260529130000_fix_student_signup_trigger.sql

NOTIFY pgrst, 'reload schema';
