-- Report theme color column (fixes school_settings 400 on report_theme_primary)
ALTER TABLE public.school_settings
  ADD COLUMN IF NOT EXISTS report_theme_primary text DEFAULT '#000000';

COMMENT ON COLUMN public.school_settings.report_theme_primary IS
  'Hex color for report card branding; overrides school theme when set.';

NOTIFY pgrst, 'reload schema';
