-- Create a trigger function to automatically mark registration numbers as used when a student/teacher is created
CREATE OR REPLACE FUNCTION public.mark_registration_number_used()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- For students, look up by admission_no
  IF TG_TABLE_NAME = 'students' AND NEW.admission_no IS NOT NULL THEN
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
  
  -- For teachers, look up by employee_no
  IF TG_TABLE_NAME = 'teachers' AND NEW.employee_no IS NOT NULL THEN
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

-- Create trigger for students - fires on INSERT and UPDATE of admission_no
DROP TRIGGER IF EXISTS trigger_mark_student_number_used ON students;
CREATE TRIGGER trigger_mark_student_number_used
  AFTER INSERT OR UPDATE OF admission_no ON students
  FOR EACH ROW
  EXECUTE FUNCTION mark_registration_number_used();

-- Create trigger for teachers - fires on INSERT and UPDATE of employee_no
DROP TRIGGER IF EXISTS trigger_mark_employee_number_used ON teachers;
CREATE TRIGGER trigger_mark_employee_number_used
  AFTER INSERT OR UPDATE OF employee_no ON teachers
  FOR EACH ROW
  EXECUTE FUNCTION mark_registration_number_used();