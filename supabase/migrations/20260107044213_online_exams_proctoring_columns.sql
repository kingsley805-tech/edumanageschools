-- Add shuffle_answers column to online_exams
ALTER TABLE public.online_exams ADD COLUMN IF NOT EXISTS shuffle_answers boolean DEFAULT false;

-- Add proctoring columns to online_exams
ALTER TABLE public.online_exams ADD COLUMN IF NOT EXISTS proctoring_enabled boolean DEFAULT false;
ALTER TABLE public.online_exams ADD COLUMN IF NOT EXISTS fullscreen_required boolean DEFAULT true;
ALTER TABLE public.online_exams ADD COLUMN IF NOT EXISTS tab_switch_limit integer DEFAULT 3;
ALTER TABLE public.online_exams ADD COLUMN IF NOT EXISTS webcam_required boolean DEFAULT false;

-- Create exam_proctoring_logs table to track violations
CREATE TABLE IF NOT EXISTS public.exam_proctoring_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  attempt_id uuid REFERENCES public.online_exam_attempts(id) ON DELETE CASCADE,
  student_id uuid REFERENCES public.students(id) ON DELETE CASCADE,
  violation_type text NOT NULL, -- 'tab_switch', 'window_blur', 'copy_attempt', 'fullscreen_exit', 'right_click'
  description text,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on proctoring logs
ALTER TABLE public.exam_proctoring_logs ENABLE ROW LEVEL SECURITY;

-- Teachers can view proctoring logs for their exams
CREATE POLICY "Teachers can view proctoring logs for their exams" ON public.exam_proctoring_logs
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM online_exam_attempts oea
    JOIN online_exams oe ON oea.online_exam_id = oe.id
    WHERE oea.id = exam_proctoring_logs.attempt_id
    AND oe.created_by = auth.uid()
  )
);

-- Students can insert their own proctoring logs
CREATE POLICY "Students can insert their own proctoring logs" ON public.exam_proctoring_logs
FOR INSERT WITH CHECK (
  student_id IN (SELECT id FROM students WHERE user_id = auth.uid())
);

-- Create exam_summary_reports table
CREATE TABLE IF NOT EXISTS public.exam_summary_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  online_exam_id uuid REFERENCES public.online_exams(id) ON DELETE CASCADE,
  generated_at timestamp with time zone DEFAULT now(),
  total_students integer DEFAULT 0,
  students_attempted integer DEFAULT 0,
  students_passed integer DEFAULT 0,
  average_score numeric(5,2),
  highest_score numeric(5,2),
  lowest_score numeric(5,2),
  question_analytics jsonb, -- {question_id: {correct: x, wrong: y, skipped: z}}
  grade_distribution jsonb, -- {A: 10, B: 15, C: 20, etc.}
  created_by uuid
);

-- Enable RLS on summary reports
ALTER TABLE public.exam_summary_reports ENABLE ROW LEVEL SECURITY;

-- Teachers can manage their exam reports
CREATE POLICY "Teachers can view their exam reports" ON public.exam_summary_reports
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM online_exams WHERE id = exam_summary_reports.online_exam_id AND created_by = auth.uid()
  )
);

CREATE POLICY "Teachers can insert exam reports" ON public.exam_summary_reports
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM online_exams WHERE id = online_exam_id AND created_by = auth.uid()
  )
);

CREATE POLICY "Teachers can update their exam reports" ON public.exam_summary_reports
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM online_exams WHERE id = exam_summary_reports.online_exam_id AND created_by = auth.uid()
  )
);

CREATE POLICY "Teachers can delete their exam reports" ON public.exam_summary_reports
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM online_exams WHERE id = exam_summary_reports.online_exam_id AND created_by = auth.uid()
  )
);