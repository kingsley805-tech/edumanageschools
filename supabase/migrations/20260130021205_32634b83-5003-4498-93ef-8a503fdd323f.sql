-- ==========================================
-- CONSOLIDATED SCHEMA FOR SCHOOL MANAGEMENT SYSTEM
-- ==========================================

-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'teacher', 'parent', 'student', 'super_admin');

-- ==========================================
-- CORE TABLES
-- ==========================================

-- Schools table for multi-tenancy
CREATE TABLE public.schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_code TEXT UNIQUE NOT NULL,
  school_name TEXT NOT NULL,
  admin_key TEXT,
  logo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  is_active BOOLEAN DEFAULT true
);

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  school_id UUID REFERENCES public.schools(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- Classes table
CREATE TABLE public.classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  level TEXT,
  school_id UUID REFERENCES public.schools(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subjects table
CREATE TABLE public.subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT,
  school_id UUID REFERENCES public.schools(id)
);

-- Teachers table
CREATE TABLE public.teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  employee_no TEXT UNIQUE,
  subject_specialty TEXT,
  school_id UUID REFERENCES public.schools(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Parents table
CREATE TABLE public.parents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  address TEXT,
  phone TEXT,
  emergency_contact TEXT,
  school_id UUID REFERENCES public.schools(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Students table
CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  admission_no TEXT UNIQUE,
  date_of_birth DATE,
  gender TEXT,
  class_id UUID REFERENCES classes(id),
  guardian_id UUID REFERENCES parents(id),
  school_id UUID REFERENCES public.schools(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Class subjects table
CREATE TABLE public.class_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID REFERENCES classes(id),
  subject_id UUID REFERENCES subjects(id),
  teacher_id UUID REFERENCES teachers(id)
);

-- Enrollments table
CREATE TABLE public.enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id),
  class_id UUID REFERENCES classes(id),
  enrolled_on DATE,
  status TEXT DEFAULT 'active'
);

-- Schedules table for timetable
CREATE TABLE public.schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  room TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT valid_time_range CHECK (end_time > start_time)
);

-- ==========================================
-- ATTENDANCE & GRADES
-- ==========================================

-- Attendance table
CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id),
  class_id UUID REFERENCES classes(id),
  date DATE NOT NULL,
  status TEXT NOT NULL,
  recorded_by UUID REFERENCES auth.users(id),
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Grades table
CREATE TABLE public.grades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id),
  subject_id UUID REFERENCES subjects(id),
  term TEXT,
  score NUMERIC(5,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT grades_student_subject_term_unique UNIQUE (student_id, subject_id, term)
);

-- Exam types
CREATE TABLE public.exam_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID REFERENCES public.schools(id),
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'term',
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Grade scales
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

-- Class grading configuration
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

-- ==========================================
-- EXAMS & ONLINE EXAMS
-- ==========================================

-- Exams table
CREATE TABLE public.exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  exam_type_id UUID REFERENCES public.exam_types(id),
  exam_date DATE NOT NULL,
  duration_minutes INTEGER NOT NULL,
  total_marks INTEGER NOT NULL,
  term TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Exam results table
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

-- Exam attendance
CREATE TABLE public.exam_attendance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  exam_id UUID REFERENCES public.exams(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'present',
  recorded_by UUID REFERENCES auth.users(id),
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(exam_id, student_id)
);

-- Question bank for online exams
CREATE TABLE public.question_bank (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID REFERENCES public.schools(id),
  subject_id UUID REFERENCES public.subjects(id),
  question_type TEXT NOT NULL,
  question_text TEXT NOT NULL,
  options JSONB,
  correct_answer TEXT NOT NULL,
  marks NUMERIC NOT NULL DEFAULT 1,
  difficulty TEXT DEFAULT 'medium',
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
  shuffle_answers BOOLEAN DEFAULT false,
  show_result_immediately BOOLEAN DEFAULT true,
  is_published BOOLEAN NOT NULL DEFAULT false,
  proctoring_enabled BOOLEAN DEFAULT false,
  fullscreen_required BOOLEAN DEFAULT true,
  tab_switch_limit INTEGER DEFAULT 3,
  webcam_required BOOLEAN DEFAULT false,
  question_pool_size INTEGER DEFAULT NULL,
  questions_to_answer INTEGER DEFAULT NULL,
  term TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Online exam questions
CREATE TABLE public.online_exam_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  online_exam_id UUID REFERENCES public.online_exams(id) ON DELETE CASCADE,
  question_id UUID REFERENCES public.question_bank(id) ON DELETE SET NULL,
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
  status TEXT DEFAULT 'in_progress',
  assigned_questions JSONB DEFAULT NULL,
  UNIQUE(online_exam_id, student_id)
);

-- Student answers for online exams
CREATE TABLE public.online_exam_answers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  attempt_id UUID REFERENCES public.online_exam_attempts(id) ON DELETE CASCADE,
  question_id UUID REFERENCES public.question_bank(id) ON DELETE SET NULL,
  student_answer TEXT,
  is_correct BOOLEAN,
  marks_obtained NUMERIC DEFAULT 0
);

