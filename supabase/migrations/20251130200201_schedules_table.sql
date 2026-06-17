-- Create schedules table for timetable management
CREATE TABLE IF NOT EXISTS public.schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday, 6=Saturday
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  room TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT valid_time_range CHECK (end_time > start_time)
);

-- Enable RLS on schedules
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;

-- RLS policies for schedules
CREATE POLICY "Admins can manage schedules"
ON public.schedules
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Teachers can view schedules"
ON public.schedules
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'teacher'::app_role));

CREATE POLICY "Students can view their class schedules"
ON public.schedules
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM students
    WHERE students.user_id = auth.uid()
    AND students.class_id = schedules.class_id
  )
);

CREATE POLICY "Parents can view children's schedules"
ON public.schedules
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM students s
    JOIN parents p ON s.guardian_id = p.id
    WHERE p.user_id = auth.uid()
    AND s.class_id = schedules.class_id
  )
);

-- Enable realtime for notifications table
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Create function to send notification
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id UUID,
  p_title TEXT,
  p_body TEXT,
  p_data JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Trigger to notify students when new assignment is created
CREATE OR REPLACE FUNCTION notify_students_new_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  student_record RECORD;
BEGIN
  -- Get all students in the class
  FOR student_record IN 
    SELECT s.user_id, p.full_name
    FROM students s
    JOIN profiles p ON s.user_id = p.id
    WHERE s.class_id = NEW.class_id
  LOOP
    -- Create notification for each student
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

CREATE TRIGGER trigger_notify_new_assignment
AFTER INSERT ON public.assignments
FOR EACH ROW
EXECUTE FUNCTION notify_students_new_assignment();

-- Trigger to notify students/parents when attendance is marked
CREATE OR REPLACE FUNCTION notify_attendance_marked()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  student_user_id UUID;
  parent_user_id UUID;
BEGIN
  -- Get student user_id
  SELECT user_id INTO student_user_id
  FROM students
  WHERE id = NEW.student_id;
  
  -- Notify student
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
  
  -- Get parent user_id and notify
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

CREATE TRIGGER trigger_notify_attendance
AFTER INSERT OR UPDATE ON public.attendance
FOR EACH ROW
EXECUTE FUNCTION notify_attendance_marked();

-- Trigger to notify students/parents about new invoices
CREATE OR REPLACE FUNCTION notify_new_invoice()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  student_user_id UUID;
  parent_user_id UUID;
BEGIN
  -- Get student and parent user_ids
  SELECT s.user_id, p.user_id INTO student_user_id, parent_user_id
  FROM students s
  LEFT JOIN parents p ON s.guardian_id = p.id
  WHERE s.id = NEW.student_id;
  
  -- Notify student
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
  
  -- Notify parent
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

CREATE TRIGGER trigger_notify_new_invoice
AFTER INSERT ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION notify_new_invoice();

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_schedules_class_day ON schedules(class_id, day_of_week);
CREATE INDEX IF NOT EXISTS idx_schedules_teacher ON schedules(teacher_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read);