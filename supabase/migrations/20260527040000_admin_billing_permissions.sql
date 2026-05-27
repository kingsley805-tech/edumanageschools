-- Ensure school_admin RBAC includes billing view permissions used by the app

INSERT INTO public.permissions (module, action, code, description) VALUES
  ('invoices', 'view', 'invoices.view', 'View invoices')
ON CONFLICT (code) DO NOTHING;

CREATE OR REPLACE FUNCTION public._grant_permissions_to_role(_role_slug TEXT, _permission_codes TEXT[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role_id UUID;
  v_code TEXT;
  v_perm_id UUID;
BEGIN
  SELECT id INTO v_role_id FROM public.roles WHERE slug = _role_slug AND school_id IS NULL;
  IF v_role_id IS NULL THEN RETURN; END IF;
  FOREACH v_code IN ARRAY _permission_codes LOOP
    SELECT id INTO v_perm_id FROM public.permissions WHERE code = v_code;
    IF v_perm_id IS NOT NULL THEN
      INSERT INTO public.role_permissions (role_id, permission_id)
      VALUES (v_role_id, v_perm_id)
      ON CONFLICT (role_id, permission_id) DO NOTHING;
    END IF;
  END LOOP;
END;
$$;

SELECT public._grant_permissions_to_role('school_admin', ARRAY[
  'invoices.view',
  'fees.view_status'
]);

-- Backfill RBAC assignment for existing portal admins missing school_admin role
INSERT INTO public.user_role_assignments (user_id, role_id, school_id)
SELECT p.id, r.id, p.school_id
FROM public.profiles p
JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role = 'admin'::app_role
JOIN public.roles r ON r.slug = 'school_admin' AND r.school_id IS NULL
WHERE p.school_id IS NOT NULL
ON CONFLICT DO NOTHING;

DROP FUNCTION IF EXISTS public._grant_permissions_to_role(TEXT, TEXT[]);
