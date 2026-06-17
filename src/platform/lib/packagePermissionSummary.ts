export type { PlatformModuleRef } from "@/platform/lib/packagePortalPages";
import {
  buildPortalPermissionSummary,
  portalKeysFromPlatformModuleKeys,
  portalPageLabel,
  type PlatformModuleRef,
} from "@/platform/lib/packagePortalPages";
import {
  allPackageSidebarPortalKeys,
  buildSidebarPermissionSummary,
  sidebarLabelForPortalKey,
} from "@/platform/lib/packageSidebarMenu";

export type PackagePermissionItem = {
  moduleKey: string;
  label: string;
  path?: string;
  viewPermission?: string;
};

export type PackagePermissionGroup = {
  category: string;
  categoryLabel: string;
  items: PackagePermissionItem[];
};

/** Group selected sidebar items for summary display. */
export function buildPackagePermissionSummary(
  selectedModuleKeys: string[],
  platformModules: PlatformModuleRef[],
): PackagePermissionGroup[] {
  const portalKeys = portalKeysFromPlatformModuleKeys(selectedModuleKeys, platformModules);
  return buildSidebarPermissionSummary(portalKeys).map((group) => ({
    category: group.groupLabel,
    categoryLabel: group.groupLabel,
    items: group.items.map((item) => ({
      moduleKey: item.path,
      label: item.label,
      path: item.path,
    })),
  }));
}

/** Human-readable labels for plan cards on the subscription plans page. */
export function moduleLabelsForPlan(
  moduleKeys: string[],
  platformModules: PlatformModuleRef[],
): string[] {
  return moduleKeys.map((key) => portalPageLabel(key, platformModules));
}

/** Unique sidebar labels for a plan (dedupes legacy duplicate module keys). */
export function uniquePortalLabelsForPlan(
  moduleKeys: string[],
  platformModules: PlatformModuleRef[],
): string[] {
  const portalKeys = portalKeysFromPlatformModuleKeys(moduleKeys, platformModules);
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const key of portalKeys) {
    if (seen.has(key)) continue;
    seen.add(key);
    labels.push(sidebarLabelForPortalKey(key));
  }
  return labels;
}
