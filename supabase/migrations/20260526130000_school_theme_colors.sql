-- Per-school brand colors (green / black / white defaults)
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS theme_primary TEXT DEFAULT '#16a34a',
  ADD COLUMN IF NOT EXISTS theme_secondary TEXT DEFAULT '#0a0a0a',
  ADD COLUMN IF NOT EXISTS theme_accent TEXT DEFAULT '#ffffff';

COMMENT ON COLUMN public.schools.theme_primary IS 'Brand primary (buttons, active nav) — default green';
COMMENT ON COLUMN public.schools.theme_secondary IS 'Brand secondary (sidebar, text) — default black';
COMMENT ON COLUMN public.schools.theme_accent IS 'Brand accent (backgrounds, cards) — default white';

UPDATE public.schools
SET
  theme_primary = COALESCE(theme_primary, '#16a34a'),
  theme_secondary = COALESCE(theme_secondary, '#0a0a0a'),
  theme_accent = COALESCE(theme_accent, '#ffffff')
WHERE theme_primary IS NULL OR theme_secondary IS NULL OR theme_accent IS NULL;
