-- =============================================================================
-- Portal RBAC backfill (run AFTER apply-rbac-full.sql)
-- =============================================================================

INSERT INTO public.user_role_assignments (user_id, role_id, school_id)
SELECT p.id, r.id, p.school_id
FROM public.profiles p
JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role = 'admin'::app_role
JOIN public.roles r ON r.slug = 'school_admin' AND r.school_id IS NULL
WHERE p.school_id IS NOT NULL
ON CONFLICT DO NOTHING;
