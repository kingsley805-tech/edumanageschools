-- Drop and recreate foreign key constraints to refresh schema cache
-- This ensures Supabase PostgREST recognizes the relationships

-- Drop existing constraints if they exist (ignore errors if they don't)
ALTER TABLE public.teachers DROP CONSTRAINT IF EXISTS teachers_user_id_fkey;
ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_user_id_fkey;
ALTER TABLE public.parents DROP CONSTRAINT IF EXISTS parents_user_id_fkey;

-- Recreate foreign key constraints
ALTER TABLE public.teachers
ADD CONSTRAINT teachers_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES public.profiles(id) 
ON DELETE CASCADE;

ALTER TABLE public.students
ADD CONSTRAINT students_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES public.profiles(id) 
ON DELETE CASCADE;

ALTER TABLE public.parents
ADD CONSTRAINT parents_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES public.profiles(id) 
ON DELETE CASCADE;

-- Force schema cache reload by notifying PostgREST
NOTIFY pgrst, 'reload schema';