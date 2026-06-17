import { ALL_PORTAL_MODULES } from "@/lib/rbac/permissionCatalog";
import { categoryLabel } from "@/platform/lib/moduleCategories";

export type PlatformModuleRef = {
  module_key: string;
  category: string;
  label: string;
  portal_module_key?: string | null;
};

export type PackagePermissionItem = {
  moduleKey: string;
  label: string;
  portalPage?: string;
};

export type PackagePermissionGroup = {
  category: string;
  categoryLabel: string;
  items: PackagePermissionItem[];
};

const portalPageByKey = new Map(ALL_PORTAL_MODULES.map((m) => [m.key, m.label]));

/** Resolve portal page label from platform module portal_module_key. */
export function portalPageLabel(portalModuleKey: string | null | undefined): string | undefined {
  if (!portalModuleKey) return undefined;
  return portalPageByKey.get(portalModuleKey);
}

/** Group selected package modules for summary display before save. */
export function buildPackagePermissionSummary(
  selectedKeys: string[],
  modules: PlatformModuleRef[],
): PackagePermissionGroup[] {
  const moduleMap = new Map(modules.map((m) => [m.module_key, m]));
  const groups = new Map<string, PackagePermissionItem[]>();

  for (const key of selectedKeys) {
    const mod = moduleMap.get(key);
    if (!mod) continue;
    const cat = mod.category;
    const items = groups.get(cat) ?? [];
    items.push({
      moduleKey: mod.module_key,
      label: mod.label,
      portalPage: portalPageLabel(mod.portal_module_key),
    });
    groups.set(cat, items);
  }

  return [...groups.entries()]
    .map(([category, items]) => ({
      category,
      categoryLabel: categoryLabel(category),
      items: items.sort((a, b) => a.label.localeCompare(b.label)),
    }))
    .sort((a, b) => a.categoryLabel.localeCompare(b.categoryLabel));
}

/** Human-readable labels for plan cards on the subscription plans page. */
export function moduleLabelsForPlan(
  moduleKeys: string[],
  modules: PlatformModuleRef[],
): string[] {
  const moduleMap = new Map(modules.map((m) => [m.module_key, m]));
  return moduleKeys.map((key) => {
    const mod = moduleMap.get(key);
    if (!mod) return key.replace(/_/g, " ");
    const page = portalPageLabel(mod.portal_module_key);
    return page && page !== mod.label ? `${mod.label} (${page})` : mod.label;
  });
}
