-- Library module tables (run if you see "library_books" schema cache error)
-- For ALL operations modules at once, use apply-operations-modules.sql instead.

CREATE TABLE IF NOT EXISTS public.library_books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  title text NOT NULL,
  author text,
  isbn text,
  category text,
  copies_total int NOT NULL DEFAULT 1,
  copies_available int NOT NULL DEFAULT 1,
  shelf_location text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_library_books_school ON public.library_books(school_id, title);

ALTER TABLE public.library_books ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS library_books_school_rw ON public.library_books;
CREATE POLICY library_books_school_rw ON public.library_books FOR ALL USING (
  school_id = public.get_user_school_id(auth.uid())
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
) WITH CHECK (
  school_id = public.get_user_school_id(auth.uid())
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
);

INSERT INTO public.platform_modules (module_key, category, label, portal_module_key, sort_order) VALUES
  ('library', 'library', 'Library Management', 'library_management', 500)
ON CONFLICT (module_key) DO UPDATE SET
  label = EXCLUDED.label,
  category = EXCLUDED.category,
  portal_module_key = EXCLUDED.portal_module_key,
  sort_order = EXCLUDED.sort_order;

NOTIFY pgrst, 'reload schema';
