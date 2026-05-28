-- Run in Supabase Dashboard → SQL Editor if number generation fails with
-- "column admission_prefix does not exist" or HTTP 400 on schools select.

ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS admission_prefix TEXT;

-- First 3 letters of school name (letters only), not school_code
UPDATE public.schools
SET admission_prefix = upper(
  CASE
    WHEN length(regexp_replace(coalesce(school_name, ''), '[^a-zA-Z]', '', 'g')) >= 3 THEN
      substring(regexp_replace(coalesce(school_name, ''), '[^a-zA-Z]', '', 'g') from 1 for 3)
    WHEN length(regexp_replace(coalesce(school_name, ''), '[^a-zA-Z0-9]', '', 'g')) >= 3 THEN
      substring(regexp_replace(coalesce(school_name, ''), '[^a-zA-Z0-9]', '', 'g') from 1 for 3)
    WHEN length(regexp_replace(coalesce(school_name, ''), '[^a-zA-Z0-9]', '', 'g')) > 0 THEN
      rpad(regexp_replace(coalesce(school_name, ''), '[^a-zA-Z0-9]', '', 'g'), 3, 'X')
    ELSE upper(left(coalesce(school_code, 'SCH'), 3))
  END
)
WHERE admission_prefix IS NULL
   OR trim(admission_prefix) = ''
   OR admission_prefix = school_code;

-- Optional: parent phone + auth RPCs (full auth restructure)
-- See: supabase/migrations/20260528180000_auth_admission_restructure.sql

NOTIFY pgrst, 'reload schema';
