-- Create announcements table
CREATE TABLE public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT now(),
  priority text DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  target_roles text[] DEFAULT ARRAY['admin', 'teacher', 'parent', 'student']
);

-- Enable RLS
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Admins can manage announcements
CREATE POLICY "Admins can manage announcements"
ON public.announcements
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- All authenticated users can view announcements
CREATE POLICY "All users can view announcements"
ON public.announcements
FOR SELECT
TO authenticated
USING (true);

-- Create function to notify users of new announcements
CREATE OR REPLACE FUNCTION public.notify_new_announcement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_record RECORD;
  role_filter text;
BEGIN
  FOR role_filter IN SELECT unnest(NEW.target_roles)
  LOOP
    FOR user_record IN 
      SELECT DISTINCT ur.user_id
      FROM user_roles ur
      WHERE ur.role::text = role_filter
    LOOP
      PERFORM create_notification(
        user_record.user_id,
        'New Announcement: ' || NEW.title,
        NEW.body,
        jsonb_build_object(
          'type', 'announcement',
          'announcement_id', NEW.id,
          'priority', NEW.priority
        )
      );
    END LOOP;
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- Create trigger for new announcements
CREATE TRIGGER on_announcement_created
  AFTER INSERT ON public.announcements
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_announcement();

-- Enable realtime for announcements
ALTER PUBLICATION supabase_realtime ADD TABLE public.announcements;