-- Exam time extensions
CREATE TABLE public.exam_time_extensions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  attempt_id UUID NOT NULL REFERENCES public.online_exam_attempts(id) ON DELETE CASCADE,
  extended_by UUID NOT NULL,
  extension_minutes INTEGER NOT NULL DEFAULT 0,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Exam proctoring logs
CREATE TABLE public.exam_proctoring_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  attempt_id UUID REFERENCES public.online_exam_attempts(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  violation_type TEXT NOT NULL,
  description TEXT,
  snapshot_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Exam summary reports
CREATE TABLE public.exam_summary_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  online_exam_id UUID REFERENCES public.online_exams(id) ON DELETE CASCADE,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  total_students INTEGER DEFAULT 0,
  students_attempted INTEGER DEFAULT 0,
  students_passed INTEGER DEFAULT 0,
  average_score NUMERIC(5,2),
  highest_score NUMERIC(5,2),
  lowest_score NUMERIC(5,2),
  question_analytics JSONB,
  grade_distribution JSONB,
  created_by UUID
);

-- ==========================================
-- ASSIGNMENTS & RESOURCES
-- ==========================================

-- Assignments table
CREATE TABLE public.assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  file_url TEXT,
  class_id UUID REFERENCES classes(id),
  subject_id UUID REFERENCES subjects(id),
  due_date TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Submissions table
CREATE TABLE public.submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID REFERENCES assignments(id),
  student_id UUID REFERENCES students(id),
  file_url TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  grade NUMERIC(5,2)
);

-- Resources table
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

-- ==========================================
-- FEES & PAYMENTS
-- ==========================================

-- Fee structures table
CREATE TABLE public.fee_structures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  amount NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Invoices table
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_no TEXT UNIQUE,
  student_id UUID REFERENCES students(id),
  fee_structure_id UUID REFERENCES fee_structures(id),
  amount NUMERIC(12,2) NOT NULL,
  status TEXT DEFAULT 'unpaid',
  due_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payments table
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES invoices(id),
  payer_user_id UUID REFERENCES auth.users(id),
  amount NUMERIC(12,2),
  payment_provider TEXT,
  provider_reference TEXT,
  status TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- COMMUNICATION
-- ==========================================

-- Messages table
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES auth.users(id),
  receiver_id UUID REFERENCES auth.users(id),
  subject TEXT,
  body TEXT,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  title TEXT,
  body TEXT,
  data JSONB,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Announcements table
CREATE TABLE public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  school_id UUID REFERENCES public.schools(id),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  target_roles TEXT[] DEFAULT ARRAY['admin', 'teacher', 'parent', 'student']
);

-- ==========================================
-- ADMIN & REGISTRATION
-- ==========================================

-- Super admin schools
CREATE TABLE public.super_admin_schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, school_id)
);

-- Registration numbers
CREATE TABLE public.registration_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  number_type TEXT NOT NULL CHECK (number_type IN ('student', 'employee')),
  registration_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unused' CHECK (status IN ('unused', 'used')),
  assigned_user_id UUID REFERENCES public.profiles(id),
  generated_by UUID REFERENCES public.profiles(id),
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  used_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(school_id, registration_number)
);

-- Parent student links
CREATE TABLE public.parent_student_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID NOT NULL REFERENCES public.parents(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  relationship TEXT DEFAULT 'parent',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(parent_id, student_id)
);

-- Audit logs
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES public.schools(id),
  action_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  performed_by UUID REFERENCES public.profiles(id),
  details JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ==========================================
-- ENABLE RLS ON ALL TABLES
-- ==========================================

ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grade_scales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_grading_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_bank ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.online_exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.online_exam_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.online_exam_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.online_exam_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_time_extensions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_proctoring_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_summary_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.super_admin_schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registration_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parent_student_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- SECURITY DEFINER FUNCTIONS
-- ==========================================

-- Check if user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Get user's school_id
CREATE OR REPLACE FUNCTION public.get_user_school_id(_user_id UUID)
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT school_id FROM public.profiles WHERE id = _user_id
$$;

-- Check if teacher can view student
CREATE OR REPLACE FUNCTION public.teacher_can_view_student(teacher_user_id UUID, student_class_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM teachers t
    JOIN class_subjects cs ON cs.teacher_id = t.id
    WHERE t.user_id = teacher_user_id
    AND cs.class_id = student_class_id
  )
$$;

-- Check if teacher can view parent
CREATE OR REPLACE FUNCTION public.teacher_can_view_parent(teacher_user_id UUID, parent_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM teachers t
    JOIN class_subjects cs ON cs.teacher_id = t.id
    JOIN students s ON s.class_id = cs.class_id
    WHERE t.user_id = teacher_user_id
    AND s.guardian_id = parent_id
  )
$$;

-- Check if parent can view teacher
CREATE OR REPLACE FUNCTION public.parent_can_view_teacher(parent_user_id UUID, teacher_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM parents p
    JOIN students s ON s.guardian_id = p.id
    JOIN class_subjects cs ON cs.class_id = s.class_id
    WHERE p.user_id = parent_user_id
    AND cs.teacher_id = teacher_id
  )
$$;

