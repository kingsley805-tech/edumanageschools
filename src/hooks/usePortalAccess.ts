import { useCallback, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { usePermissions } from "@/hooks/usePermissions";
import { useUserRole } from "@/hooks/useUserRole";
import { useSchoolEntitlements } from "@/platform/hooks/useSchoolEntitlements";
import { buildAdminNav, ensurePaymentGatewaysInNav, ensureSystemBackupInNav } from "@/lib/rbac/adminNavConfig";
import { moduleByPath, permissionCode, type PermissionAction } from "@/lib/rbac/permissionCatalog";
import { requiredViewPermissionForPath } from "@/lib/rbac/routeGuards";

/** RBAC-aware access for admin portal shell (sidebar + route guards). */
export function usePortalAccess() {
  const location = useLocation();
  const { role } = useUserRole();
  const { hasPermission, isSuperAdmin, isSchoolAdmin, loading } = usePermissions();

  const hasFullAccess = isSuperAdmin || role === "super_admin";
  const hasAdminNavAccess = hasFullAccess || isSchoolAdmin || role === "admin";
  const {
    enabledPortalKeys,
    licensablePortalKeys,
    isModuleEnabledForPath,
    isWritable,
    enforced,
    subscription,
    loading: entitlementsLoading,
    rows: entitlementRows,
  } = useSchoolEntitlements();

  const can = useCallback(
    (code: string) => hasFullAccess || hasAdminNavAccess || hasPermission(code),
    [hasFullAccess, hasAdminNavAccess, hasPermission],
  );

  const canModule = useCallback(
    (moduleKey: string, action: PermissionAction = "view") =>
      can(permissionCode(moduleKey, action)),
    [can],
  );

  const navItems = useMemo(() => {
    if (!hasAdminNavAccess && loading) return [];
    let built = buildAdminNav(can);
    if (hasAdminNavAccess || can(permissionCode("billing_payments", "view"))) {
      built = ensurePaymentGatewaysInNav(built);
    }
    // Always surface System Backup for school / super admins
    if (hasAdminNavAccess || can(permissionCode("system_backup", "view"))) {
      built = ensureSystemBackupInNav(built);
    }
    // Super-admin / school-admin: show full catalog.
    // Subscription packages only hide modules that are explicitly licensed in platform_modules.
    if (hasFullAccess || hasAdminNavAccess || !enabledPortalKeys) return built;
    return built
      .map((entry) => {
        if (!("items" in entry)) {
          const mod = moduleByPath(entry.path);
          if (!mod) return entry;
          if (mod.key === "organization_subscription" || mod.key === "system_backup") return entry;
          if (licensablePortalKeys && !licensablePortalKeys.has(mod.key)) return entry;
          return enabledPortalKeys.has(mod.key) ? entry : null;
        }
        return {
          ...entry,
          items: entry.items.filter((item) => {
            const mod = moduleByPath(item.path);
            if (!mod) return true;
            if (mod.key === "organization_subscription" || mod.key === "system_backup") return true;
            if (licensablePortalKeys && !licensablePortalKeys.has(mod.key)) return true;
            return enabledPortalKeys.has(mod.key);
          }),
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry != null)
      .filter((entry) => !("items" in entry) || entry.items.length > 0);
  }, [
    can,
    hasAdminNavAccess,
    loading,
    hasFullAccess,
    enabledPortalKeys,
    licensablePortalKeys,
  ]);

  const canAccessCurrentRoute = useMemo(() => {
    if (hasFullAccess) return true;
    if (!isModuleEnabledForPath(location.pathname)) return false;
    if (!hasAdminNavAccess) {
      const required = requiredViewPermissionForPath(location.pathname);
      if (!required) return true;
      if (
        location.pathname.startsWith("/admin/billing/settings/payments") &&
        can(permissionCode("billing_payments", "view"))
      ) {
        return true;
      }
      return can(required);
    }
    const required = requiredViewPermissionForPath(location.pathname);
    if (!required) return true;
    if (
      location.pathname.startsWith("/admin/billing/settings/payments") &&
      can(permissionCode("billing_payments", "view"))
    ) {
      return true;
    }
    return can(required);
  }, [hasAdminNavAccess, hasFullAccess, location.pathname, can, isModuleEnabledForPath]);

  return {
    loading: loading || (entitlementsLoading && entitlementRows.length === 0),
    hasFullAccess,
    can,
    canModule,
    navItems,
    canAccessCurrentRoute,
    subscriptionEnforced: enforced,
    subscription,
    isWritable,
  };
}
