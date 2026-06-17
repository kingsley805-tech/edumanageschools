-- Create notification trigger for new messages
CREATE OR REPLACE FUNCTION public.notify_new_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  sender_name TEXT;
BEGIN
  -- Get sender's name
  SELECT full_name INTO sender_name
  FROM profiles
  WHERE id = NEW.sender_id;
  
  -- Create notification for receiver
  PERFORM create_notification(
    NEW.receiver_id,
    'New Message from ' || COALESCE(sender_name, 'Unknown'),
    COALESCE(NEW.subject, 'New message received'),
    jsonb_build_object(
      'type', 'message',
      'message_id', NEW.id,
      'sender_id', NEW.sender_id
    )
  );
  
  RETURN NEW;
END;
$$;

-- Create trigger for new messages
DROP TRIGGER IF EXISTS on_new_message ON public.messages;
CREATE TRIGGER on_new_message
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_message();

-- Create notification trigger for online exams
CREATE OR REPLACE FUNCTION public.notify_students_new_online_exam()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  student_record RECORD;
BEGIN
  -- Notify all students in the class
  FOR student_record IN 
    SELECT s.user_id
    FROM students s
    WHERE s.class_id = NEW.class_id
  LOOP
    PERFORM create_notification(
      student_record.user_id,
      'New Online Exam: ' || NEW.title,
      'An online exam has been scheduled. Start: ' || to_char(NEW.start_time::timestamp, 'DD Mon YYYY HH24:MI'),
      jsonb_build_object(
        'type', 'online_exam',
        'exam_id', NEW.id,
        'start_time', NEW.start_time,
        'end_time', NEW.end_time
      )
    );
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- Create trigger for online exams
DROP TRIGGER IF EXISTS on_new_online_exam ON public.online_exams;
CREATE TRIGGER on_new_online_exam
  AFTER INSERT ON public.online_exams
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_students_new_online_exam();

-- Create notification trigger for traditional exams
CREATE OR REPLACE FUNCTION public.notify_students_new_exam()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  student_record RECORD;
BEGIN
  -- Notify all students in the class
  FOR student_record IN 
    SELECT s.user_id
    FROM students s
    WHERE s.class_id = NEW.class_id
  LOOP
    PERFORM create_notification(
      student_record.user_id,
      'Upcoming Exam: ' || NEW.title,
      'A new exam has been scheduled for ' || to_char(NEW.exam_date::date, 'DD Mon YYYY'),
      jsonb_build_object(
        'type', 'exam',
        'exam_id', NEW.id,
        'exam_date', NEW.exam_date
      )
    );
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- Create trigger for traditional exams
DROP TRIGGER IF EXISTS on_new_exam ON public.exams;
CREATE TRIGGER on_new_exam
  AFTER INSERT ON public.exams
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_students_new_exam();