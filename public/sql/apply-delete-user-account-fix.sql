-- Fix admin "Database error deleting user" caused by foreign keys on auth.users.
-- Also allows logging failed login attempts without an authenticated session.
-- Run in Supabase SQL Editor, then: NOTIFY pgrst, 'reload schema';

-- 1) Repair every FK that points at auth.users but blocks deletion.
--    Nullable columns become ON DELETE SET NULL; NOT NULL columns become ON DELETE CASCADE.
DO $repair$
DECLARE
  r RECORD;
  v_col text;
  v_notnull boolean;
  v_action text;
BEGIN
  FOR r IN
    SELECT c.conname,
           c.conrelid::regclass AS tbl,
           c.conrelid,
           c.conkey
    FROM pg_constraint c
    WHERE c.contype = 'f'
      AND c.confrelid = 'auth.users'::regclass
      AND c.confdeltype IN ('a', 'r')          -- NO ACTION / RESTRICT
      AND array_length(c.conkey, 1) = 1
  LOOP
    SELECT a.attname, a.attnotnull
      INTO v_col, v_notnull
    FROM pg_attribute a
    WHERE a.attrelid = r.conrelid
      AND a.attnum = r.conkey[1];

    v_action := CASE WHEN v_notnull THEN 'CASCADE' ELSE 'SET NULL' END;

    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.tbl, r.conname);
    EXECUTE format(
      'ALTER TABLE %s ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES auth.users(id) ON DELETE %s',
      r.tbl, r.conname, v_col, v_action
    );

    RAISE NOTICE 'Repaired % on % (%.%) -> ON DELETE %', r.conname, r.tbl, r.tbl, v_col, v_action;
  END LOOP;
END;
$repair$;

-- 2) Same repair for FKs that point at public.profiles (delete cascades auth.users -> profiles).
DO $repair_profiles$
DECLARE
  r RECORD;
  v_col text;
  v_notnull boolean;
  v_action text;
BEGIN
  FOR r IN
    SELECT c.conname,
           c.conrelid::regclass AS tbl,
           c.conrelid,
           c.conkey
    FROM pg_constraint c
    WHERE c.contype = 'f'
      AND c.confrelid = 'public.profiles'::regclass
      AND c.confdeltype IN ('a', 'r')
      AND array_length(c.conkey, 1) = 1
  LOOP
    SELECT a.attname, a.attnotnull
      INTO v_col, v_notnull
    FROM pg_attribute a
    WHERE a.attrelid = r.conrelid
      AND a.attnum = r.conkey[1];

    v_action := CASE WHEN v_notnull THEN 'CASCADE' ELSE 'SET NULL' END;

    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.tbl, r.conname);
    EXECUTE format(
      'ALTER TABLE %s ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.profiles(id) ON DELETE %s',
      r.tbl, r.conname, v_col, v_action
    );

    RAISE NOTICE 'Repaired % on % (%.%) -> ON DELETE %', r.conname, r.tbl, r.tbl, v_col, v_action;
  END LOOP;
END;
$repair_profiles$;

