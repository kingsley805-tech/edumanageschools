-- Fix infinite recursion in profiles and students RLS policies
-- Step 1: Drop the problematic policies

DROP POLICY IF EXISTS "Admins can view school profiles" ON public.profiles;
DROP POLICY IF EXISTS "Teachers can view relevant profiles" ON public.profiles;
DROP POLICY IF EXISTS "Parents can view relevant profiles" ON public.profiles;
DROP POLICY IF EXISTS "Students can view relevant profiles" ON public.profiles;

-- Step 2: Create security definer functions to avoid recursion

-- Function to get user's school_id without triggering profiles RLS
CREATE OR REPLACE FUNCTION public.get_user_school_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT school_id FROM public.profiles WHERE id = _user_id
$$;

-- Function to check if user is admin of a school
CREATE OR REPLACE FUNCTION public.is_school_admin(_user_id uuid, _school_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.user_id = _user_id 
    AND ur.role = 'admin'
    AND p.school_id = _school_id
  )
$$;

-- Function to get student user_ids in teacher's classes
CREATE OR REPLACE FUNCTION public.get_teacher_student_user_ids(_teacher_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
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

-- Function to get parent user_ids of students in teacher's classes
CREATE OR REPLACE FUNCTION public.get_teacher_parent_user_ids(_teacher_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
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

-- Function to get teacher user_ids in same school for teachers
CREATE OR REPLACE FUNCTION public.get_school_teacher_user_ids(_teacher_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t2.user_id
  FROM teachers t1
  JOIN teachers t2 ON t1.school_id = t2.school_id
  WHERE t1.user_id = _teacher_user_id
$$;

-- Function to get children's user_ids for a parent
CREATE OR REPLACE FUNCTION public.get_parent_children_user_ids(_parent_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.user_id
  FROM parents p
  JOIN students s ON s.guardian_id = p.id
  WHERE p.user_id = _parent_user_id
$$;

-- Function to get teacher user_ids for parent's children
CREATE OR REPLACE FUNCTION public.get_parent_teacher_user_ids(_parent_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
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

-- Function to get teacher user_ids for student's classes
CREATE OR REPLACE FUNCTION public.get_student_teacher_user_ids(_student_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
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

-- Function to get classmate user_ids for a student
CREATE OR REPLACE FUNCTION public.get_student_classmate_user_ids(_student_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s2.user_id
  FROM students s1
  JOIN students s2 ON s1.class_id = s2.class_id
  WHERE s1.user_id = _student_user_id
$$;

-- Step 3: Create new non-recursive policies for profiles

-- Admins can view profiles in their school
CREATE POLICY "Admins can view school profiles"
ON public.profiles
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND school_id = get_user_school_id(auth.uid())
);

-- Teachers can view relevant profiles (students in their classes, their parents, other teachers in school)
CREATE POLICY "Teachers can view relevant profiles"
ON public.profiles
FOR SELECT
USING (
  has_role(auth.uid(), 'teacher'::app_role) 
  AND (
    id IN (SELECT get_teacher_student_user_ids(auth.uid()))
    OR id IN (SELECT get_teacher_parent_user_ids(auth.uid()))
    OR id IN (SELECT get_school_teacher_user_ids(auth.uid()))
  )
);

-- Parents can view relevant profiles (their children, children's teachers)
CREATE POLICY "Parents can view relevant profiles"
ON public.profiles
FOR SELECT
USING (
  has_role(auth.uid(), 'parent'::app_role)
  AND (
    id IN (SELECT get_parent_children_user_ids(auth.uid()))
    OR id IN (SELECT get_parent_teacher_user_ids(auth.uid()))
  )
);

-- Students can view relevant profiles (their teachers, classmates)
CREATE POLICY "Students can view relevant profiles"
ON public.profiles
FOR SELECT
USING (
  has_role(auth.uid(), 'student'::app_role)
  AND (
    id IN (SELECT get_student_teacher_user_ids(auth.uid()))
    OR id IN (SELECT get_student_classmate_user_ids(auth.uid()))
  )
);