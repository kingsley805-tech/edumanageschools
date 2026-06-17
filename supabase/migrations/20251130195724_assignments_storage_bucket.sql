-- Create storage bucket for assignment files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'assignments',
  'assignments',
  false,
  10485760, -- 10MB limit
  ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png', 'text/plain']
);

-- Storage policies for assignments bucket
CREATE POLICY "Students can upload their own assignment files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'assignments' AND
  has_role(auth.uid(), 'student'::app_role)
);

CREATE POLICY "Students can view their own assignment files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'assignments' AND
  (
    has_role(auth.uid(), 'student'::app_role) OR
    has_role(auth.uid(), 'teacher'::app_role) OR
    has_role(auth.uid(), 'admin'::app_role)
  )
);

CREATE POLICY "Teachers can view all assignment files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'assignments' AND
  has_role(auth.uid(), 'teacher'::app_role)
);

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_attendance_student_class ON attendance(student_id, class_id);
CREATE INDEX IF NOT EXISTS idx_grades_student ON grades(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_class ON enrollments(class_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_student ON enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_assignments_class ON assignments(class_id);
CREATE INDEX IF NOT EXISTS idx_submissions_assignment ON submissions(assignment_id);