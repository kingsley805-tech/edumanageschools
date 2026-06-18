-- Attendance statistics: unique school-day counts, legacy merge, teacher-save recompute

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
  v_term_start date;
  v_term_end date;
BEGIN
  IF p_term_id IS NOT NULL THEN
    SELECT t.start_date, t.end_date INTO v_term_start, v_term_end
    FROM public.terms t
    WHERE t.id = p_term_id;
  END IF;

  WITH status_priority(status, priority) AS (
    VALUES
      ('present', 1),
      ('late', 2),
      ('excused', 3),
      ('absent', 4),
      ('sick', 5),
      ('suspended', 6)
  ),
  register_daily AS (
    SELECT DISTINCT ON (ar.attendance_date)
      ar.attendance_date,
      lower(ar.attendance_status) AS status
    FROM public.attendance_records ar
    WHERE ar.school_id = p_school_id
      AND ar.student_id = p_student_id
      AND (
        (p_term_id IS NULL AND ar.term_id IS NULL)
        OR ar.term_id = p_term_id
      )
    ORDER BY
      ar.attendance_date,
      COALESCE(
        (SELECT sp.priority FROM status_priority sp WHERE sp.status = lower(ar.attendance_status)),
        99
      )
  ),
  legacy_daily AS (
    SELECT DISTINCT ON (a.date)
      a.date AS attendance_date,
      lower(a.status) AS status
    FROM public.attendance a
    INNER JOIN public.students s ON s.id = a.student_id
    WHERE s.school_id = p_school_id
      AND a.student_id = p_student_id
      AND NOT EXISTS (
        SELECT 1 FROM register_daily r WHERE r.attendance_date = a.date
      )
      AND (
        p_term_id IS NULL
        OR (
          v_term_start IS NOT NULL
          AND v_term_end IS NOT NULL
          AND a.date >= v_term_start
          AND a.date <= v_term_end
        )
      )
    ORDER BY
      a.date,
      COALESCE(
        (SELECT sp.priority FROM status_priority sp WHERE sp.status = lower(a.status)),
        99
      )
  ),
  combined AS (
    SELECT attendance_date, status FROM register_daily
    UNION ALL
    SELECT attendance_date, status FROM legacy_daily
  )
  SELECT
    count(*)::int,
    count(*) FILTER (WHERE status = 'present')::int,
    count(*) FILTER (WHERE status = 'absent')::int,
    count(*) FILTER (WHERE status = 'late')::int,
    count(*) FILTER (WHERE status = 'excused')::int,
    count(*) FILTER (WHERE status = 'sick')::int
  INTO v_total, v_present, v_absent, v_late, v_excused, v_sick
  FROM combined;

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

-- Recompute summaries for all students in a class after teacher quick-attendance save
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
  v_school_id uuid;
  v_term_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT school_id INTO v_school_id FROM public.classes WHERE id = p_class_id;

  IF NOT (
    public.teacher_can_view_student(v_uid, p_class_id)
    OR (
      public.has_role(v_uid, 'admin'::app_role)
      AND v_school_id = public.get_user_school_id(v_uid)
    )
  ) THEN
    RAISE EXCEPTION 'Not authorized to mark attendance for this class';
  END IF;

  SELECT t.id INTO v_term_id
  FROM public.terms t
  WHERE t.school_id = v_school_id
    AND p_date >= t.start_date
    AND p_date <= t.end_date
  ORDER BY t.is_current DESC NULLS LAST
  LIMIT 1;

  IF v_term_id IS NULL THEN
    SELECT t.id INTO v_term_id
    FROM public.terms t
    WHERE t.school_id = v_school_id AND t.is_current = true
    LIMIT 1;
  END IF;

  DELETE FROM public.attendance
  WHERE class_id = p_class_id AND date = p_date;

  FOR v_rec IN
    SELECT student_id, status
    FROM jsonb_to_recordset(coalesce(p_records, '[]'::jsonb)) AS x(student_id uuid, status text)
  LOOP
    INSERT INTO public.attendance (student_id, class_id, date, status, recorded_by, recorded_at)
    VALUES (v_rec.student_id, p_class_id, p_date, v_rec.status, v_uid, now());

    IF v_school_id IS NOT NULL THEN
      PERFORM public.recompute_attendance_summary(v_school_id, v_rec.student_id, v_term_id);
    END IF;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.recompute_attendance_summary(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_teacher_class_attendance(uuid, date, jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';
