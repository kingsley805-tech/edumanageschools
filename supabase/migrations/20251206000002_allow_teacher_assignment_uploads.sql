-- Update assignments bucket to be public for reading
UPDATE storage.buckets SET public = true WHERE id = 'assignments';

-- Allow teachers to upload files to assignments bucket
CREATE POLICY IF NOT EXISTS "Teachers can upload assignment files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'assignments' AND
  has_role(auth.uid(), 'teacher'::app_role)
);

-- Allow teachers to update assignment files
CREATE POLICY IF NOT EXISTS "Teachers can update assignment files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'assignments' AND
  has_role(auth.uid(), 'teacher'::app_role)
);

-- Allow teachers to delete assignment files
CREATE POLICY IF NOT EXISTS "Teachers can delete assignment files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'assignments' AND
  has_role(auth.uid(), 'teacher'::app_role)
);

