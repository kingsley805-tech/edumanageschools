-- Add file_url column to assignments table for teacher-uploaded documents
ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS file_url TEXT;

