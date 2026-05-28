-- Run in Supabase Dashboard → SQL Editor if number generation fails with
-- "column admission_prefix does not exist" or HTTP 400 on schools select.

ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS admission_prefix TEXT;

UPDATE public.schools
SET admission_prefix = COALESCE(NULLIF(trim(admission_prefix), ''), school_code)
WHERE admission_prefix IS NULL OR trim(admission_prefix) = '';

-- Optional: parent phone + auth RPCs (full auth restructure)
-- See: supabase/migrations/20260528180000_auth_admission_restructure.sql

NOTIFY pgrst, 'reload schema';
