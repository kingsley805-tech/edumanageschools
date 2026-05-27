-- =============================================================================
-- Portal RBAC setup (run in Supabase Dashboard -> SQL Editor)
-- Project: https://supabase.com/dashboard/project/xbhhpjtwawfawifhpxbe/sql/new
-- Run this file AFTER core RBAC migration (20260526120000) is applied.
-- =============================================================================
-- Step 1: Paste and run: supabase/migrations/20260527100000_rbac_portal_catalog.sql
-- Step 2: Paste and run: supabase/migrations/20260527110000_rbac_default_role_grants.sql
-- Step 3: Paste and run: supabase/migrations/20260527120000_rbac_strict_permission_checks.sql
--
-- Ensures portal admins keep school_admin RBAC (from 20260527050000 backfill):
INSERT INTO public.user_role_assignments (user_id, role_id, school_id)
SELECT p.id, r.id, p.school_id
FROM public.profiles p
JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role = 'admin'::app_role
JOIN public.roles r ON r.slug = 'school_admin' AND r.school_id IS NULL
WHERE p.school_id IS NOT NULL
ON CONFLICT DO NOTHING;
