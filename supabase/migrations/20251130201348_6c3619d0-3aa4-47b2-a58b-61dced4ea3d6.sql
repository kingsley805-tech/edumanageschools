-- Create exams table
CREATE TABLE public.exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  exam_date DATE NOT NULL,
  duration_minutes INTEGER NOT NULL,
  total_marks INTEGER NOT NULL,
  term TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create exam_results table
CREATE TABLE public.exam_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID REFERENCES public.exams(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
  marks_obtained NUMERIC,
  grade TEXT,
  remarks TEXT,
  recorded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(exam_id, student_id)
);

-- Create resources table
CREATE TABLE public.resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  file_url TEXT NOT NULL,
  file_type TEXT,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;

-- RLS Policies for exams
CREATE POLICY "Admins can manage exams"
  ON public.exams FOR ALL
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Teachers can manage exams"
  ON public.exams FOR ALL
  USING (has_role(auth.uid(), 'teacher'));

CREATE POLICY "Students can view exams"
  ON public.exams FOR SELECT
  USING (
    has_role(auth.uid(), 'student') AND
    EXISTS (
      SELECT 1 FROM students
      WHERE students.user_id = auth.uid()
      AND students.class_id = exams.class_id
    )
  );

-- RLS Policies for exam_results
CREATE POLICY "Admins can manage exam results"
  ON public.exam_results FOR ALL
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Teachers can manage exam results"
  ON public.exam_results FOR ALL
  USING (has_role(auth.uid(), 'teacher'));

CREATE POLICY "Students can view own exam results"
  ON public.exam_results FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM students
      WHERE students.user_id = auth.uid()
      AND students.id = exam_results.student_id
    )
  );

CREATE POLICY "Parents can view children exam results"
  ON public.exam_results FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM students s
      JOIN parents p ON s.guardian_id = p.id
      WHERE p.user_id = auth.uid()
      AND s.id = exam_results.student_id
    )
  );

-- RLS Policies for resources
CREATE POLICY "Admins can manage resources"
  ON public.resources FOR ALL
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Teachers can manage resources"
  ON public.resources FOR ALL
  USING (has_role(auth.uid(), 'teacher'));

CREATE POLICY "Students can view resources"
  ON public.resources FOR SELECT
  USING (
    has_role(auth.uid(), 'student') AND
    EXISTS (
      SELECT 1 FROM students
      WHERE students.user_id = auth.uid()
      AND students.class_id = resources.class_id
    )
  );

CREATE POLICY "Parents can view children resources"
  ON public.resources FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM students s
      JOIN parents p ON s.guardian_id = p.id
      WHERE p.user_id = auth.uid()
      AND s.class_id = resources.class_id
    )
  );

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- Create storage bucket for resources
INSERT INTO storage.buckets (id, name, public)
VALUES ('resources', 'resources', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for resources bucket
CREATE POLICY "Teachers can upload resources"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'resources' AND
    has_role(auth.uid(), 'teacher')
  );

CREATE POLICY "Admins can upload resources"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'resources' AND
    has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Everyone can view resources"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'resources');

CREATE POLICY "Teachers can delete resources"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'resources' AND
    has_role(auth.uid(), 'teacher')
  );

CREATE POLICY "Admins can delete resources"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'resources' AND
    has_role(auth.uid(), 'admin')
  );