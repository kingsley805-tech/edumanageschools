import {
  ALL_PORTAL_MODULES,
  PORTAL_CATEGORIES,
  permissionCode,
  type PortalModuleDef,
} from "@/lib/rbac/permissionCatalog";

export type PlatformModuleRef = {
  module_key: string;
  category: string;
  label: string;
  portal_module_key?: string | null;
};

/** Always available — not selectable in subscription packages. */
export const PACKAGE_EXEMPT_PORTAL_KEYS = new Set([
  "organization_subscription",
  "account_settings",
]);

export type PackagePortalPage = {
  portalKey: string;
  label: string;
  path: string;
  categoryKey: string;
  categoryLabel: string;
  platformModuleKey: string;
  viewPermission: string;
};

export type PackagePortalCategory = {
  categoryKey: string;
  categoryLabel: string;
  pages: PackagePortalPage[];
};

function portalDef(portalKey: string): PortalModuleDef | undefined {
  return ALL_PORTAL_MODULES.find((m) => m.key === portalKey);
}

/** Pick one platform_modules row per portal page (for default_modules storage). */
export function resolvePlatformModuleKey(
  portalKey: string,
  platformModules: PlatformModuleRef[],
): string {
  const exact = platformModules.find((m) => m.module_key === portalKey);
  if (exact) return exact.module_key;

  const mapped = platformModules.filter((m) => m.portal_module_key === portalKey);
  if (mapped.length === 0) return portalKey;

  const preferred = mapped.find((m) => m.module_key === portalKey);
  if (preferred) return preferred.module_key;

  return mapped[0]!.module_key;
}

/** Map stored platform module keys → portal permission page keys. */
export function portalKeysFromPlatformModuleKeys(
  moduleKeys: string[],
  platformModules: PlatformModuleRef[],
): string[] {
  const moduleMap = new Map(platformModules.map((m) => [m.module_key, m]));
  const keys = new Set<string>();

  for (const moduleKey of moduleKeys) {
    const row = moduleMap.get(moduleKey);
    if (row?.portal_module_key) {
      keys.add(row.portal_module_key);
      continue;
    }
    if (portalDef(moduleKey)) keys.add(moduleKey);
  }

  return [...keys];
}

/** Map selected portal pages → platform module keys saved on subscription_plans.default_modules. */
export function platformModuleKeysFromPortalKeys(
  portalKeys: string[],
  platformModules: PlatformModuleRef[],
): string[] {
  const keys = new Set<string>();
  for (const portalKey of portalKeys) {
    keys.add(resolvePlatformModuleKey(portalKey, platformModules));
  }
  return [...keys];
}

/** Build selectable portal pages grouped by RBAC permission catalog. */
export function buildPackagePortalCategories(
  platformModules: PlatformModuleRef[],
): PackagePortalCategory[] {
  return PORTAL_CATEGORIES.map((cat) => ({
    categoryKey: cat.key,
    categoryLabel: cat.label,
    pages: cat.modules
      .filter((mod) => !PACKAGE_EXEMPT_PORTAL_KEYS.has(mod.key))
      .map((mod) => ({
        portalKey: mod.key,
        label: mod.label,
        path: mod.path,
        categoryKey: cat.key,
        categoryLabel: cat.label,
        platformModuleKey: resolvePlatformModuleKey(mod.key, platformModules),
        viewPermission: permissionCode(mod.key, "view"),
      })),
  })).filter((cat) => cat.pages.length > 0);
}

export function allPackagePortalPages(platformModules: PlatformModuleRef[]): PackagePortalPage[] {
  return buildPackagePortalCategories(platformModules).flatMap((c) => c.pages);
}

export function buildPortalPermissionSummary(
  selectedPortalKeys: string[],
): { categoryLabel: string; items: { label: string; path: string; viewPermission: string }[] }[] {
  const selected = new Set(selectedPortalKeys);
  return PORTAL_CATEGORIES.map((cat) => ({
    categoryLabel: cat.label,
    items: cat.modules
      .filter((m) => selected.has(m.key))
      .map((m) => ({
        label: m.label,
        path: m.path,
        viewPermission: permissionCode(m.key, "view"),
      })),
  })).filter((g) => g.items.length > 0);
}

export function portalPageLabel(
  moduleKey: string,
  platformModules: PlatformModuleRef[],
): string {
  const portalKey = portalKeysFromPlatformModuleKeys([moduleKey], platformModules)[0];
  if (portalKey) return portalDef(portalKey)?.label ?? moduleKey.replace(/_/g, " ");
  return moduleKey.replace(/_/g, " ");
}
