-- Hostel module tables (run if you see "hostel_blocks" schema cache error)
-- For all operations modules (HR, Library, Transport, Inventory too), use apply-operations-modules.sql

CREATE TABLE IF NOT EXISTS public.hostel_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  gender text,
  capacity int,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, name)
);

CREATE TABLE IF NOT EXISTS public.hostel_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  block_id uuid NOT NULL REFERENCES public.hostel_blocks(id) ON DELETE CASCADE,
  room_number text NOT NULL,
  capacity int NOT NULL DEFAULT 1,
  occupied int NOT NULL DEFAULT 0,
  gender text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, block_id, room_number)
);

CREATE INDEX IF NOT EXISTS idx_hostel_rooms_school ON public.hostel_rooms(school_id);

ALTER TABLE public.hostel_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hostel_rooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hostel_blocks_school_rw ON public.hostel_blocks;
CREATE POLICY hostel_blocks_school_rw ON public.hostel_blocks FOR ALL USING (
  school_id = public.get_user_school_id(auth.uid())
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
) WITH CHECK (
  school_id = public.get_user_school_id(auth.uid())
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
);

DROP POLICY IF EXISTS hostel_rooms_school_rw ON public.hostel_rooms;
CREATE POLICY hostel_rooms_school_rw ON public.hostel_rooms FOR ALL USING (
  school_id = public.get_user_school_id(auth.uid())
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
) WITH CHECK (
  school_id = public.get_user_school_id(auth.uid())
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
);

INSERT INTO public.platform_modules (module_key, category, label, portal_module_key, sort_order) VALUES
  ('hostel', 'hostel', 'Hostel', 'hostel', 700)
ON CONFLICT (module_key) DO UPDATE SET
  label = EXCLUDED.label,
  category = EXCLUDED.category,
  portal_module_key = EXCLUDED.portal_module_key,
  sort_order = EXCLUDED.sort_order;

NOTIFY pgrst, 'reload schema';
