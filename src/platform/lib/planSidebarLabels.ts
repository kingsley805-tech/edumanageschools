import { ALL_PORTAL_MODULES } from "@/lib/rbac/permissionCatalog";
import {
  portalKeysFromPlatformModuleKeys,
  type PlatformModuleRef,
} from "@/platform/lib/packagePortalPages";
import { sidebarLabelForPortalKey } from "@/platform/lib/packageSidebarMenu";

export type PlanSidebarListItem = {
  key: string;
  label: string;
  path?: string;
};

function pathForPortalKey(portalKey: string): string | undefined {
  return ALL_PORTAL_MODULES.find((m) => m.key === portalKey)?.path;
}

/** Unique sidebar list items for plan cards (stable React keys, disambiguates duplicate labels). */
export function sidebarItemsFromPlanModules(
  moduleKeys: string[] | undefined | null,
  platformModules: PlatformModuleRef[] = [],
): PlanSidebarListItem[] {
  if (!moduleKeys?.length) return [];

  const portalKeys = portalKeysFromPlatformModuleKeys(moduleKeys, platformModules);
  const seen = new Set<string>();
  const items: PlanSidebarListItem[] = [];

  for (const key of portalKeys) {
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({
      key,
      label: sidebarLabelForPortalKey(key),
      path: pathForPortalKey(key),
    });
  }

  const labelCounts = new Map<string, number>();
  for (const item of items) {
    labelCounts.set(item.label, (labelCounts.get(item.label) ?? 0) + 1);
  }

  return items.map((item) => {
    if ((labelCounts.get(item.label) ?? 0) <= 1 || !item.path) return item;
    return { ...item, label: `${item.label} (${item.path})` };
  });
}

/** Sidebar menu labels for a plan's stored module keys (no DB catalog required). */
export function sidebarLabelsFromPlanModules(moduleKeys: string[] | undefined | null): string[] {
  return sidebarItemsFromPlanModules(moduleKeys).map((item) => item.label);
}
