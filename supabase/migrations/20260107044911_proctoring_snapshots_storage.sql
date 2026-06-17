-- Create storage bucket for proctoring snapshots
INSERT INTO storage.buckets (id, name, public)
VALUES ('proctoring-snapshots', 'proctoring-snapshots', false)
ON CONFLICT (id) DO NOTHING;

-- Students can upload their own proctoring snapshots
CREATE POLICY "Students can upload their proctoring snapshots"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'proctoring-snapshots' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Teachers can view proctoring snapshots for their exams
CREATE POLICY "Teachers can view proctoring snapshots"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'proctoring-snapshots'
  AND EXISTS (
    SELECT 1 FROM online_exam_attempts oea
    JOIN online_exams oe ON oea.online_exam_id = oe.id
    WHERE oe.created_by = auth.uid()
    AND oea.student_id::text = (storage.foldername(name))[2]
  )
);

-- Add webcam_snapshots column to exam_proctoring_logs
ALTER TABLE public.exam_proctoring_logs 
ADD COLUMN IF NOT EXISTS snapshot_url text;