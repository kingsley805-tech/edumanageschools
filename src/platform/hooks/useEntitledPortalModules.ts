import { useMemo } from "react";
import { usePermissions } from "@/hooks/usePermissions";
import { ALL_PORTAL_MODULES } from "@/lib/rbac/permissionCatalog";
import { filterPortalModulesByEntitlement } from "@/platform/lib/portalModuleEntitlements";
import { useSchoolEntitlements } from "@/platform/hooks/useSchoolEntitlements";

/** Portal modules visible to the current user for RBAC assignment UI. */
export function useEntitledPortalModules() {
  const { isSuperAdmin, isSchoolAdmin } = usePermissions();
  const { enabledPortalKeys, enforced, loading } = useSchoolEntitlements();

  const entitledModules = useMemo(
    () => filterPortalModulesByEntitlement(enabledPortalKeys, isSuperAdmin, isSchoolAdmin),
    [enabledPortalKeys, isSuperAdmin, isSchoolAdmin],
  );

  return {
    loading,
    isSuperAdmin,
    enforced,
    enabledPortalKeys,
    entitledModules,
    allModules: ALL_PORTAL_MODULES,
  };
}
