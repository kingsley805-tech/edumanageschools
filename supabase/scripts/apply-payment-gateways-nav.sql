-- Payment gateways sidebar (RBAC) — run in Supabase SQL Editor if the menu item is missing
INSERT INTO public.permissions (category, module, action, code, description) VALUES
  ('finance', 'portal.billing_payment_gateways', 'view', 'portal.billing_payment_gateways.view', 'View Payment gateways'),
  ('finance', 'portal.billing_payment_gateways', 'edit', 'portal.billing_payment_gateways.edit', 'Edit Payment gateways'),
  ('finance', 'portal.billing_payment_gateways', 'manage', 'portal.billing_payment_gateways.manage', 'Manage Payment gateways')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.slug IN ('school_admin', 'accountant') AND r.school_id IS NULL
  AND p.code LIKE 'portal.billing_payment_gateways.%'
ON CONFLICT (role_id, permission_id) DO NOTHING;
