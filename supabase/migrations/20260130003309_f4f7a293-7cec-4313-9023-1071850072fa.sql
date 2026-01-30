-- Drop existing triggers first
DROP TRIGGER IF EXISTS mark_student_registration_used ON public.students;
DROP TRIGGER IF EXISTS mark_teacher_registration_used ON public.teachers;
DROP TRIGGER IF EXISTS mark_registration_number_used ON public.students;
DROP TRIGGER IF EXISTS mark_registration_number_used ON public.teachers;
DROP TRIGGER IF EXISTS mark_registration_number_used ON public.profiles;

-- Drop and recreate the function with better error handling
DROP FUNCTION IF EXISTS public.mark_registration_number_used() CASCADE;

CREATE OR REPLACE FUNCTION public.mark_student_registration_used()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only process if admission_no is set
  IF NEW.admission_no IS NOT NULL AND NEW.school_id IS NOT NULL THEN
    UPDATE registration_numbers
    SET 
      status = 'used',
      assigned_user_id = NEW.user_id,
      used_at = NOW()
    WHERE registration_number = NEW.admission_no
      AND school_id = NEW.school_id
      AND number_type = 'student'
      AND status = 'unused';
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_teacher_registration_used()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only process if employee_no is set
  IF NEW.employee_no IS NOT NULL AND NEW.school_id IS NOT NULL THEN
    UPDATE registration_numbers
    SET 
      status = 'used',
      assigned_user_id = NEW.user_id,
      used_at = NOW()
    WHERE registration_number = NEW.employee_no
      AND school_id = NEW.school_id
      AND number_type = 'employee'
      AND status = 'unused';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create separate triggers for each table
CREATE TRIGGER mark_student_registration_used
  AFTER INSERT OR UPDATE OF admission_no ON public.students
  FOR EACH ROW
  EXECUTE FUNCTION public.mark_student_registration_used();

CREATE TRIGGER mark_teacher_registration_used
  AFTER INSERT OR UPDATE OF employee_no ON public.teachers
  FOR EACH ROW
  EXECUTE FUNCTION public.mark_teacher_registration_used();