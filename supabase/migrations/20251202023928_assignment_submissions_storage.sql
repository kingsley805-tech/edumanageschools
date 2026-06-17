-- Create storage bucket for assignment submissions
INSERT INTO storage.buckets (id, name, public) 
VALUES ('assignment-submissions', 'assignment-submissions', false)
ON CONFLICT (id) DO NOTHING;

-- Create policies for assignment submissions bucket
CREATE POLICY "Students can upload their own submissions"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'assignment-submissions' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Students can view their own submissions"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'assignment-submissions' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Teachers can view all submissions"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'assignment-submissions' 
  AND EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'teacher'
  )
);