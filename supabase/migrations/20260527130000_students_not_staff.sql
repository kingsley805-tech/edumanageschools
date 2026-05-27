-- Students are not staff/employees: block staff portal roles, RBAC assignments, and admin checks.

CREATE OR REPLACE FUNCTION public.is_portal_student(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.students s
    WHERE s.user_id = _user_id OR s.profile_id = _user_id
  )
  OR EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id AND ur.role = 'student'::app_role
  );
$$;

COMMENT ON FUNCTION public.is_portal_student(uuid) IS
  'True when the account is a student (students row or student portal role). Students are never staff.';

-- Remove erroneous staff roles / RBAC from student accounts
DELETE FROM public.user_roles ur
WHERE ur.role IN ('admin', 'teacher', 'accountant', 'auditor', 'super_admin')
  AND public.is_portal_student(ur.user_id);

DELETE FROM public.user_role_assignments ura
WHERE public.is_portal_student(ura.user_id);

CREATE OR REPLACE FUNCTION public.is_school_admin(_user_id uuid, _school_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT public.is_portal_student(_user_id)
    AND EXISTS (
      SELECT 1
      FROM public.user_roles ur
      JOIN public.profiles p ON p.id = ur.user_id
      WHERE ur.user_id = _user_id
        AND ur.role = 'admin'
        AND p.school_id = _school_id
    );
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  IF public.is_portal_student(_user_id)
    AND _role IN ('admin', 'teacher', 'accountant', 'auditor', 'super_admin') THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
END;
$$;

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

CREATE OR REPLACE FUNCTION public.enforce_student_not_staff_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IN ('admin', 'teacher', 'accountant', 'auditor', 'super_admin') THEN
    IF public.is_portal_student(NEW.user_id) THEN
      RAISE EXCEPTION 'Students cannot have staff or admin portal roles';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_roles_block_staff_on_students ON public.user_roles;
CREATE TRIGGER trg_user_roles_block_staff_on_students
  BEFORE INSERT OR UPDATE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_student_not_staff_role();

CREATE OR REPLACE FUNCTION public.enforce_student_not_rbac_staff()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_portal_student(NEW.user_id) THEN
    RAISE EXCEPTION 'Students cannot be assigned staff RBAC roles';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_role_assignments_block_students ON public.user_role_assignments;
CREATE TRIGGER trg_user_role_assignments_block_students
  BEFORE INSERT OR UPDATE ON public.user_role_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_student_not_rbac_staff();
