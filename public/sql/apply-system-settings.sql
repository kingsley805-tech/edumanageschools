-- System settings (public signup toggle, etc.)
-- Run this entire script in Supabase → SQL Editor → Run
-- Project: xbhhpjtwawfawifhpxbe

CREATE TABLE IF NOT EXISTS public.system_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read system settings" ON public.system_settings;
CREATE POLICY "Anyone can read system settings"
  ON public.system_settings
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Super admins manage system settings" ON public.system_settings;
CREATE POLICY "Super admins manage system settings"
  ON public.system_settings
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

INSERT INTO public.system_settings (key, value)
VALUES ('public_signup_enabled', 'true')
ON CONFLICT (key) DO NOTHING;

GRANT SELECT ON public.system_settings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.system_settings TO authenticated;
