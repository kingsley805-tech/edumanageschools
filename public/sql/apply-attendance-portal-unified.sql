-- Attendance portal unification (run in Supabase SQL editor)
-- Prerequisite: public/sql/apply-class-register.sql (needs class_registers table)
-- Optional: public/sql/apply-fix-teacher-students-rls.sql

-- =============================================================================
-- Step 1: Create attendance analytics tables if missing (from SMS/register system)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  register_id uuid REFERENCES public.class_registers(id) ON DELETE CASCADE,
  term_id uuid REFERENCES public.terms(id) ON DELETE SET NULL,
  attendance_date date NOT NULL,
  attendance_status text NOT NULL,
  time_in time,
  remark text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (register_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_attendance_records_school_date ON public.attendance_records(school_id, attendance_date DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_records_student_term ON public.attendance_records(student_id, term_id);

CREATE TABLE IF NOT EXISTS public.attendance_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  term_id uuid REFERENCES public.terms(id) ON DELETE SET NULL,
  total_days integer NOT NULL DEFAULT 0,
  present_count integer NOT NULL DEFAULT 0,
  absent_count integer NOT NULL DEFAULT 0,
  late_count integer NOT NULL DEFAULT 0,
  excused_count integer NOT NULL DEFAULT 0,
  sick_count integer NOT NULL DEFAULT 0,
  attendance_percentage numeric(5,2) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_summaries_school_student_term
  ON public.attendance_summaries (
    school_id,
    student_id,
    COALESCE(term_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

CREATE INDEX IF NOT EXISTS idx_attendance_summaries_student ON public.attendance_summaries(student_id, term_id);

CREATE TABLE IF NOT EXISTS public.sms_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id uuid REFERENCES public.students(id) ON DELETE SET NULL,
  parent_id uuid REFERENCES public.parents(id) ON DELETE SET NULL,
  register_id uuid REFERENCES public.class_registers(id) ON DELETE SET NULL,
  phone_number text NOT NULL,
  message text NOT NULL,
  sms_status text NOT NULL DEFAULT 'queued',
  provider_response jsonb,
  sent_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sms_logs_school_sent ON public.sms_logs(school_id, sent_at DESC);

ALTER TABLE public.school_settings
  ADD COLUMN IF NOT EXISTS sms_sender_id text,
  ADD COLUMN IF NOT EXISTS sms_notify_absent boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sms_notify_late boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sms_notify_present boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.recompute_attendance_summary(
  p_school_id uuid,
  p_student_id uuid,
  p_term_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total int;
  v_present int;
  v_absent int;
  v_late int;
  v_excused int;
  v_sick int;
  v_pct numeric;
BEGIN
  SELECT
    count(*)::int,
    count(*) FILTER (WHERE lower(attendance_status) = 'present')::int,
    count(*) FILTER (WHERE lower(attendance_status) = 'absent')::int,
    count(*) FILTER (WHERE lower(attendance_status) = 'late')::int,
    count(*) FILTER (WHERE lower(attendance_status) = 'excused')::int,
    count(*) FILTER (WHERE lower(attendance_status) = 'sick')::int
  INTO v_total, v_present, v_absent, v_late, v_excused, v_sick
  FROM public.attendance_records ar
  WHERE ar.school_id = p_school_id
    AND ar.student_id = p_student_id
    AND (
      (p_term_id IS NULL AND ar.term_id IS NULL)
      OR ar.term_id = p_term_id
    );

  v_pct := CASE WHEN v_total > 0 THEN round((v_present::numeric / v_total::numeric) * 100, 2) ELSE 0 END;

  INSERT INTO public.attendance_summaries (
    school_id, student_id, term_id, total_days, present_count, absent_count, late_count,
    excused_count, sick_count, attendance_percentage, updated_at
  )
  VALUES (
    p_school_id, p_student_id, p_term_id, v_total, v_present, v_absent, v_late,
    v_excused, v_sick, v_pct, now()
  )
  ON CONFLICT (school_id, student_id, COALESCE(term_id, '00000000-0000-0000-0000-000000000000'::uuid))
  DO UPDATE SET
    total_days = EXCLUDED.total_days,
    present_count = EXCLUDED.present_count,
    absent_count = EXCLUDED.absent_count,
    late_count = EXCLUDED.late_count,
    excused_count = EXCLUDED.excused_count,
    sick_count = EXCLUDED.sick_count,
    attendance_percentage = EXCLUDED.attendance_percentage,
    updated_at = now();
END;
$$;

-- =============================================================================
-- Step 2: Legacy attendance + portal policies + sync
-- =============================================================================

DELETE FROM public.attendance a
USING public.attendance b
WHERE a.id > b.id
  AND a.student_id = b.student_id
  AND a.class_id = b.class_id
  AND a.date = b.date;

ALTER TABLE public.attendance
  DROP CONSTRAINT IF EXISTS attendance_student_class_date_unique;

ALTER TABLE public.attendance
  ADD CONSTRAINT attendance_student_class_date_unique UNIQUE (student_id, class_id, date);

CREATE OR REPLACE FUNCTION public.map_register_status_to_legacy(p_status text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN lower(coalesce(p_status, '')) = 'present' THEN 'present'
    WHEN lower(coalesce(p_status, '')) = 'late' THEN 'late'
    ELSE 'absent'
  END;
$$;

DROP POLICY IF EXISTS "Teachers can manage attendance" ON public.attendance;
CREATE POLICY "Teachers can manage attendance"
ON public.attendance
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.id = attendance.student_id
      AND public.teacher_can_view_student(auth.uid(), coalesce(attendance.class_id, s.class_id))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.id = attendance.student_id
      AND public.teacher_can_view_student(auth.uid(), coalesce(attendance.class_id, s.class_id))
  )
);

DROP POLICY IF EXISTS "Admins can manage attendance" ON public.attendance;
CREATE POLICY "Admins can manage attendance"
ON public.attendance
FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.id = attendance.student_id
      AND s.school_id = public.get_user_school_id(auth.uid())
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.id = attendance.student_id
      AND s.school_id = public.get_user_school_id(auth.uid())
  )
);

ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "attendance records portal read" ON public.attendance_records;
CREATE POLICY "attendance records portal read"
ON public.attendance_records
FOR SELECT TO authenticated
USING (
  school_id = public.get_user_school_id(auth.uid())
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
  OR EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.user_id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.students s
    JOIN public.parents p ON s.guardian_id = p.id
    WHERE s.id = student_id AND p.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "attendance records school" ON public.attendance_records;
CREATE POLICY "attendance records school"
ON public.attendance_records
FOR ALL TO authenticated
USING (
  school_id = public.get_user_school_id(auth.uid())
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
)
WITH CHECK (
  school_id = public.get_user_school_id(auth.uid())
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
);

DROP POLICY IF EXISTS "attendance summaries school" ON public.attendance_summaries;
CREATE POLICY "attendance summaries school"
ON public.attendance_summaries
FOR SELECT TO authenticated
USING (
  school_id = public.get_user_school_id(auth.uid())
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
  OR EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.user_id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.students s
    JOIN public.parents p ON s.guardian_id = p.id
    WHERE s.id = student_id AND p.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "sms logs school read" ON public.sms_logs;
CREATE POLICY "sms logs school read" ON public.sms_logs
FOR SELECT TO authenticated
USING (
  school_id = public.get_user_school_id(auth.uid())
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
);

DROP POLICY IF EXISTS "sms logs service insert" ON public.sms_logs;
CREATE POLICY "sms logs service insert" ON public.sms_logs
FOR INSERT TO authenticated
WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.sync_register_to_attendance(p_register_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reg public.class_registers%ROWTYPE;
  v_entry record;
  v_teacher_user_id uuid;
BEGIN
  SELECT * INTO v_reg FROM public.class_registers WHERE id = p_register_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Register not found';
  END IF;

  SELECT user_id INTO v_teacher_user_id FROM public.teachers WHERE id = v_reg.teacher_id;

  FOR v_entry IN
    SELECT * FROM public.register_student_entries WHERE register_id = p_register_id
  LOOP
    INSERT INTO public.attendance_records (
      school_id, student_id, class_id, subject_id, teacher_id, register_id, term_id,
      attendance_date, attendance_status, time_in, remark, updated_at
    )
    VALUES (
      v_reg.school_id,
      v_entry.student_id,
      v_reg.class_id,
      v_reg.subject_id,
      v_reg.teacher_id,
      p_register_id,
      v_reg.term_id,
      v_reg.register_date,
      v_entry.attendance_status,
      v_entry.time_in,
      coalesce(v_entry.remarks, v_entry.behavior_remark),
      now()
    )
    ON CONFLICT (register_id, student_id) DO UPDATE SET
      attendance_status = EXCLUDED.attendance_status,
      time_in = EXCLUDED.time_in,
      remark = EXCLUDED.remark,
      term_id = EXCLUDED.term_id,
      updated_at = now();

    PERFORM public.recompute_attendance_summary(v_reg.school_id, v_entry.student_id, v_reg.term_id);

    INSERT INTO public.attendance (student_id, class_id, date, status, recorded_by, recorded_at)
    VALUES (
      v_entry.student_id,
      v_reg.class_id,
      v_reg.register_date,
      public.map_register_status_to_legacy(v_entry.attendance_status),
      v_teacher_user_id,
      now()
    )
    ON CONFLICT (student_id, class_id, date) DO UPDATE SET
      status = EXCLUDED.status,
      recorded_by = EXCLUDED.recorded_by,
      recorded_at = now();
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.on_class_register_submitted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'submitted' AND (OLD.status IS DISTINCT FROM 'submitted') THEN
    PERFORM public.sync_register_to_attendance(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_class_register_submitted_attendance ON public.class_registers;
CREATE TRIGGER trg_class_register_submitted_attendance
  AFTER UPDATE OF status ON public.class_registers
  FOR EACH ROW
  EXECUTE FUNCTION public.on_class_register_submitted();

CREATE OR REPLACE FUNCTION public.save_teacher_class_attendance(
  p_class_id uuid,
  p_date date,
  p_records jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_rec record;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT (
    public.teacher_can_view_student(v_uid, p_class_id)
    OR (
      public.has_role(v_uid, 'admin'::app_role)
      AND EXISTS (
        SELECT 1 FROM public.classes c
        WHERE c.id = p_class_id
          AND c.school_id = public.get_user_school_id(v_uid)
      )
    )
  ) THEN
    RAISE EXCEPTION 'Not authorized to mark attendance for this class';
  END IF;

  DELETE FROM public.attendance
  WHERE class_id = p_class_id AND date = p_date;

  FOR v_rec IN
    SELECT student_id, status
    FROM jsonb_to_recordset(coalesce(p_records, '[]'::jsonb)) AS x(student_id uuid, status text)
  LOOP
    INSERT INTO public.attendance (student_id, class_id, date, status, recorded_by, recorded_at)
    VALUES (v_rec.student_id, p_class_id, p_date, v_rec.status, v_uid, now());
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_register_to_attendance(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recompute_attendance_summary(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_teacher_class_attendance(uuid, date, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.map_register_status_to_legacy(text) TO authenticated;

NOTIFY pgrst, 'reload schema';
