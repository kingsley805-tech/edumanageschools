-- Class Register Management System (multi-tenant)
-- Run in Supabase SQL Editor.

DO $$ BEGIN
  CREATE TYPE public.class_register_status AS ENUM ('draft', 'submitted', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Customizable attendance statuses per school
CREATE TABLE IF NOT EXISTS public.attendance_status_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  code text NOT NULL,
  label text NOT NULL,
  color text NOT NULL DEFAULT '#22c55e',
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, code)
);

-- Class register header (one per class/subject/date/period)
CREATE TABLE IF NOT EXISTS public.class_registers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  term_id uuid REFERENCES public.terms(id) ON DELETE SET NULL,
  academic_year_id uuid REFERENCES public.academic_years(id) ON DELETE SET NULL,
  session_label text,
  register_date date NOT NULL,
  period_label text NOT NULL DEFAULT 'Period 1',
  day_of_week smallint CHECK (day_of_week IS NULL OR (day_of_week >= 0 AND day_of_week <= 6)),
  lesson_summary text,
  lesson_objectives text,
  teaching_methods text,
  homework text,
  participation_summary text,
  teacher_signature text,
  status public.class_register_status NOT NULL DEFAULT 'draft',
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewer_name text,
  admin_feedback text,
  locked boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_class_registers_unique_slot
  ON public.class_registers (school_id, class_id, subject_id, register_date, period_label, COALESCE(term_id, '00000000-0000-0000-0000-000000000000'::uuid));

CREATE INDEX IF NOT EXISTS idx_class_registers_school_date ON public.class_registers(school_id, register_date DESC);
CREATE INDEX IF NOT EXISTS idx_class_registers_status ON public.class_registers(school_id, status);
CREATE INDEX IF NOT EXISTS idx_class_registers_teacher ON public.class_registers(teacher_id, register_date DESC);

