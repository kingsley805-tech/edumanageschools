-- Add RESTRICTIVE policies requiring authentication on sensitive tables.
-- These combine with existing PERMISSIVE policies via AND, blocking anonymous access
-- without breaking existing authenticated access paths.

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'profiles','students','parents','attendance','grades',
    'exam_results','online_exam_answers','online_exam_attempts',
    'exam_proctoring_logs','messages','payments','invoices'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS "require_authenticated_access" ON public.%I',
      t
    );
    EXECUTE format(
      'CREATE POLICY "require_authenticated_access" ON public.%I '
      'AS RESTRICTIVE FOR ALL TO public '
      'USING (auth.uid() IS NOT NULL) '
      'WITH CHECK (auth.uid() IS NOT NULL)',
      t
    );
  END LOOP;
END $$;

-- Protect schools.admin_key column: revoke column access from anon/authenticated.
-- Only service_role (used by the SECURITY DEFINER signup trigger via vault) can read it.
REVOKE SELECT (admin_key) ON public.schools FROM anon, authenticated;