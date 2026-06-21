-- HR, Library, Transport, Hostel, Inventory modules — tables, platform catalog, portal RBAC

-- ---------------------------------------------------------------------------
-- HR
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hr_leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  staff_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  leave_type text NOT NULL DEFAULT 'Annual',
  start_date date NOT NULL,
  end_date date NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hr_leave_requests_school ON public.hr_leave_requests(school_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.hr_staff_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  staff_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  attendance_date date NOT NULL,
  status text NOT NULL DEFAULT 'present',
  check_in time,
  check_out time,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, staff_user_id, attendance_date)
);

CREATE INDEX IF NOT EXISTS idx_hr_staff_attendance_school_date ON public.hr_staff_attendance(school_id, attendance_date DESC);

-- ---------------------------------------------------------------------------
-- Library
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Transport
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Hostel
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Inventory
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  sku text,
  name text NOT NULL,
  category text,
  quantity numeric(12,2) NOT NULL DEFAULT 0,
  unit text DEFAULT 'pcs',
  location text,
  reorder_level numeric(12,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_items_school ON public.inventory_items(school_id, name);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.hr_leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_staff_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.library_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transport_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hostel_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hostel_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'hr_leave_requests',
    'hr_staff_attendance',
    'library_books',
    'transport_routes',
    'hostel_blocks',
    'hostel_rooms',
    'inventory_items'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_school_rw ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_school_rw ON public.%I FOR ALL USING (
        school_id = public.get_user_school_id(auth.uid())
        OR public.has_role(auth.uid(), ''super_admin''::app_role)
      ) WITH CHECK (
        school_id = public.get_user_school_id(auth.uid())
        OR public.has_role(auth.uid(), ''super_admin''::app_role)
      )',
      t,
      t
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Platform module catalog (Super Admin feature matrix)
-- ---------------------------------------------------------------------------
INSERT INTO public.platform_modules (module_key, category, label, portal_module_key, sort_order) VALUES
  ('staff_management', 'hr', 'Staff Management', 'staff_management', 400),
  ('payroll', 'hr', 'Payroll', 'billing_payroll', 410),
  ('leave_management', 'hr', 'Leave Management', 'leave_management', 420),
  ('staff_attendance', 'hr', 'Staff Attendance', 'staff_attendance', 430),
  ('library', 'library', 'Library Management', 'library_management', 500),
  ('transport', 'transport', 'Transport', 'transport', 600),
  ('hostel', 'hostel', 'Hostel', 'hostel', 700),
  ('inventory', 'inventory', 'Inventory', 'inventory', 800)
ON CONFLICT (module_key) DO UPDATE SET
  label = EXCLUDED.label,
  category = EXCLUDED.category,
  portal_module_key = EXCLUDED.portal_module_key,
  sort_order = EXCLUDED.sort_order;

-- ---------------------------------------------------------------------------
-- Portal RBAC permissions (school admin role matrix)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  mod_key text;
  act text;
  mod_label text;
  mod_keys text[] := ARRAY[
    'staff_management',
    'leave_management',
    'staff_attendance',
    'library_management',
    'transport',
    'hostel',
    'inventory'
  ];
  acts text[] := ARRAY['view', 'create', 'edit', 'delete', 'export', 'manage'];
  cat text;
BEGIN
  FOREACH mod_key IN ARRAY mod_keys LOOP
    mod_label := initcap(replace(mod_key, '_', ' '));
    cat := CASE
      WHEN mod_key IN ('staff_management', 'leave_management', 'staff_attendance') THEN 'hr'
      WHEN mod_key = 'library_management' THEN 'library'
      ELSE mod_key
    END;
    FOREACH act IN ARRAY acts LOOP
      INSERT INTO public.permissions (category, module, action, code, description)
      VALUES (
        cat,
        'portal.' || mod_key,
        act,
        'portal.' || mod_key || '.' || act,
        initcap(act) || ' ' || mod_label
      )
      ON CONFLICT (code) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- Grant new portal permissions to school_admin and super_admin roles
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.slug IN ('school_admin', 'super_admin')
  AND (
    p.code LIKE 'portal.staff_management.%'
    OR p.code LIKE 'portal.leave_management.%'
    OR p.code LIKE 'portal.staff_attendance.%'
    OR p.code LIKE 'portal.library_management.%'
    OR p.code LIKE 'portal.transport.%'
    OR p.code LIKE 'portal.hostel.%'
    OR p.code LIKE 'portal.inventory.%'
  )
ON CONFLICT DO NOTHING;

NOTIFY pgrst, 'reload schema';