-- Profile helper functions
CREATE OR REPLACE FUNCTION public.get_teacher_student_user_ids(_teacher_user_id UUID)
RETURNS SETOF UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT s.user_id
  FROM teachers t
  JOIN class_subjects cs ON cs.teacher_id = t.id
  JOIN students s ON s.class_id = cs.class_id
  WHERE t.user_id = _teacher_user_id
$$;

CREATE OR REPLACE FUNCTION public.get_teacher_parent_user_ids(_teacher_user_id UUID)
RETURNS SETOF UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT p.user_id
  FROM teachers t
  JOIN class_subjects cs ON cs.teacher_id = t.id
  JOIN students s ON s.class_id = cs.class_id
  JOIN parents p ON p.id = s.guardian_id
  WHERE t.user_id = _teacher_user_id
$$;

CREATE OR REPLACE FUNCTION public.get_school_teacher_user_ids(_teacher_user_id UUID)
RETURNS SETOF UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t2.user_id
  FROM teachers t1
  JOIN teachers t2 ON t1.school_id = t2.school_id
  WHERE t1.user_id = _teacher_user_id
$$;

CREATE OR REPLACE FUNCTION public.get_parent_children_user_ids(_parent_user_id UUID)
RETURNS SETOF UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.user_id
  FROM parents p
  JOIN students s ON s.guardian_id = p.id
  WHERE p.user_id = _parent_user_id
$$;

CREATE OR REPLACE FUNCTION public.get_parent_teacher_user_ids(_parent_user_id UUID)
RETURNS SETOF UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT t.user_id
  FROM parents p
  JOIN students s ON s.guardian_id = p.id
  JOIN class_subjects cs ON cs.class_id = s.class_id
  JOIN teachers t ON t.id = cs.teacher_id
  WHERE p.user_id = _parent_user_id
$$;

CREATE OR REPLACE FUNCTION public.get_student_teacher_user_ids(_student_user_id UUID)
RETURNS SETOF UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT t.user_id
  FROM students s
  JOIN class_subjects cs ON cs.class_id = s.class_id
  JOIN teachers t ON t.id = cs.teacher_id
  WHERE s.user_id = _student_user_id
$$;

CREATE OR REPLACE FUNCTION public.get_student_classmate_user_ids(_student_user_id UUID)
RETURNS SETOF UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s2.user_id
  FROM students s1
  JOIN students s2 ON s1.class_id = s2.class_id
  WHERE s1.user_id = _student_user_id
$$;

-- Create notification function
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id UUID,
  p_title TEXT,
  p_body TEXT,
  p_data JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- ==========================================
-- USER REGISTRATION HANDLER
-- ==========================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_school_id UUID;
  v_school_code TEXT;
  v_school_name TEXT;
  v_role app_role;
  v_admin_key TEXT;
  v_super_admin_key TEXT;
  v_registration_number TEXT;
  v_gender TEXT;
BEGIN
  v_role := (NEW.raw_user_meta_data->>'role')::app_role;
  v_school_code := NEW.raw_user_meta_data->>'school_code';
  v_registration_number := NEW.raw_user_meta_data->>'registration_number';
  v_gender := NEW.raw_user_meta_data->>'gender';
  
  IF v_role = 'super_admin' THEN
    SELECT decrypted_secret INTO v_super_admin_key
    FROM vault.decrypted_secrets
    WHERE name = 'SUPER_ADMIN'
    LIMIT 1;
    
    IF NEW.raw_user_meta_data->>'admin_key' != v_super_admin_key THEN
      RAISE EXCEPTION 'Invalid super admin key';
    END IF;
    
    v_school_id := NULL;
    
    INSERT INTO public.profiles (id, email, full_name, school_id)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name', v_school_id);
    
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, v_role);
    
    RETURN NEW;
  END IF;
  
  IF v_role = 'admin' THEN
    SELECT decrypted_secret INTO v_admin_key
    FROM vault.decrypted_secrets
    WHERE name = 'ADMIN_ID'
    LIMIT 1;
    
    IF v_admin_key IS NULL THEN
      v_admin_key := current_setting('app.settings.admin_id', true);
    END IF;
    
    IF NEW.raw_user_meta_data->>'admin_key' != v_admin_key THEN
      RAISE EXCEPTION 'Invalid admin key';
    END IF;
    
    v_school_name := NEW.raw_user_meta_data->>'school_name';
    
    IF EXISTS (SELECT 1 FROM public.schools WHERE school_code = v_school_code) THEN
      RAISE EXCEPTION 'School code already exists. Please choose a different code.';
    END IF;
    
    INSERT INTO public.schools (school_code, school_name, is_active)
    VALUES (v_school_code, v_school_name, true)
    RETURNING id INTO v_school_id;
  ELSE
    SELECT id INTO v_school_id
    FROM public.schools
    WHERE school_code = v_school_code
    AND is_active = true;
    
    IF v_school_id IS NULL THEN
      RAISE EXCEPTION 'Invalid school code';
    END IF;
  END IF;
  
  INSERT INTO public.profiles (id, email, full_name, school_id)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name', v_school_id);
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, v_role);
  
  IF v_role = 'student' THEN
    INSERT INTO public.students (user_id, school_id, admission_no, gender)
    VALUES (
      NEW.id, 
      v_school_id, 
      NULLIF(v_registration_number, ''),
      NULLIF(v_gender, '')
    );
  ELSIF v_role = 'teacher' THEN
    INSERT INTO public.teachers (user_id, school_id, employee_no)
    VALUES (
      NEW.id, 
      v_school_id,
      NULLIF(v_registration_number, '')
    );
  ELSIF v_role = 'parent' THEN
    INSERT INTO public.parents (user_id, school_id)
    VALUES (NEW.id, v_school_id);
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==========================================
-- REGISTRATION NUMBER TRIGGERS
-- ==========================================

