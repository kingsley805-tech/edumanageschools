-- Exam types (Midterm, Final, Quiz, Unit Test, Project, etc.)
CREATE TABLE public.exam_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID REFERENCES public.schools(id),
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'term', -- 'term' or 'category'
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Grade scales (A, B, C, D, F with ranges)
CREATE TABLE public.grade_scales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID REFERENCES public.schools(id),
  name TEXT NOT NULL,
  min_score NUMERIC NOT NULL,
  max_score NUMERIC NOT NULL,
  grade TEXT NOT NULL,
  grade_point NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Class grading configuration (weights per exam type)
CREATE TABLE public.class_grading_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
  exam_type_id UUID REFERENCES public.exam_types(id) ON DELETE CASCADE,
  weight_percentage NUMERIC NOT NULL DEFAULT 100,
  term TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(class_id, subject_id, exam_type_id, term)
);

-- Question bank for online exams
CREATE TABLE public.question_bank (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID REFERENCES public.schools(id),
  subject_id UUID REFERENCES public.subjects(id),
  question_type TEXT NOT NULL, -- 'multiple_choice', 'true_false', 'fill_blank'
  question_text TEXT NOT NULL,
  options JSONB, -- For multiple choice: [{id: 1, text: "Option A"}, ...]
  correct_answer TEXT NOT NULL, -- Option id for MCQ, 'true'/'false' for T/F, text for fill blank
  marks NUMERIC NOT NULL DEFAULT 1,
  difficulty TEXT DEFAULT 'medium', -- 'easy', 'medium', 'hard'
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Online exams
CREATE TABLE public.online_exams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  class_id UUID REFERENCES public.classes(id),
  subject_id UUID REFERENCES public.subjects(id),
  exam_type_id UUID REFERENCES public.exam_types(id),
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  duration_minutes INTEGER NOT NULL,
  total_marks NUMERIC NOT NULL,
  passing_marks NUMERIC,
  shuffle_questions BOOLEAN DEFAULT false,
  show_result_immediately BOOLEAN DEFAULT true,
  term TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Online exam questions (links questions to exams)
CREATE TABLE public.online_exam_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  online_exam_id UUID REFERENCES public.online_exams(id) ON DELETE CASCADE,
  question_id UUID REFERENCES public.question_bank(id) ON DELETE CASCADE,
  question_order INTEGER,
  marks NUMERIC NOT NULL DEFAULT 1
);

-- Student online exam attempts
CREATE TABLE public.online_exam_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  online_exam_id UUID REFERENCES public.online_exams(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  submitted_at TIMESTAMP WITH TIME ZONE,
  total_marks_obtained NUMERIC,
  status TEXT DEFAULT 'in_progress', -- 'in_progress', 'submitted', 'graded'
  UNIQUE(online_exam_id, student_id)
);

-- Student answers for online exams
CREATE TABLE public.online_exam_answers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  attempt_id UUID REFERENCES public.online_exam_attempts(id) ON DELETE CASCADE,
  question_id UUID REFERENCES public.question_bank(id),
  student_answer TEXT,
  is_correct BOOLEAN,
  marks_obtained NUMERIC DEFAULT 0
);

-- Exam attendance tracking
CREATE TABLE public.exam_attendance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  exam_id UUID REFERENCES public.exams(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'present', -- 'present', 'absent', 'late'
  recorded_by UUID REFERENCES auth.users(id),
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(exam_id, student_id)
);

-- Add exam_type_id to existing exams table
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS exam_type_id UUID REFERENCES public.exam_types(id);

-- Enable RLS
ALTER TABLE public.exam_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grade_scales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_grading_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_bank ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.online_exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.online_exam_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.online_exam_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.online_exam_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_attendance ENABLE ROW LEVEL SECURITY;

-- RLS Policies for exam_types
CREATE POLICY "Users can view school exam types" ON public.exam_types FOR SELECT
USING (school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can manage exam types" ON public.exam_types FOR ALL
USING (has_role(auth.uid(), 'admin') AND school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()));

-- RLS Policies for grade_scales
CREATE POLICY "Users can view school grade scales" ON public.grade_scales FOR SELECT
USING (school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can manage grade scales" ON public.grade_scales FOR ALL
USING (has_role(auth.uid(), 'admin') AND school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()));

-- RLS Policies for class_grading_config
CREATE POLICY "Users can view class grading config" ON public.class_grading_config FOR SELECT
USING (true);

CREATE POLICY "Admins can manage class grading config" ON public.class_grading_config FOR ALL
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Teachers can manage class grading config" ON public.class_grading_config FOR ALL
USING (has_role(auth.uid(), 'teacher'));

-- RLS Policies for question_bank
CREATE POLICY "Teachers can manage question bank" ON public.question_bank FOR ALL
USING (has_role(auth.uid(), 'teacher'));

CREATE POLICY "Admins can manage question bank" ON public.question_bank FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for online_exams
CREATE POLICY "Teachers can manage online exams" ON public.online_exams FOR ALL
USING (has_role(auth.uid(), 'teacher'));

CREATE POLICY "Admins can manage online exams" ON public.online_exams FOR ALL
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Students can view their class online exams" ON public.online_exams FOR SELECT
USING (has_role(auth.uid(), 'student') AND EXISTS (
  SELECT 1 FROM students WHERE user_id = auth.uid() AND class_id = online_exams.class_id
));

-- RLS Policies for online_exam_questions
CREATE POLICY "Teachers can manage exam questions" ON public.online_exam_questions FOR ALL
USING (has_role(auth.uid(), 'teacher'));

CREATE POLICY "Admins can manage exam questions" ON public.online_exam_questions FOR ALL
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Students can view exam questions" ON public.online_exam_questions FOR SELECT
USING (has_role(auth.uid(), 'student'));

-- RLS Policies for online_exam_attempts
CREATE POLICY "Students can manage own attempts" ON public.online_exam_attempts FOR ALL
USING (EXISTS (SELECT 1 FROM students WHERE user_id = auth.uid() AND id = online_exam_attempts.student_id));

CREATE POLICY "Teachers can view attempts" ON public.online_exam_attempts FOR SELECT
USING (has_role(auth.uid(), 'teacher'));

CREATE POLICY "Admins can view attempts" ON public.online_exam_attempts FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for online_exam_answers
CREATE POLICY "Students can manage own answers" ON public.online_exam_answers FOR ALL
USING (EXISTS (
  SELECT 1 FROM online_exam_attempts a 
  JOIN students s ON a.student_id = s.id 
  WHERE a.id = online_exam_answers.attempt_id AND s.user_id = auth.uid()
));

CREATE POLICY "Teachers can view answers" ON public.online_exam_answers FOR SELECT
USING (has_role(auth.uid(), 'teacher'));

CREATE POLICY "Admins can view answers" ON public.online_exam_answers FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for exam_attendance
CREATE POLICY "Teachers can manage exam attendance" ON public.exam_attendance FOR ALL
USING (has_role(auth.uid(), 'teacher'));

CREATE POLICY "Admins can manage exam attendance" ON public.exam_attendance FOR ALL
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Students can view own exam attendance" ON public.exam_attendance FOR SELECT
USING (EXISTS (SELECT 1 FROM students WHERE user_id = auth.uid() AND id = exam_attendance.student_id));

CREATE POLICY "Parents can view children exam attendance" ON public.exam_attendance FOR SELECT
USING (EXISTS (
  SELECT 1 FROM students s JOIN parents p ON s.guardian_id = p.id
  WHERE p.user_id = auth.uid() AND s.id = exam_attendance.student_id
));