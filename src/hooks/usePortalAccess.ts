import { useCallback, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { usePermissions } from "@/hooks/usePermissions";
import { useUserRole } from "@/hooks/useUserRole";
import { buildAdminNav, ensurePaymentGatewaysInNav } from "@/lib/rbac/adminNavConfig";
import { requiredViewPermissionForPath } from "@/lib/rbac/routeGuards";
import { permissionCode, type PermissionAction } from "@/lib/rbac/permissionCatalog";

/** RBAC-aware access for admin portal shell (sidebar + route guards). */
export function usePortalAccess() {
  const location = useLocation();
  const { role } = useUserRole();
  const { hasPermission, isSuperAdmin, isSchoolAdmin, loading } = usePermissions();

  const hasFullAccess = isSuperAdmin || role === "super_admin";
  const hasAdminNavAccess = hasFullAccess || isSchoolAdmin || role === "admin";

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
    if (!hasAdminNavAccess && loading) return [];
    const built = buildAdminNav(can);
    if (hasAdminNavAccess || can(permissionCode("billing_payments", "view"))) {
      return ensurePaymentGatewaysInNav(built);
    }
    return built;
  }, [can, hasAdminNavAccess, loading]);

  const canAccessCurrentRoute = useMemo(() => {
    if (hasAdminNavAccess) return true;
    const required = requiredViewPermissionForPath(location.pathname);
    if (!required) return true;
    if (
      location.pathname.startsWith("/admin/billing/settings/payments") &&
      can(permissionCode("billing_payments", "view"))
    ) {
      return true;
    }
    return can(required);
  }, [hasAdminNavAccess, location.pathname, can]);

  return {
    loading,
    hasFullAccess,
    can,
    canModule,
    navItems,
    canAccessCurrentRoute,
  };
}