CREATE OR REPLACE FUNCTION public.mark_student_registration_used()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.admission_no IS NOT NULL AND NEW.school_id IS NOT NULL THEN
    UPDATE registration_numbers
    SET 
      status = 'used',
      assigned_user_id = NEW.user_id,
      used_at = NOW()
    WHERE registration_number = NEW.admission_no
      AND school_id = NEW.school_id
      AND number_type = 'student'
      AND status = 'unused';
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_teacher_registration_used()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.employee_no IS NOT NULL AND NEW.school_id IS NOT NULL THEN
    UPDATE registration_numbers
    SET 
      status = 'used',
      assigned_user_id = NEW.user_id,
      used_at = NOW()
    WHERE registration_number = NEW.employee_no
      AND school_id = NEW.school_id
      AND number_type = 'employee'
      AND status = 'unused';
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER mark_student_registration_used
  AFTER INSERT OR UPDATE OF admission_no ON public.students
  FOR EACH ROW
  EXECUTE FUNCTION public.mark_student_registration_used();

CREATE TRIGGER mark_teacher_registration_used
  AFTER INSERT OR UPDATE OF employee_no ON public.teachers
  FOR EACH ROW
  EXECUTE FUNCTION public.mark_teacher_registration_used();

-- ==========================================
-- RLS POLICIES - SCHOOLS
-- ==========================================

CREATE POLICY "Allow anonymous school code verification" ON public.schools FOR SELECT TO anon USING (true);
CREATE POLICY "Users can view their own school" ON public.schools FOR SELECT TO authenticated USING (id = get_user_school_id(auth.uid()));
CREATE POLICY "Admins can update own school" ON public.schools FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN profiles p ON p.id = ur.user_id
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('admin', 'super_admin')
    AND p.school_id = schools.id
  )
);

-- ==========================================
-- RLS POLICIES - PROFILES
-- ==========================================

CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can view school profiles" ON public.profiles FOR SELECT USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND school_id = get_user_school_id(auth.uid())
);

CREATE POLICY "Teachers can view relevant profiles" ON public.profiles FOR SELECT USING (
  has_role(auth.uid(), 'teacher'::app_role) 
  AND (
    id IN (SELECT get_teacher_student_user_ids(auth.uid()))
    OR id IN (SELECT get_teacher_parent_user_ids(auth.uid()))
    OR id IN (SELECT get_school_teacher_user_ids(auth.uid()))
  )
);

CREATE POLICY "Parents can view relevant profiles" ON public.profiles FOR SELECT USING (
  has_role(auth.uid(), 'parent'::app_role)
  AND (
    id IN (SELECT get_parent_children_user_ids(auth.uid()))
    OR id IN (SELECT get_parent_teacher_user_ids(auth.uid()))
  )
);

CREATE POLICY "Students can view relevant profiles" ON public.profiles FOR SELECT USING (
  has_role(auth.uid(), 'student'::app_role)
  AND (
    id IN (SELECT get_student_teacher_user_ids(auth.uid()))
    OR id IN (SELECT get_student_classmate_user_ids(auth.uid()))
  )
);

-- ==========================================
-- RLS POLICIES - USER ROLES
-- ==========================================

CREATE POLICY "Users can view own roles" ON user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage roles" ON user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- ==========================================
-- RLS POLICIES - CLASSES
-- ==========================================

CREATE POLICY "Users can view school classes" ON public.classes FOR SELECT USING (school_id = get_user_school_id(auth.uid()));
CREATE POLICY "Admins can insert school classes" ON public.classes FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin') AND school_id = get_user_school_id(auth.uid()));
CREATE POLICY "Admins can update school classes" ON public.classes FOR UPDATE USING (has_role(auth.uid(), 'admin') AND school_id = get_user_school_id(auth.uid()));
CREATE POLICY "Admins can delete school classes" ON public.classes FOR DELETE USING (has_role(auth.uid(), 'admin') AND school_id = get_user_school_id(auth.uid()));

-- ==========================================
-- RLS POLICIES - SUBJECTS
-- ==========================================

CREATE POLICY "Users can view school subjects" ON public.subjects FOR SELECT USING (school_id = get_user_school_id(auth.uid()));
CREATE POLICY "Admins can insert school subjects" ON public.subjects FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin') AND school_id = get_user_school_id(auth.uid()));
CREATE POLICY "Admins can update school subjects" ON public.subjects FOR UPDATE USING (has_role(auth.uid(), 'admin') AND school_id = get_user_school_id(auth.uid()));
CREATE POLICY "Admins can delete school subjects" ON public.subjects FOR DELETE USING (has_role(auth.uid(), 'admin') AND school_id = get_user_school_id(auth.uid()));

