-- Transport module tables (run if you see "transport_routes" schema cache error)
-- For ALL operations modules at once, use apply-operations-modules.sql instead.

CREATE TABLE IF NOT EXISTS public.transport_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  vehicle_plate text,
  driver_name text,
  capacity int,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transport_routes_school ON public.transport_routes(school_id, name);

ALTER TABLE public.transport_routes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS transport_routes_school_rw ON public.transport_routes;
CREATE POLICY transport_routes_school_rw ON public.transport_routes FOR ALL USING (
  school_id = public.get_user_school_id(auth.uid())
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
) WITH CHECK (
  school_id = public.get_user_school_id(auth.uid())
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
);

INSERT INTO public.platform_modules (module_key, category, label, portal_module_key, sort_order) VALUES
  ('transport', 'transport', 'Transport', 'transport', 600)
ON CONFLICT (module_key) DO UPDATE SET
  label = EXCLUDED.label,
  category = EXCLUDED.category,
  portal_module_key = EXCLUDED.portal_module_key,
  sort_order = EXCLUDED.sort_order;

NOTIFY pgrst, 'reload schema';