CREATE OR REPLACE FUNCTION public._safe_exec(p_sql text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  EXECUTE p_sql;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
END;
$$;

-- Log login success/failure (callable by anon for failed attempts).
CREATE OR REPLACE FUNCTION public.log_login_activity_event(
  p_email text,
  p_success boolean,
  p_failure_reason text DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_school_id uuid;
BEGIN
  IF v_user_id IS NOT NULL THEN
    SELECT school_id INTO v_school_id FROM public.profiles WHERE id = v_user_id;
  END IF;

  INSERT INTO public.login_activity (user_id, school_id, email, success, failure_reason, user_agent)
  VALUES (v_user_id, v_school_id, NULLIF(trim(p_email), ''), p_success, p_failure_reason, p_user_agent);
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_login_activity_event(text, boolean, text, text) TO anon, authenticated;

-- Remove dependent rows that block profile/student cascade delete.
CREATE OR REPLACE FUNCTION public.cleanup_student_before_delete(p_student_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_student_id IS NULL THEN
    RETURN;
  END IF;

  PERFORM public._safe_exec(format(
    'DELETE FROM public.online_exam_answers WHERE attempt_id IN (SELECT id FROM public.online_exam_attempts WHERE student_id = %L)',
    p_student_id
  ));
  PERFORM public._safe_exec(format(
    'DELETE FROM public.exam_time_extensions WHERE attempt_id IN (SELECT id FROM public.online_exam_attempts WHERE student_id = %L)',
    p_student_id
  ));
  PERFORM public._safe_exec(format('DELETE FROM public.exam_proctoring_logs WHERE student_id = %L', p_student_id));
  PERFORM public._safe_exec(format('DELETE FROM public.online_exam_attempts WHERE student_id = %L', p_student_id));
  PERFORM public._safe_exec(format('DELETE FROM public.exam_results WHERE student_id = %L', p_student_id));
  PERFORM public._safe_exec(format('DELETE FROM public.exam_attendance WHERE student_id = %L', p_student_id));
  PERFORM public._safe_exec(format('DELETE FROM public.submissions WHERE student_id = %L', p_student_id));
  PERFORM public._safe_exec(format('DELETE FROM public.enrollments WHERE student_id = %L', p_student_id));
  PERFORM public._safe_exec(format('DELETE FROM public.attendance WHERE student_id = %L', p_student_id));
  PERFORM public._safe_exec(format('DELETE FROM public.grades WHERE student_id = %L', p_student_id));
  PERFORM public._safe_exec(format(
    'DELETE FROM public.payments WHERE invoice_id IN (SELECT id FROM public.invoices WHERE student_id = %L)',
    p_student_id
  ));
  PERFORM public._safe_exec(format('DELETE FROM public.invoices WHERE student_id = %L', p_student_id));
  PERFORM public._safe_exec(format(
    'DELETE FROM public.billing_payment_allocations WHERE invoice_id IN (SELECT id FROM public.billing_invoices WHERE student_id = %L)',
    p_student_id
  ));
  PERFORM public._safe_exec(format(
    'DELETE FROM public.billing_invoice_lines WHERE invoice_id IN (SELECT id FROM public.billing_invoices WHERE student_id = %L)',
    p_student_id
  ));
  PERFORM public._safe_exec(format('DELETE FROM public.billing_invoices WHERE student_id = %L', p_student_id));
  PERFORM public._safe_exec(format('DELETE FROM public.student_password_reset_requests WHERE student_id = %L', p_student_id));
  PERFORM public._safe_exec(format('DELETE FROM public.class_register_entries WHERE student_id = %L', p_student_id));
  PERFORM public._safe_exec(format('DELETE FROM public.attendance_sms_logs WHERE student_id = %L', p_student_id));
  PERFORM public._safe_exec(format('DELETE FROM public.attendance_daily_records WHERE student_id = %L', p_student_id));
  PERFORM public._safe_exec(format('DELETE FROM public.live_class_attendance WHERE student_id = %L', p_student_id));
  PERFORM public._safe_exec(format('DELETE FROM public.transport_student_assignments WHERE student_id = %L', p_student_id));
  PERFORM public._safe_exec(format('DELETE FROM public.hostel_allocations WHERE student_id = %L', p_student_id));
  PERFORM public._safe_exec(format('DELETE FROM public.hostel_incidents WHERE student_id = %L', p_student_id));
  PERFORM public._safe_exec(format('DELETE FROM public.report_card_entries WHERE student_id = %L', p_student_id));
  PERFORM public._safe_exec(format('DELETE FROM public.report_cards WHERE student_id = %L', p_student_id));
  PERFORM public._safe_exec(format('DELETE FROM public.academic_recommendations WHERE student_id = %L', p_student_id));
  PERFORM public._safe_exec(format('DELETE FROM public.fee_assignments WHERE student_id = %L', p_student_id));
  PERFORM public._safe_exec(format('DELETE FROM public.billing_account_students WHERE student_id = %L', p_student_id));
  PERFORM public._safe_exec(format(
    'DELETE FROM public.waec_session_answers WHERE session_id IN (SELECT id FROM public.waec_practice_sessions WHERE student_id = %L)',
    p_student_id
  ));
  PERFORM public._safe_exec(format('DELETE FROM public.waec_practice_sessions WHERE student_id = %L', p_student_id));
  PERFORM public._safe_exec(format('DELETE FROM public.students WHERE id = %L', p_student_id));
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_teacher_before_delete(p_teacher_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_teacher_id IS NULL THEN
    RETURN;
  END IF;

  PERFORM public._safe_exec(format('UPDATE public.schedules SET teacher_id = NULL WHERE teacher_id = %L', p_teacher_id));
  PERFORM public._safe_exec(format('UPDATE public.classes SET class_teacher_id = NULL WHERE class_teacher_id = %L', p_teacher_id));
  PERFORM public._safe_exec(format('DELETE FROM public.class_subjects WHERE teacher_id = %L', p_teacher_id));
  PERFORM public._safe_exec(format('DELETE FROM public.class_teacher_assignments WHERE teacher_id = %L', p_teacher_id));
  PERFORM public._safe_exec(format('DELETE FROM public.lesson_notes WHERE teacher_id = %L', p_teacher_id));
  PERFORM public._safe_exec(format('DELETE FROM public.payroll_runs WHERE teacher_id = %L', p_teacher_id));
  PERFORM public._safe_exec(format('DELETE FROM public.teachers WHERE id = %L', p_teacher_id));
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_student_before_delete(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_teacher_before_delete(uuid) TO service_role;

NOTIFY pgrst, 'reload schema';