-- ==========================================
-- RLS POLICIES - TEACHERS
-- ==========================================

CREATE POLICY "Admins can view school teachers" ON public.teachers FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role) AND school_id = get_user_school_id(auth.uid()));
CREATE POLICY "Teachers can view school teachers" ON public.teachers FOR SELECT USING (has_role(auth.uid(), 'teacher'::app_role) AND school_id = get_user_school_id(auth.uid()));
CREATE POLICY "Parents can view children teachers" ON public.teachers FOR SELECT USING (has_role(auth.uid(), 'parent'::app_role) AND school_id = get_user_school_id(auth.uid()));
CREATE POLICY "Students can view school teachers" ON public.teachers FOR SELECT USING (has_role(auth.uid(), 'student'::app_role) AND school_id = get_user_school_id(auth.uid()));
CREATE POLICY "Admins can insert school teachers" ON public.teachers FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND school_id = get_user_school_id(auth.uid()));
CREATE POLICY "Admins can update school teachers" ON public.teachers FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role) AND school_id = get_user_school_id(auth.uid()));
CREATE POLICY "Admins can delete school teachers" ON public.teachers FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role) AND school_id = get_user_school_id(auth.uid()));
CREATE POLICY "Teachers can update own profile" ON public.teachers FOR UPDATE USING (auth.uid() = user_id);

-- ==========================================
-- RLS POLICIES - PARENTS
-- ==========================================

CREATE POLICY "Parents can view own profile" ON parents FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view school parents" ON public.parents FOR SELECT USING (has_role(auth.uid(), 'admin') AND school_id = get_user_school_id(auth.uid()));
CREATE POLICY "Admins can insert school parents" ON public.parents FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin') AND school_id = get_user_school_id(auth.uid()));
CREATE POLICY "Admins can update school parents" ON public.parents FOR UPDATE USING (has_role(auth.uid(), 'admin') AND school_id = get_user_school_id(auth.uid()));
CREATE POLICY "Admins can delete school parents" ON public.parents FOR DELETE USING (has_role(auth.uid(), 'admin') AND school_id = get_user_school_id(auth.uid()));
CREATE POLICY "Teachers can view parents of their students" ON public.parents FOR SELECT USING (has_role(auth.uid(), 'teacher'::app_role) AND teacher_can_view_parent(auth.uid(), id));

-- ==========================================
-- RLS POLICIES - STUDENTS
-- ==========================================

CREATE POLICY "Students can view own profile" ON students FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Parents can view their children" ON students FOR SELECT USING (EXISTS (SELECT 1 FROM parents WHERE parents.user_id = auth.uid() AND parents.id = students.guardian_id));
CREATE POLICY "Teachers can view assigned students" ON public.students FOR SELECT USING (has_role(auth.uid(), 'teacher'::app_role) AND teacher_can_view_student(auth.uid(), class_id));
CREATE POLICY "Admins can view school students" ON public.students FOR SELECT USING (has_role(auth.uid(), 'admin') AND school_id = get_user_school_id(auth.uid()));
CREATE POLICY "Admins can manage school students" ON public.students FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin') AND school_id = get_user_school_id(auth.uid()));
CREATE POLICY "Admins can update school students" ON public.students FOR UPDATE USING (has_role(auth.uid(), 'admin') AND school_id = get_user_school_id(auth.uid()));
CREATE POLICY "Admins can delete school students" ON public.students FOR DELETE USING (has_role(auth.uid(), 'admin') AND school_id = get_user_school_id(auth.uid()));

-- ==========================================
-- RLS POLICIES - CLASS SUBJECTS
-- ==========================================

CREATE POLICY "Everyone can view class subjects" ON class_subjects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage class subjects" ON class_subjects FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Teachers can manage class subjects" ON class_subjects FOR ALL USING (public.has_role(auth.uid(), 'teacher'));

-- ==========================================
-- RLS POLICIES - SCHEDULES
-- ==========================================

CREATE POLICY "Admins can manage schedules" ON public.schedules FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Teachers can view schedules" ON public.schedules FOR SELECT TO authenticated USING (has_role(auth.uid(), 'teacher'::app_role));
CREATE POLICY "Students can view their class schedules" ON public.schedules FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM students WHERE students.user_id = auth.uid() AND students.class_id = schedules.class_id));
CREATE POLICY "Parents can view children schedules" ON public.schedules FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM students s JOIN parents p ON s.guardian_id = p.id WHERE p.user_id = auth.uid() AND s.class_id = schedules.class_id));

-- ==========================================
-- RLS POLICIES - ATTENDANCE
-- ==========================================

CREATE POLICY "Students can view own attendance" ON attendance FOR SELECT USING (EXISTS (SELECT 1 FROM students WHERE students.user_id = auth.uid() AND students.id = attendance.student_id));
CREATE POLICY "Parents can view children attendance" ON attendance FOR SELECT USING (EXISTS (SELECT 1 FROM students s JOIN parents p ON s.guardian_id = p.id WHERE p.user_id = auth.uid() AND s.id = attendance.student_id));
CREATE POLICY "Teachers can manage attendance" ON attendance FOR ALL USING (public.has_role(auth.uid(), 'teacher'));
CREATE POLICY "Admins can manage attendance" ON attendance FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- ==========================================
-- RLS POLICIES - GRADES
-- ==========================================

