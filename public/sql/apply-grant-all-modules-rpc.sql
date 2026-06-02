-- Super Admin helper: grant full module + CRUD access to an organization
-- Run in Supabase SQL Editor after apply-platform-saas-control.sql

CREATE OR REPLACE FUNCTION public.grant_all_school_module_entitlements(
  p_school_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_super_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Forbidden');
  END IF;

  INSERT INTO public.school_module_entitlements (
    school_id,
    module_key,
    enabled,
    can_read,
    can_create,
    can_edit,
    can_delete,
    can_export,
    updated_by,
    updated_at
  )
  SELECT
    p_school_id,
    pm.module_key,
    true,
    true,
    true,
    true,
    true,
    true,
    auth.uid(),
    now()
  FROM public.platform_modules pm
  ON CONFLICT (school_id, module_key) DO UPDATE SET
    enabled = true,
    can_read = true,
    can_create = true,
    can_edit = true,
    can_delete = true,
    can_export = true,
    updated_by = auth.uid(),
    updated_at = now();

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.grant_all_school_module_entitlements(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
