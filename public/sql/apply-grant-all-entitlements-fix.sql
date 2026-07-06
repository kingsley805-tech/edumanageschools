-- Fix Super Admin "Grant all modules" not reflecting on school admin portal (e.g. mingo).
-- Run in Supabase SQL Editor after apply-subscription-module-access-fix.sql

ALTER TABLE public.school_subscriptions
  ADD COLUMN IF NOT EXISTS entitlements_override boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.grant_all_school_module_entitlements(p_school_id uuid)
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
    school_id, module_key, enabled, can_read, can_create, can_edit, can_delete, can_export, updated_by, updated_at
  )
  SELECT p_school_id, pm.module_key, true, true, true, true, true, true, auth.uid(), now()
  FROM public.platform_modules pm
  ON CONFLICT (school_id, module_key) DO UPDATE SET
    enabled = true, can_read = true, can_create = true, can_edit = true,
    can_delete = true, can_export = true, updated_by = auth.uid(), updated_at = now();

  PERFORM public.sync_school_rbac_to_entitlements(p_school_id);

  UPDATE public.school_subscriptions
  SET entitlements_override = true, updated_at = now()
  WHERE school_id = p_school_id;

  RETURN jsonb_build_object('ok', true, 'entitlements_override', true);
END;
$$;

-- Re-run grant for mingo (replace school id if needed):
-- SELECT public.grant_all_school_module_entitlements(id) FROM public.schools WHERE school_code ILIKE 'mingo' LIMIT 1;

NOTIFY pgrst, 'reload schema';
