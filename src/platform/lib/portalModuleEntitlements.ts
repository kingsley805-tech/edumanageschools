import {
  ALL_PORTAL_MODULES,
  moduleByPath,
  parsePermissionCode,
  type PortalModuleDef,
} from "@/lib/rbac/permissionCatalog";

export const SUBSCRIPTION_MODULE_DENIED =
  "Access Denied. This module is not included in your organization's subscription package.";

/** Portal routes that are always allowed (not tied to platform_modules package rows). */
const PACKAGE_EXEMPT_PORTAL_KEYS = new Set(["organization_subscription"]);

/** Modules a school admin may assign to staff (from Super Admin package). */
export function filterPortalModulesByEntitlement(
  portalKeys: Set<string> | null,
  isSuperAdmin: boolean,
  isSchoolAdmin = false,
): typeof ALL_PORTAL_MODULES {
  if (isSuperAdmin || isSchoolAdmin || !portalKeys) return ALL_PORTAL_MODULES;
  return ALL_PORTAL_MODULES.filter((m) => portalKeys.has(m.key));
}

/** True when this path is controlled by a platform_modules → portal_module_key mapping. */
export function isPathGatedByPlatformPackage(
  path: string,
  licensablePortalKeys: Set<string> | null,
): boolean {
  if (!licensablePortalKeys?.size) return false;
  const mod = moduleByPath(path);
  if (!mod) return false;
  if (PACKAGE_EXEMPT_PORTAL_KEYS.has(mod.key)) return false;
  return licensablePortalKeys.has(mod.key);
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