CREATE POLICY "Students can view own grades" ON grades FOR SELECT USING (EXISTS (SELECT 1 FROM students WHERE students.user_id = auth.uid() AND students.id = grades.student_id));
CREATE POLICY "Parents can view children grades" ON grades FOR SELECT USING (EXISTS (SELECT 1 FROM students s JOIN parents p ON s.guardian_id = p.id WHERE p.user_id = auth.uid() AND s.id = grades.student_id));
CREATE POLICY "Teachers can manage grades" ON grades FOR ALL USING (public.has_role(auth.uid(), 'teacher'));
CREATE POLICY "Admins can view grades" ON grades FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- ==========================================
-- RLS POLICIES - EXAM TYPES & GRADE SCALES
-- ==========================================

CREATE POLICY "Users can view school exam types" ON public.exam_types FOR SELECT USING (school_id = get_user_school_id(auth.uid()));
CREATE POLICY "Admins can manage exam types" ON public.exam_types FOR ALL USING (has_role(auth.uid(), 'admin') AND school_id = get_user_school_id(auth.uid()));
CREATE POLICY "Users can view school grade scales" ON public.grade_scales FOR SELECT USING (school_id = get_user_school_id(auth.uid()));
CREATE POLICY "Admins can manage grade scales" ON public.grade_scales FOR ALL USING (has_role(auth.uid(), 'admin') AND school_id = get_user_school_id(auth.uid()));
CREATE POLICY "Users can view class grading config" ON public.class_grading_config FOR SELECT USING (true);
CREATE POLICY "Admins can manage class grading config" ON public.class_grading_config FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Teachers can manage class grading config" ON public.class_grading_config FOR ALL USING (has_role(auth.uid(), 'teacher'));

-- ==========================================
-- RLS POLICIES - EXAMS
-- ==========================================

CREATE POLICY "Admins can manage exams" ON public.exams FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Teachers can manage exams" ON public.exams FOR ALL USING (has_role(auth.uid(), 'teacher'));
CREATE POLICY "Students can view exams" ON public.exams FOR SELECT USING (has_role(auth.uid(), 'student') AND EXISTS (SELECT 1 FROM students WHERE students.user_id = auth.uid() AND students.class_id = exams.class_id));
CREATE POLICY "Admins can manage exam results" ON public.exam_results FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Teachers can manage exam results" ON public.exam_results FOR ALL USING (has_role(auth.uid(), 'teacher'));
CREATE POLICY "Students can view own exam results" ON public.exam_results FOR SELECT USING (EXISTS (SELECT 1 FROM students WHERE students.user_id = auth.uid() AND students.id = exam_results.student_id));
CREATE POLICY "Parents can view children exam results" ON public.exam_results FOR SELECT USING (EXISTS (SELECT 1 FROM students s JOIN parents p ON s.guardian_id = p.id WHERE p.user_id = auth.uid() AND s.id = exam_results.student_id));
CREATE POLICY "Teachers can manage exam attendance" ON public.exam_attendance FOR ALL USING (has_role(auth.uid(), 'teacher'));
CREATE POLICY "Admins can manage exam attendance" ON public.exam_attendance FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Students can view own exam attendance" ON public.exam_attendance FOR SELECT USING (EXISTS (SELECT 1 FROM students WHERE user_id = auth.uid() AND id = exam_attendance.student_id));
CREATE POLICY "Parents can view children exam attendance" ON public.exam_attendance FOR SELECT USING (EXISTS (SELECT 1 FROM students s JOIN parents p ON s.guardian_id = p.id WHERE p.user_id = auth.uid() AND s.id = exam_attendance.student_id));

-- ==========================================
-- RLS POLICIES - QUESTION BANK & ONLINE EXAMS
-- ==========================================

CREATE POLICY "Teachers can manage question bank" ON public.question_bank FOR ALL USING (has_role(auth.uid(), 'teacher'));
CREATE POLICY "Admins can manage question bank" ON public.question_bank FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Students can view questions from their class exams" ON public.question_bank FOR SELECT USING (has_role(auth.uid(), 'student') AND EXISTS (SELECT 1 FROM online_exam_questions oeq JOIN online_exams oe ON oeq.online_exam_id = oe.id JOIN students s ON s.class_id = oe.class_id WHERE oeq.question_id = question_bank.id AND s.user_id = auth.uid()));

CREATE POLICY "Teachers can manage online exams" ON public.online_exams FOR ALL USING (has_role(auth.uid(), 'teacher'));
CREATE POLICY "Admins can manage online exams" ON public.online_exams FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Students can view their class online exams" ON public.online_exams FOR SELECT USING (has_role(auth.uid(), 'student') AND EXISTS (SELECT 1 FROM students WHERE user_id = auth.uid() AND class_id = online_exams.class_id));

