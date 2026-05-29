-- Lesson Notes sidebar (RBAC) — run in Supabase SQL Editor if the menu item is missing
INSERT INTO public.permissions (category, module, action, code, description) VALUES
  ('academics', 'portal.lesson_notes', 'view', 'portal.lesson_notes.view', 'View Lesson Notes'),
  ('academics', 'portal.lesson_notes', 'create', 'portal.lesson_notes.create', 'Create Lesson Notes'),
  ('academics', 'portal.lesson_notes', 'edit', 'portal.lesson_notes.edit', 'Edit Lesson Notes'),
  ('academics', 'portal.lesson_notes', 'approve', 'portal.lesson_notes.approve', 'Approve Lesson Notes'),
  ('academics', 'portal.lesson_notes', 'export', 'portal.lesson_notes.export', 'Export Lesson Notes'),
  ('academics', 'portal.lesson_notes', 'manage', 'portal.lesson_notes.manage', 'Manage Lesson Notes')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.slug IN ('school_admin', 'registrar') AND r.school_id IS NULL
  AND p.code LIKE 'portal.lesson_notes.%'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Accountants can review lesson notes (read + approve)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.slug = 'accountant' AND r.school_id IS NULL
  AND p.code IN (
    'portal.lesson_notes.view',
    'portal.lesson_notes.approve',
    'portal.lesson_notes.export'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;
