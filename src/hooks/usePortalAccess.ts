import { useCallback, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { usePermissions } from "@/hooks/usePermissions";
import { useUserRole } from "@/hooks/useUserRole";
import { buildAdminNav } from "@/lib/rbac/adminNavConfig";
import { requiredViewPermissionForPath } from "@/lib/rbac/routeGuards";
import { permissionCode, type PermissionAction } from "@/lib/rbac/permissionCatalog";

/** RBAC-aware access for admin portal shell (sidebar + route guards). */
export function usePortalAccess() {
  const location = useLocation();
  const { role } = useUserRole();
  const { hasPermission, isSuperAdmin, loading } = usePermissions();

  const hasFullAccess = isSuperAdmin || role === "super_admin";

  const can = useCallback(
    (code: string) => hasFullAccess || hasPermission(code),
    [hasFullAccess, hasPermission],
  );

  const canModule = useCallback(
    (moduleKey: string, action: PermissionAction = "view") =>
      can(permissionCode(moduleKey, action)),
    [can],
  );

  const navItems = useMemo(() => {
    if (!hasFullAccess && loading) return [];
    return buildAdminNav(can);
  }, [can, hasFullAccess, loading]);

  const canAccessCurrentRoute = useMemo(() => {
    if (hasFullAccess) return true;
    const required = requiredViewPermissionForPath(location.pathname);
    if (!required) return true;
    return can(required);
  }, [hasFullAccess, location.pathname, can]);

  return {
    loading,
    hasFullAccess,
    can,
    canModule,
    navItems,
    canAccessCurrentRoute,
  };
}