CREATE POLICY "Teachers can manage exam questions" ON public.online_exam_questions FOR ALL USING (has_role(auth.uid(), 'teacher'));
CREATE POLICY "Admins can manage exam questions" ON public.online_exam_questions FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Students can view exam questions" ON public.online_exam_questions FOR SELECT USING (has_role(auth.uid(), 'student'));

CREATE POLICY "Students can manage own attempts" ON public.online_exam_attempts FOR ALL USING (EXISTS (SELECT 1 FROM students WHERE user_id = auth.uid() AND id = online_exam_attempts.student_id));
CREATE POLICY "Teachers can view attempts" ON public.online_exam_attempts FOR SELECT USING (has_role(auth.uid(), 'teacher'));
CREATE POLICY "Admins can view attempts" ON public.online_exam_attempts FOR SELECT USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Students can manage own answers" ON public.online_exam_answers FOR ALL USING (EXISTS (SELECT 1 FROM online_exam_attempts a JOIN students s ON a.student_id = s.id WHERE a.id = online_exam_answers.attempt_id AND s.user_id = auth.uid()));
CREATE POLICY "Teachers can view answers" ON public.online_exam_answers FOR SELECT USING (has_role(auth.uid(), 'teacher'));
CREATE POLICY "Admins can view answers" ON public.online_exam_answers FOR SELECT USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Teachers can create time extensions for their exams" ON public.exam_time_extensions FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM online_exam_attempts oea JOIN online_exams oe ON oea.online_exam_id = oe.id WHERE oea.id = attempt_id AND oe.created_by = auth.uid()));
CREATE POLICY "Teachers can view time extensions for their exams" ON public.exam_time_extensions FOR SELECT USING (EXISTS (SELECT 1 FROM online_exam_attempts oea JOIN online_exams oe ON oea.online_exam_id = oe.id WHERE oea.id = attempt_id AND oe.created_by = auth.uid()));
CREATE POLICY "Students can view their own time extensions" ON public.exam_time_extensions FOR SELECT USING (EXISTS (SELECT 1 FROM online_exam_attempts oea JOIN students s ON oea.student_id = s.id WHERE oea.id = attempt_id AND s.user_id = auth.uid()));

CREATE POLICY "Teachers can view proctoring logs for their exams" ON public.exam_proctoring_logs FOR SELECT USING (EXISTS (SELECT 1 FROM online_exam_attempts oea JOIN online_exams oe ON oea.online_exam_id = oe.id WHERE oea.id = exam_proctoring_logs.attempt_id AND oe.created_by = auth.uid()));
CREATE POLICY "Students can insert their own proctoring logs" ON public.exam_proctoring_logs FOR INSERT WITH CHECK (student_id IN (SELECT id FROM students WHERE user_id = auth.uid()));

CREATE POLICY "Teachers can view their exam reports" ON public.exam_summary_reports FOR SELECT USING (EXISTS (SELECT 1 FROM online_exams WHERE id = exam_summary_reports.online_exam_id AND created_by = auth.uid()));
CREATE POLICY "Teachers can insert exam reports" ON public.exam_summary_reports FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM online_exams WHERE id = online_exam_id AND created_by = auth.uid()));
CREATE POLICY "Teachers can update their exam reports" ON public.exam_summary_reports FOR UPDATE USING (EXISTS (SELECT 1 FROM online_exams WHERE id = exam_summary_reports.online_exam_id AND created_by = auth.uid()));
CREATE POLICY "Teachers can delete their exam reports" ON public.exam_summary_reports FOR DELETE USING (EXISTS (SELECT 1 FROM online_exams WHERE id = exam_summary_reports.online_exam_id AND created_by = auth.uid()));

-- ==========================================
-- RLS POLICIES - ASSIGNMENTS & SUBMISSIONS
-- ==========================================

CREATE POLICY "Students can view assignments" ON assignments FOR SELECT USING (public.has_role(auth.uid(), 'student'));
CREATE POLICY "Teachers can manage assignments" ON assignments FOR ALL USING (public.has_role(auth.uid(), 'teacher'));
CREATE POLICY "Admins can view assignments" ON assignments FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Students can manage own submissions" ON submissions FOR ALL USING (EXISTS (SELECT 1 FROM students WHERE students.user_id = auth.uid() AND students.id = submissions.student_id));
CREATE POLICY "Teachers can view submissions" ON submissions FOR SELECT USING (public.has_role(auth.uid(), 'teacher'));
CREATE POLICY "Teachers can grade submissions" ON submissions FOR UPDATE USING (public.has_role(auth.uid(), 'teacher'));

-- ==========================================
-- RLS POLICIES - RESOURCES
-- ==========================================

CREATE POLICY "Admins can manage resources" ON public.resources FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Teachers can manage resources" ON public.resources FOR ALL USING (has_role(auth.uid(), 'teacher'));
CREATE POLICY "Students can view resources" ON public.resources FOR SELECT USING (has_role(auth.uid(), 'student') AND EXISTS (SELECT 1 FROM students WHERE students.user_id = auth.uid() AND students.class_id = resources.class_id));
CREATE POLICY "Parents can view children resources" ON public.resources FOR SELECT USING (EXISTS (SELECT 1 FROM students s JOIN parents p ON s.guardian_id = p.id WHERE p.user_id = auth.uid() AND s.class_id = resources.class_id));

