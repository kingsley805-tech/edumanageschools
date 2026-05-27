-- Enforce RBAC via role assignments only; super_admin remains unrestricted.

CREATE OR REPLACE FUNCTION public.has_permission(
  _user_id UUID,
  _permission_code TEXT,
  _school_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _user_id IS NULL OR _permission_code IS NULL THEN
    RETURN FALSE;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'super_admin'::app_role
  ) THEN
    RETURN TRUE;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.user_role_assignments ura
    JOIN public.roles r ON r.id = ura.role_id
    JOIN public.role_permissions rp ON rp.role_id = r.id
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE ura.user_id = _user_id
      AND p.code = _permission_code
      AND (
        _school_id IS NULL
        OR ura.school_id IS NULL
        OR ura.school_id = _school_id
      )
      AND (
        r.school_id IS NULL
        OR _school_id IS NULL
        OR r.school_id = _school_id
      )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_permissions(
  _user_id UUID,
  _school_id UUID DEFAULT NULL
)
RETURNS SETOF TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'super_admin'::app_role
  ) THEN
    RETURN QUERY SELECT code FROM public.permissions;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT DISTINCT p.code
  FROM public.user_role_assignments ura
  JOIN public.roles r ON r.id = ura.role_id
  JOIN public.role_permissions rp ON rp.role_id = r.id
  JOIN public.permissions p ON p.id = rp.permission_id
  WHERE ura.user_id = _user_id
    AND (_school_id IS NULL OR ura.school_id IS NULL OR ura.school_id = _school_id);
END;
$$;
