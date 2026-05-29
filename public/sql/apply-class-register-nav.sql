-- RBAC permissions for Class Registers sidebar (run after apply-class-register.sql)

INSERT INTO public.permissions (module_key, resource, action, code, label)
VALUES
  ('class_registers', 'portal.class_registers', 'view', 'portal.class_registers.view', 'View Class Registers'),
  ('class_registers', 'portal.class_registers', 'create', 'portal.class_registers.create', 'Create Class Registers'),
  ('class_registers', 'portal.class_registers', 'edit', 'portal.class_registers.edit', 'Edit Class Registers'),
  ('class_registers', 'portal.class_registers', 'export', 'portal.class_registers.export', 'Export Class Registers'),
  ('class_registers', 'portal.class_registers', 'manage', 'portal.class_registers.manage', 'Manage Class Registers'),
  ('class_registers', 'portal.class_registers', 'approve', 'portal.class_registers.approve', 'Approve Class Registers')
ON CONFLICT (code) DO NOTHING;

-- Grant to school admin role template (same pattern as attendance)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.slug IN ('school_admin', 'super_admin')
  AND p.code LIKE 'portal.class_registers.%'
ON CONFLICT DO NOTHING;

NOTIFY pgrst, 'reload schema';