-- ==========================================
-- RLS POLICIES - FEES & PAYMENTS
-- ==========================================

CREATE POLICY "Everyone can view fee structures" ON fee_structures FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage fee structures" ON fee_structures FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Students can view own invoices" ON invoices FOR SELECT USING (EXISTS (SELECT 1 FROM students WHERE students.user_id = auth.uid() AND students.id = invoices.student_id));
CREATE POLICY "Parents can view children invoices" ON invoices FOR SELECT USING (EXISTS (SELECT 1 FROM students s JOIN parents p ON s.guardian_id = p.id WHERE p.user_id = auth.uid() AND s.id = invoices.student_id));
CREATE POLICY "Admins can manage invoices" ON invoices FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own payments" ON payments FOR SELECT USING (auth.uid() = payer_user_id);
CREATE POLICY "Parents can create payments" ON payments FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'parent'));
CREATE POLICY "Admins can manage payments" ON payments FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- ==========================================
-- RLS POLICIES - MESSAGES & NOTIFICATIONS
-- ==========================================

CREATE POLICY "Users can view own messages" ON messages FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "Users can send messages" ON messages FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Users can update received messages" ON messages FOR UPDATE USING (auth.uid() = receiver_id);

CREATE POLICY "Users can view own notifications" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view school announcements" ON public.announcements FOR SELECT USING (school_id = get_user_school_id(auth.uid()) OR has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Admins can manage school announcements" ON public.announcements FOR ALL USING ((has_role(auth.uid(), 'admin') AND school_id = get_user_school_id(auth.uid())) OR has_role(auth.uid(), 'super_admin'));

-- ==========================================
-- RLS POLICIES - ENROLLMENTS
-- ==========================================

CREATE POLICY "Students can view own enrollments" ON enrollments FOR SELECT USING (EXISTS (SELECT 1 FROM students WHERE students.user_id = auth.uid() AND students.id = enrollments.student_id));
CREATE POLICY "Parents can view children enrollments" ON enrollments FOR SELECT USING (EXISTS (SELECT 1 FROM students s JOIN parents p ON s.guardian_id = p.id WHERE p.user_id = auth.uid() AND s.id = enrollments.student_id));
CREATE POLICY "Teachers can view enrollments" ON enrollments FOR SELECT USING (public.has_role(auth.uid(), 'teacher'));
CREATE POLICY "Admins can manage enrollments" ON enrollments FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- ==========================================
-- RLS POLICIES - ADMIN TABLES
-- ==========================================

CREATE POLICY "Super admins can view their assigned schools" ON public.super_admin_schools FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Super admins can manage their school assignments" ON public.super_admin_schools FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'super_admin'::app_role));

CREATE POLICY "Admins can manage registration numbers" ON public.registration_numbers FOR ALL USING (has_role(auth.uid(), 'admin') AND school_id = get_user_school_id(auth.uid()));
CREATE POLICY "Anyone can check if registration number exists" ON public.registration_numbers FOR SELECT USING (true);

CREATE POLICY "Admins can manage parent student links" ON public.parent_student_links FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Parents can view their links" ON public.parent_student_links FOR SELECT USING (EXISTS (SELECT 1 FROM public.parents p WHERE p.id = parent_student_links.parent_id AND p.user_id = auth.uid()));
CREATE POLICY "Parents can insert their links" ON public.parent_student_links FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.parents p WHERE p.id = parent_student_links.parent_id AND p.user_id = auth.uid()));

CREATE POLICY "Admins can view school audit logs" ON public.audit_logs FOR SELECT USING (has_role(auth.uid(), 'admin') AND school_id = get_user_school_id(auth.uid()));
CREATE POLICY "Authenticated users can insert audit logs" ON public.audit_logs FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ==========================================
-- INDEXES
-- ==========================================

CREATE INDEX idx_attendance_date ON attendance(date);
CREATE INDEX idx_attendance_student_class ON attendance(student_id, class_id);
CREATE INDEX idx_grades_student ON grades(student_id);
CREATE INDEX idx_enrollments_class ON enrollments(class_id);
CREATE INDEX idx_enrollments_student ON enrollments(student_id);
CREATE INDEX idx_assignments_class ON assignments(class_id);
CREATE INDEX idx_submissions_assignment ON submissions(assignment_id);
CREATE INDEX idx_schedules_class_day ON schedules(class_id, day_of_week);
CREATE INDEX idx_schedules_teacher ON schedules(teacher_id);
CREATE INDEX idx_notifications_user_read ON notifications(user_id, read);
CREATE INDEX idx_registration_numbers_school ON public.registration_numbers(school_id, number_type, status);
CREATE INDEX idx_registration_numbers_number ON public.registration_numbers(registration_number);
CREATE INDEX idx_audit_logs_school ON public.audit_logs(school_id, created_at DESC);
CREATE INDEX idx_parent_student_links_parent ON public.parent_student_links(parent_id);
CREATE INDEX idx_parent_student_links_student ON public.parent_student_links(student_id);

-- ==========================================
-- ENABLE REALTIME
-- ==========================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.announcements;