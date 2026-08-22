-- Program student enrollments + class/teacher assignments

CREATE TABLE IF NOT EXISTS public.academic_program_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  program_id uuid NOT NULL REFERENCES public.academic_programs(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  enrolled_on date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'completed', 'withdrawn')),
  notes text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (program_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_program_enrollments_school
  ON public.academic_program_enrollments(school_id);
CREATE INDEX IF NOT EXISTS idx_program_enrollments_program
  ON public.academic_program_enrollments(program_id);
CREATE INDEX IF NOT EXISTS idx_program_enrollments_student
  ON public.academic_program_enrollments(student_id);

CREATE TABLE IF NOT EXISTS public.academic_program_class_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  program_id uuid NOT NULL REFERENCES public.academic_programs(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  teacher_id uuid REFERENCES public.teachers(id) ON DELETE SET NULL,
  assigned_on date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive')),
  notes text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (program_id, class_id)
);

CREATE INDEX IF NOT EXISTS idx_program_class_assign_school
  ON public.academic_program_class_assignments(school_id);
CREATE INDEX IF NOT EXISTS idx_program_class_assign_program
  ON public.academic_program_class_assignments(program_id);
CREATE INDEX IF NOT EXISTS idx_program_class_assign_class
  ON public.academic_program_class_assignments(class_id);

ALTER TABLE public.academic_program_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_program_class_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS academic_program_enrollments_school_rw ON public.academic_program_enrollments;
CREATE POLICY academic_program_enrollments_school_rw ON public.academic_program_enrollments
  FOR ALL TO authenticated
  USING (
    school_id = public.get_user_school_id(auth.uid())
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  )
  WITH CHECK (
    school_id = public.get_user_school_id(auth.uid())
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

DROP POLICY IF EXISTS academic_program_class_assignments_school_rw ON public.academic_program_class_assignments;
CREATE POLICY academic_program_class_assignments_school_rw ON public.academic_program_class_assignments
  FOR ALL TO authenticated
  USING (
    school_id = public.get_user_school_id(auth.uid())
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  )
  WITH CHECK (
    school_id = public.get_user_school_id(auth.uid())
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

NOTIFY pgrst, 'reload schema';
