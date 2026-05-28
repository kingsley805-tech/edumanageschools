-- Reliable signup validation for generated admission numbers (anon-safe)

CREATE OR REPLACE FUNCTION public.validate_registration_number_for_signup(
  p_registration_number text,
  p_number_type text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_num text := upper(trim(p_registration_number));
  v_row public.registration_numbers%ROWTYPE;
BEGIN
  IF v_num IS NULL OR length(v_num) < 5 THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Admission number is required.');
  END IF;

  IF p_number_type NOT IN ('student', 'employee') THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Invalid registration type.');
  END IF;

  SELECT * INTO v_row
  FROM public.registration_numbers
  WHERE upper(trim(registration_number)) = v_num
    AND number_type = p_number_type
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'Admission number not found. Check the number from Number Generator or contact your school administrator.'
    );
  END IF;

  IF v_row.status <> 'unused' THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'This admission number has already been used. Ask your school for a new number.'
    );
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'school_id', v_row.school_id,
    'registration_number', v_row.registration_number
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_registration_number_for_signup(text, text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
