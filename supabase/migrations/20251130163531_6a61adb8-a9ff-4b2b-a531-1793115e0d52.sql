-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'teacher', 'parent', 'student');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- Create classes table
CREATE TABLE public.classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  level TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create subjects table
CREATE TABLE public.subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT
);

-- Create teachers table
CREATE TABLE public.teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) UNIQUE,
  employee_no TEXT UNIQUE,
  subject_specialty TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create parents table
CREATE TABLE public.parents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) UNIQUE,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create students table
CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) UNIQUE,
  admission_no TEXT UNIQUE,
  date_of_birth DATE,
  gender TEXT,
  class_id UUID REFERENCES classes(id),
  guardian_id UUID REFERENCES parents(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create class_subjects table
CREATE TABLE public.class_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID REFERENCES classes(id),
  subject_id UUID REFERENCES subjects(id),
  teacher_id UUID REFERENCES teachers(id)
);

-- Create enrollments table
CREATE TABLE public.enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id),
  class_id UUID REFERENCES classes(id),
  enrolled_on DATE,
  status TEXT DEFAULT 'active'
);

-- Create attendance table
CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id),
  class_id UUID REFERENCES classes(id),
  date DATE NOT NULL,
  status TEXT NOT NULL,
  recorded_by UUID REFERENCES auth.users(id),
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create assignments table
CREATE TABLE public.assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  class_id UUID REFERENCES classes(id),
  subject_id UUID REFERENCES subjects(id),
  due_date TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create submissions table
CREATE TABLE public.submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID REFERENCES assignments(id),
  student_id UUID REFERENCES students(id),
  file_url TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  grade NUMERIC(5,2)
);

-- Create grades table
CREATE TABLE public.grades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id),
  subject_id UUID REFERENCES subjects(id),
  term TEXT,
  score NUMERIC(5,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create fee_structures table
CREATE TABLE public.fee_structures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  amount NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create invoices table
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

-- Create payments table
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

-- Create messages table
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES auth.users(id),
  receiver_id UUID REFERENCES auth.users(id),
  subject TEXT,
  body TEXT,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  title TEXT,
  body TEXT,
  data JSONB,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
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

-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$;

-- Create trigger for new user
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS Policies for profiles
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- RLS Policies for user_roles
CREATE POLICY "Users can view own roles" ON user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage roles" ON user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for classes
CREATE POLICY "Everyone can view classes" ON classes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage classes" ON classes FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for subjects
CREATE POLICY "Everyone can view subjects" ON subjects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage subjects" ON subjects FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for teachers
CREATE POLICY "Everyone can view teachers" ON teachers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage teachers" ON teachers FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Teachers can update own profile" ON teachers FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for parents
CREATE POLICY "Parents can view own profile" ON parents FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all parents" ON parents FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage parents" ON parents FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for students
CREATE POLICY "Students can view own profile" ON students FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Parents can view their children" ON students FOR SELECT USING (
  EXISTS (SELECT 1 FROM parents WHERE parents.user_id = auth.uid() AND parents.id = students.guardian_id)
);
CREATE POLICY "Teachers can view students" ON students FOR SELECT USING (public.has_role(auth.uid(), 'teacher'));
CREATE POLICY "Admins can manage students" ON students FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for attendance
CREATE POLICY "Students can view own attendance" ON attendance FOR SELECT USING (
  EXISTS (SELECT 1 FROM students WHERE students.user_id = auth.uid() AND students.id = attendance.student_id)
);
CREATE POLICY "Parents can view children attendance" ON attendance FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM students s JOIN parents p ON s.guardian_id = p.id
    WHERE p.user_id = auth.uid() AND s.id = attendance.student_id
  )
);
CREATE POLICY "Teachers can manage attendance" ON attendance FOR ALL USING (public.has_role(auth.uid(), 'teacher'));
CREATE POLICY "Admins can manage attendance" ON attendance FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for assignments
CREATE POLICY "Students can view assignments" ON assignments FOR SELECT USING (public.has_role(auth.uid(), 'student'));
CREATE POLICY "Teachers can manage assignments" ON assignments FOR ALL USING (public.has_role(auth.uid(), 'teacher'));
CREATE POLICY "Admins can view assignments" ON assignments FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for submissions
CREATE POLICY "Students can manage own submissions" ON submissions FOR ALL USING (
  EXISTS (SELECT 1 FROM students WHERE students.user_id = auth.uid() AND students.id = submissions.student_id)
);
CREATE POLICY "Teachers can view submissions" ON submissions FOR SELECT USING (public.has_role(auth.uid(), 'teacher'));
CREATE POLICY "Teachers can grade submissions" ON submissions FOR UPDATE USING (public.has_role(auth.uid(), 'teacher'));

-- RLS Policies for grades
CREATE POLICY "Students can view own grades" ON grades FOR SELECT USING (
  EXISTS (SELECT 1 FROM students WHERE students.user_id = auth.uid() AND students.id = grades.student_id)
);
CREATE POLICY "Parents can view children grades" ON grades FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM students s JOIN parents p ON s.guardian_id = p.id
    WHERE p.user_id = auth.uid() AND s.id = grades.student_id
  )
);
CREATE POLICY "Teachers can manage grades" ON grades FOR ALL USING (public.has_role(auth.uid(), 'teacher'));
CREATE POLICY "Admins can view grades" ON grades FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for invoices
CREATE POLICY "Students can view own invoices" ON invoices FOR SELECT USING (
  EXISTS (SELECT 1 FROM students WHERE students.user_id = auth.uid() AND students.id = invoices.student_id)
);
CREATE POLICY "Parents can view children invoices" ON invoices FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM students s JOIN parents p ON s.guardian_id = p.id
    WHERE p.user_id = auth.uid() AND s.id = invoices.student_id
  )
);
CREATE POLICY "Admins can manage invoices" ON invoices FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for payments
CREATE POLICY "Users can view own payments" ON payments FOR SELECT USING (auth.uid() = payer_user_id);
CREATE POLICY "Parents can create payments" ON payments FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'parent'));
CREATE POLICY "Admins can manage payments" ON payments FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for messages
CREATE POLICY "Users can view own messages" ON messages FOR SELECT USING (
  auth.uid() = sender_id OR auth.uid() = receiver_id
);
CREATE POLICY "Users can send messages" ON messages FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Users can update received messages" ON messages FOR UPDATE USING (auth.uid() = receiver_id);

-- RLS Policies for notifications
CREATE POLICY "Users can view own notifications" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE USING (auth.uid() = user_id);