-- Per-student register lines
CREATE TABLE IF NOT EXISTS public.register_student_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  register_id uuid NOT NULL REFERENCES public.class_registers(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  attendance_status text NOT NULL DEFAULT 'present',
  time_in time,
  participation text,
  remarks text,
  behavior_remark text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (register_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_register_student_entries_register ON public.register_student_entries(register_id);

-- Workflow audit
CREATE TABLE IF NOT EXISTS public.register_status_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  register_id uuid NOT NULL REFERENCES public.class_registers(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  from_status public.class_register_status,
  to_status public.class_register_status NOT NULL,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_name text,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_register_status_logs_register ON public.register_status_logs(register_id, created_at DESC);

-- General audit trail
CREATE TABLE IF NOT EXISTS public.register_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  register_id uuid REFERENCES public.class_registers(id) ON DELETE SET NULL,
  action text NOT NULL,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_name text,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_register_audit_logs_school ON public.register_audit_logs(school_id, created_at DESC);

-- RLS
ALTER TABLE public.attendance_status_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_registers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.register_student_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.register_status_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.register_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "attendance status types school" ON public.attendance_status_types;
CREATE POLICY "attendance status types school" ON public.attendance_status_types
  FOR ALL TO authenticated
  USING (school_id = public.get_user_school_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (school_id = public.get_user_school_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "class registers school read" ON public.class_registers;
CREATE POLICY "class registers school read" ON public.class_registers
  FOR SELECT TO authenticated
  USING (
    school_id = public.get_user_school_id(auth.uid())
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.teachers t
      WHERE t.user_id = auth.uid() AND t.id = class_registers.teacher_id
    )
    OR (
      status = 'approved'::public.class_register_status
      AND EXISTS (
        SELECT 1 FROM public.students s
        WHERE s.class_id = class_registers.class_id AND s.user_id = auth.uid()
      )
    )
    OR (
      status = 'approved'::public.class_register_status
      AND EXISTS (
        SELECT 1 FROM public.students s
        JOIN public.parents p ON s.guardian_id = p.id
        WHERE s.class_id = class_registers.class_id AND p.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "class registers teacher write" ON public.class_registers;
CREATE POLICY "class registers teacher write" ON public.class_registers
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.teachers t
      WHERE t.user_id = auth.uid() AND t.id = teacher_id AND t.school_id = school_id
    )
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

DROP POLICY IF EXISTS "class registers teacher update" ON public.class_registers;
CREATE POLICY "class registers teacher update" ON public.class_registers
  FOR UPDATE TO authenticated
  USING (
    (locked = false AND status IN ('draft', 'rejected') AND EXISTS (
      SELECT 1 FROM public.teachers t WHERE t.user_id = auth.uid() AND t.id = teacher_id
    ))
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

DROP POLICY IF EXISTS "class registers admin delete" ON public.class_registers;
CREATE POLICY "class registers admin delete" ON public.class_registers
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

DROP POLICY IF EXISTS "register entries via register" ON public.register_student_entries;
CREATE POLICY "register entries via register" ON public.register_student_entries
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.class_registers r WHERE r.id = register_id)
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.class_registers r
      WHERE r.id = register_id
        AND (
          (r.locked = false AND r.status IN ('draft', 'rejected') AND EXISTS (
            SELECT 1 FROM public.teachers t WHERE t.user_id = auth.uid() AND t.id = r.teacher_id
          ))
          OR public.has_role(auth.uid(), 'admin'::app_role)
          OR public.has_role(auth.uid(), 'super_admin'::app_role)
        )
    )
  );

DROP POLICY IF EXISTS "register status logs school" ON public.register_status_logs;
CREATE POLICY "register status logs school" ON public.register_status_logs
  FOR SELECT TO authenticated
  USING (school_id = public.get_user_school_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "register status logs insert" ON public.register_status_logs;
CREATE POLICY "register status logs insert" ON public.register_status_logs
  FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "register audit logs school" ON public.register_audit_logs;
CREATE POLICY "register audit logs school" ON public.register_audit_logs
  FOR SELECT TO authenticated
  USING (
    school_id = public.get_user_school_id(auth.uid())
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

DROP POLICY IF EXISTS "register audit logs insert" ON public.register_audit_logs;
CREATE POLICY "register audit logs insert" ON public.register_audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Approve / reject RPC
CREATE OR REPLACE FUNCTION public.review_class_register(
  p_register_id uuid,
  p_action text,
  p_comment text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_name text;
  v_reg public.class_registers%ROWTYPE;
  v_new_status public.class_register_status;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_action NOT IN ('approve', 'reject') THEN RAISE EXCEPTION 'Invalid action'; END IF;

  SELECT * INTO v_reg FROM public.class_registers WHERE id = p_register_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Register not found'; END IF;

  IF NOT (
    public.has_role(v_uid, 'admin'::app_role)
    OR public.has_role(v_uid, 'super_admin'::app_role)
  ) THEN
    RAISE EXCEPTION 'Only admins can review registers';
  END IF;

  v_new_status := CASE WHEN p_action = 'approve' THEN 'approved'::public.class_register_status ELSE 'rejected'::public.class_register_status END;

  SELECT coalesce(full_name, 'Admin') INTO v_name FROM public.profiles WHERE id = v_uid;

  UPDATE public.class_registers
  SET status = v_new_status,
      reviewed_at = now(),
      reviewed_by = v_uid,
      reviewer_name = v_name,
      admin_feedback = p_comment,
      locked = (v_new_status = 'approved'),
      updated_at = now()
  WHERE id = p_register_id;

  INSERT INTO public.register_status_logs (register_id, school_id, from_status, to_status, actor_user_id, actor_name, comment)
  VALUES (p_register_id, v_reg.school_id, v_reg.status, v_new_status, v_uid, v_name, p_comment);
END;
$$;

GRANT EXECUTE ON FUNCTION public.review_class_register(uuid, text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
