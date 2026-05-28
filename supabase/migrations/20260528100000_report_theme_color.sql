-- Report card theme color (separate from portal theme_primary on schools)
ALTER TABLE public.school_settings
  ADD COLUMN IF NOT EXISTS report_theme_primary text DEFAULT '#000000';

COMMENT ON COLUMN public.school_settings.report_theme_primary IS
  'Primary accent for printable/PDF report cards (headers, borders, highlights). Default black.';
