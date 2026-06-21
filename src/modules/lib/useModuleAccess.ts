import { usePermissions } from "@/hooks/usePermissions";
import { permissionCode, type PermissionAction } from "@/lib/rbac/permissionCatalog";

export function useModuleAccess(moduleKey: string) {
  const { hasPermission, loading } = usePermissions();

  const can = (action: PermissionAction) => hasPermission(permissionCode(moduleKey, action));

  return {
    loading,
    canView: can("view"),
    canCreate: can("create"),
    canEdit: can("edit"),
    canDelete: can("delete"),
    canExport: can("export"),
    canManage: can("manage"),
  };
}
