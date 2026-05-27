-- School portal admins (user_roles.admin) keep full access to manage staff permissions.
-- Students remain blocked via is_portal_student().

CREATE OR REPLACE FUNCTION public.has_permission(
  _user_id uuid,
  _permission_code text,
  _school_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _user_id IS NULL OR _permission_code IS NULL THEN
    RETURN FALSE;
  END IF;

  IF public.is_portal_student(_user_id) THEN
    RETURN FALSE;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'super_admin'::app_role
  ) THEN
    RETURN TRUE;
  END IF;

  -- Portal school owner: full permissions in their school (manage staff RBAC, etc.)
  IF EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.user_id = _user_id
      AND ur.role = 'admin'::app_role
      AND (_school_id IS NULL OR p.school_id = _school_id OR p.school_id IS NULL)
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
  _user_id uuid,
  _school_id uuid DEFAULT NULL
)
RETURNS SETOF text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_portal_student(_user_id) THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'super_admin'::app_role
  ) THEN
    RETURN QUERY SELECT code FROM public.permissions;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.user_id = _user_id
      AND ur.role = 'admin'::app_role
      AND (_school_id IS NULL OR p.school_id = _school_id)
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

-- Ensure existing portal admins have school_admin RBAC row (optional; portal admin bypass above is sufficient)
INSERT INTO public.user_role_assignments (user_id, role_id, school_id)
SELECT p.id, r.id, p.school_id
FROM public.profiles p
JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role = 'admin'::app_role
JOIN public.roles r ON r.slug = 'school_admin' AND r.school_id IS NULL
WHERE p.school_id IS NOT NULL
  AND NOT public.is_portal_student(p.id)
ON CONFLICT DO NOTHING;
