-- Fix security warnings by dropping triggers first, then functions, then recreating with search_path
DROP TRIGGER IF EXISTS trigger_notify_new_assignment ON public.assignments CASCADE;
DROP TRIGGER IF EXISTS trigger_notify_attendance ON public.attendance CASCADE;
DROP TRIGGER IF EXISTS trigger_notify_new_invoice ON public.invoices CASCADE;

DROP FUNCTION IF EXISTS public.create_notification(UUID, TEXT, TEXT, JSONB) CASCADE;
DROP FUNCTION IF EXISTS notify_students_new_assignment() CASCADE;
DROP FUNCTION IF EXISTS notify_attendance_marked() CASCADE;
DROP FUNCTION IF EXISTS notify_new_invoice() CASCADE;

-- Recreate functions with search_path set
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id UUID,
  p_title TEXT,
  p_body TEXT,
  p_data JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notification_id UUID;
BEGIN
  INSERT INTO public.notifications (user_id, title, body, data)
  VALUES (p_user_id, p_title, p_body, p_data)
  RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$$;

CREATE OR REPLACE FUNCTION notify_students_new_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  student_record RECORD;
BEGIN
  FOR student_record IN 
    SELECT s.user_id, p.full_name
    FROM students s
    JOIN profiles p ON s.user_id = p.id
    WHERE s.class_id = NEW.class_id
  LOOP
    PERFORM create_notification(
      student_record.user_id,
      'New Assignment',
      'A new assignment "' || NEW.title || '" has been posted',
      jsonb_build_object(
        'type', 'assignment',
        'assignment_id', NEW.id,
        'due_date', NEW.due_date
      )
    );
  END LOOP;
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION notify_attendance_marked()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  student_user_id UUID;
  parent_user_id UUID;
BEGIN
  SELECT user_id INTO student_user_id
  FROM students
  WHERE id = NEW.student_id;
  
  IF student_user_id IS NOT NULL THEN
    PERFORM create_notification(
      student_user_id,
      'Attendance Updated',
      'Your attendance has been marked as ' || NEW.status || ' for ' || NEW.date::text,
      jsonb_build_object(
        'type', 'attendance',
        'status', NEW.status,
        'date', NEW.date
      )
    );
  END IF;
  
  SELECT p.user_id INTO parent_user_id
  FROM students s
  JOIN parents p ON s.guardian_id = p.id
  WHERE s.id = NEW.student_id;
  
  IF parent_user_id IS NOT NULL THEN
    PERFORM create_notification(
      parent_user_id,
      'Child Attendance Update',
      'Your child was marked ' || NEW.status || ' on ' || NEW.date::text,
      jsonb_build_object(
        'type', 'attendance',
        'status', NEW.status,
        'date', NEW.date,
        'student_id', NEW.student_id
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION notify_new_invoice()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  student_user_id UUID;
  parent_user_id UUID;
BEGIN
  SELECT s.user_id, p.user_id INTO student_user_id, parent_user_id
  FROM students s
  LEFT JOIN parents p ON s.guardian_id = p.id
  WHERE s.id = NEW.student_id;
  
  IF student_user_id IS NOT NULL THEN
    PERFORM create_notification(
      student_user_id,
      'New Fee Invoice',
      'A new fee invoice of $' || NEW.amount || ' has been generated. Due date: ' || NEW.due_date::text,
      jsonb_build_object(
        'type', 'invoice',
        'invoice_id', NEW.id,
        'amount', NEW.amount,
        'due_date', NEW.due_date
      )
    );
  END IF;
  
  IF parent_user_id IS NOT NULL THEN
    PERFORM create_notification(
      parent_user_id,
      'Fee Payment Due',
      'Fee invoice of $' || NEW.amount || ' is due on ' || NEW.due_date::text,
      jsonb_build_object(
        'type', 'invoice',
        'invoice_id', NEW.id,
        'amount', NEW.amount,
        'due_date', NEW.due_date,
        'student_id', NEW.student_id
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recreate triggers
CREATE TRIGGER trigger_notify_new_assignment
AFTER INSERT ON public.assignments
FOR EACH ROW
EXECUTE FUNCTION notify_students_new_assignment();

CREATE TRIGGER trigger_notify_attendance
AFTER INSERT OR UPDATE ON public.attendance
FOR EACH ROW
EXECUTE FUNCTION notify_attendance_marked();

CREATE TRIGGER trigger_notify_new_invoice
AFTER INSERT ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION notify_new_invoice();