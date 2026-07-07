-- Fix: parent signup wrongly says a student "already has a linked parent account".
-- Cause: has_guardian was true whenever students.guardian_id was set, even if that
--        parent row no longer exists (left over from a failed/rolled-back attempt).
-- Run in Supabase SQL Editor, then it reloads the API schema automatically.

CREATE OR REPLACE FUNCTION public.resolve_student_by_admission_number(p_admission_number text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_num text := upper(trim(p_admission_number));
  v_student record;
  v_class_name text;
BEGIN
  IF v_num IS NULL OR length(v_num) < 5 THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Admission number is required.');
  END IF;

  SELECT
    s.id,
    s.school_id,
    s.user_id,
    s.guardian_id,
    coalesce(s.admission_no, s.admission_number) AS admission_number,
    coalesce(s.full_name, p.full_name) AS full_name,
    sch.school_name,
    sch.is_active AS school_active
  INTO v_student
  FROM public.students s
  LEFT JOIN public.profiles p ON p.id = s.user_id
  JOIN public.schools sch ON sch.id = s.school_id
  WHERE upper(coalesce(s.admission_no, s.admission_number)) = v_num
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'No student found with this admission number.');
  END IF;

  IF NOT v_student.school_active THEN
    RETURN jsonb_build_object('valid', false, 'error', 'This student''s school is not active.');
  END IF;

  IF v_student.user_id IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Student account is not active yet. Contact your school administrator.');
  END IF;

  SELECT c.name INTO v_class_name
  FROM public.students s
  LEFT JOIN public.classes c ON c.id = s.class_id
  WHERE s.id = v_student.id;

  RETURN jsonb_build_object(
    'valid', true,
    'student_id', v_student.id,
    'school_id', v_student.school_id,
    'student_name', v_student.full_name,
    'admission_number', v_student.admission_number,
    'class_name', coalesce(v_class_name, 'Not assigned'),
    'school_name', v_student.school_name,
    -- Only "has guardian" when a real, existing parent is linked (ignore orphaned guardian_id).
    'has_guardian',
      EXISTS (
        SELECT 1 FROM public.parents pa WHERE pa.id = v_student.guardian_id
      )
      OR EXISTS (
        SELECT 1
        FROM public.parent_student_links psl
        JOIN public.parents pa ON pa.id = psl.parent_id
        WHERE psl.student_id = v_student.id
      )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_student_by_admission_number(text) TO anon, authenticated;

-- Clear guardian_id values that point at parents which no longer exist.
UPDATE public.students s
SET guardian_id = NULL
WHERE s.guardian_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.parents pa WHERE pa.id = s.guardian_id);

-- Inspect the specific student (optional):
-- SELECT id, admission_no, guardian_id FROM public.students
-- WHERE upper(coalesce(admission_no, admission_number)) = 'MIN-STU-2026-005';

NOTIFY pgrst, 'reload schema';
