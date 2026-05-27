-- Fix: school portal admins could not save role_permissions (RLS required admin.manage_permissions only).

CREATE OR REPLACE FUNCTION public.can_manage_role_permissions(_user_id uuid, _school_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT public.is_portal_student(_user_id)
    AND (
      public.has_role(_user_id, 'super_admin'::app_role)
      OR (
        public.has_role(_user_id, 'admin'::app_role)
        AND EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = _user_id
            AND (_school_id IS NULL OR p.school_id = _school_id OR p.school_id IS NULL)
        )
      )
      OR public.has_permission(_user_id, 'admin.manage_permissions', _school_id)
      OR public.has_permission(_user_id, 'portal.staff_access.manage', _school_id)
    );
$$;

DROP POLICY IF EXISTS "Admins manage role permissions" ON public.role_permissions;
CREATE POLICY "Admins manage role permissions"
  ON public.role_permissions
  FOR ALL
  TO authenticated
  USING (public.can_manage_role_permissions(auth.uid(), public.get_user_school_id(auth.uid())))
  WITH CHECK (public.can_manage_role_permissions(auth.uid(), public.get_user_school_id(auth.uid())));

DROP POLICY IF EXISTS "Admins manage school roles" ON public.roles;
CREATE POLICY "Admins manage school roles"
  ON public.roles
  FOR ALL
  TO authenticated
  USING (
    public.can_manage_role_permissions(auth.uid(), COALESCE(school_id, public.get_user_school_id(auth.uid())))
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  )
  WITH CHECK (
    public.can_manage_role_permissions(auth.uid(), COALESCE(school_id, public.get_user_school_id(auth.uid())))
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

DROP POLICY IF EXISTS "Admins manage role assignments" ON public.user_role_assignments;
CREATE POLICY "Admins manage role assignments"
  ON public.user_role_assignments
  FOR ALL
  TO authenticated
  USING (
    public.can_manage_role_permissions(auth.uid(), school_id)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  )
  WITH CHECK (
    public.can_manage_role_permissions(auth.uid(), school_id)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

CREATE OR REPLACE FUNCTION public.save_role_permissions(
  p_role_id uuid,
  p_permission_codes text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school_id uuid;
  v_inserted int;
  v_missing text[];
BEGIN
  v_school_id := public.get_user_school_id(auth.uid());

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.can_manage_role_permissions(auth.uid(), v_school_id) THEN
    RAISE EXCEPTION 'Not authorized to manage role permissions';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.roles WHERE id = p_role_id) THEN
    RAISE EXCEPTION 'Role not found';
  END IF;

  SELECT array_agg(c ORDER BY c)
  INTO v_missing
  FROM unnest(p_permission_codes) AS c
  WHERE NOT EXISTS (SELECT 1 FROM public.permissions p WHERE p.code = c);

  DELETE FROM public.role_permissions WHERE role_id = p_role_id;

  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT p_role_id, p.id
  FROM public.permissions p
  WHERE p.code = ANY(p_permission_codes)
  ON CONFLICT (role_id, permission_id) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  RETURN jsonb_build_object(
    'inserted', v_inserted,
    'requested', coalesce(array_length(p_permission_codes, 1), 0),
    'missing_codes', coalesce(v_missing, ARRAY[]::text[])
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_role_permissions(uuid, text[]) TO authenticated;
