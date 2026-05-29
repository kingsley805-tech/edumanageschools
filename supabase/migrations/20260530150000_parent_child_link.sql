-- Parent child linking RPC + RLS (see public/sql/apply-parent-child-link.sql)

ALTER TABLE public.parents
  ADD COLUMN IF NOT EXISTS signup_child_admission_numbers text[] DEFAULT '{}';

CREATE OR REPLACE FUNCTION public.link_parent_children_by_admission(
  p_admission_numbers text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_parent record;
  v_raw text;
  v_num text;
  v_preview jsonb;
  v_student_id uuid;
  v_school_id uuid;
  v_linked int := 0;
  v_stored text[] := ARRAY[]::text[];
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;

  SELECT id, school_id, signup_child_admission_numbers
  INTO v_parent
  FROM public.parents
  WHERE user_id = v_uid;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Parent profile not found.');
  END IF;

  IF p_admission_numbers IS NULL OR array_length(p_admission_numbers, 1) IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No admission numbers provided.');
  END IF;

  FOREACH v_raw IN ARRAY p_admission_numbers
  LOOP
    v_num := upper(trim(v_raw));
    IF v_num IS NULL OR length(v_num) < 3 THEN
      CONTINUE;
    END IF;

    v_preview := public.resolve_student_by_admission_number(v_num);
    IF coalesce((v_preview->>'valid')::boolean, false) IS NOT TRUE THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', coalesce(v_preview->>'error', 'Invalid admission number'),
        'linked', v_linked
      );
    END IF;

    v_student_id := (v_preview->>'student_id')::uuid;
    v_school_id := (v_preview->>'school_id')::uuid;

    IF v_school_id IS DISTINCT FROM v_parent.school_id THEN
      RETURN jsonb_build_object('ok', false, 'error', 'All children must belong to your school.', 'linked', v_linked);
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = v_student_id
        AND s.guardian_id IS NOT NULL
        AND s.guardian_id <> v_parent.id
    ) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Student already linked to another parent.', 'linked', v_linked);
    END IF;

    INSERT INTO public.parent_student_links (parent_id, student_id, relationship)
    VALUES (v_parent.id, v_student_id, 'parent')
    ON CONFLICT (parent_id, student_id) DO NOTHING;

    UPDATE public.students SET guardian_id = v_parent.id WHERE id = v_student_id;

    v_linked := v_linked + 1;
    v_stored := array_append(v_stored, coalesce(v_preview->>'admission_number', v_num));
  END LOOP;

  IF v_linked = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No students were linked.', 'linked', 0);
  END IF;

  UPDATE public.parents
  SET signup_child_admission_numbers = (
    SELECT coalesce(array_agg(DISTINCT upper(trim(x))), '{}')
    FROM unnest(coalesce(v_parent.signup_child_admission_numbers, ARRAY[]::text[]) || v_stored) AS x
    WHERE x IS NOT NULL AND trim(x) <> ''
  )
  WHERE id = v_parent.id;

  RETURN jsonb_build_object('ok', true, 'linked', v_linked, 'admission_numbers', v_stored);
END;
$$;

GRANT EXECUTE ON FUNCTION public.link_parent_children_by_admission(text[]) TO authenticated;

DROP POLICY IF EXISTS "Parents can view their children" ON public.students;
CREATE POLICY "Parents can view their children"
ON public.students
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.parents p
    WHERE p.user_id = auth.uid() AND p.id = students.guardian_id
  )
  OR EXISTS (
    SELECT 1 FROM public.parent_student_links psl
    JOIN public.parents p ON p.id = psl.parent_id
    WHERE p.user_id = auth.uid() AND psl.student_id = students.id
  )
);
