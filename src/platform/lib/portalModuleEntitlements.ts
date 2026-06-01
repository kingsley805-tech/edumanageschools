import { ALL_PORTAL_MODULES, parsePermissionCode, type PortalModuleDef } from "@/lib/rbac/permissionCatalog";

export const SUBSCRIPTION_MODULE_DENIED =
  "Access Denied. This module is not included in your organization's subscription package.";

/** Modules a school admin may assign to staff (from Super Admin package). */
export function filterPortalModulesByEntitlement(
  portalKeys: Set<string> | null,
  isSuperAdmin: boolean,
): typeof ALL_PORTAL_MODULES {
  if (isSuperAdmin || !portalKeys) return ALL_PORTAL_MODULES;
  return ALL_PORTAL_MODULES.filter((m) => portalKeys.has(m.key));
}

export function isPermissionCodeEntitled(
  code: string,
  portalKeys: Set<string> | null,
  isSuperAdmin: boolean,
): boolean {
  if (isSuperAdmin || !portalKeys) return true;
  const parsed = parsePermissionCode(code);
  if (!parsed) return true;
  return portalKeys.has(parsed.moduleKey);
}

/** Split selected RBAC codes into allowed vs denied for save validation. */
export function partitionPermissionCodes(
  codes: Set<string>,
  portalKeys: Set<string> | null,
  isSuperAdmin: boolean,
): { allowed: Set<string>; denied: string[] } {
  if (isSuperAdmin || !portalKeys) {
    return { allowed: codes, denied: [] };
  }
  const allowed = new Set<string>();
  const denied: string[] = [];
  for (const code of codes) {
    if (isPermissionCodeEntitled(code, portalKeys, false)) {
      allowed.add(code);
    } else {
      denied.push(code);
    }
  }
  return { allowed, denied };
}

export function moduleDefFromPortalKey(key: string): PortalModuleDef | undefined {
  return ALL_PORTAL_MODULES.find((m) => m.key === key);
}
