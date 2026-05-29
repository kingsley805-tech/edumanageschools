-- Unify teacher → admin attendance: RLS fixes, legacy sync from registers, teacher save RPC

-- One row per student per class per day on legacy attendance
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

-- Teachers with class assignments (no user_roles.teacher required)
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

-- Parents/students can read daily register attendance
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

-- Keep staff write policy separate from portal read
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

GRANT EXECUTE ON FUNCTION public.save_teacher_class_attendance(uuid, date, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.map_register_status_to_legacy(text) TO authenticated;

NOTIFY pgrst, 'reload schema';
