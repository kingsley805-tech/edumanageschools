import { portalKeysFromPlatformModuleKeys } from "@/platform/lib/packagePortalPages";
import { sidebarLabelForPortalKey } from "@/platform/lib/packageSidebarMenu";

/** Sidebar menu labels for a plan's stored module keys (no DB catalog required). */
export function sidebarLabelsFromPlanModules(moduleKeys: string[] | undefined | null): string[] {
  if (!moduleKeys?.length) return [];
  const portalKeys = portalKeysFromPlatformModuleKeys(moduleKeys, []);
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const key of portalKeys) {
    if (seen.has(key)) continue;
    seen.add(key);
    labels.push(sidebarLabelForPortalKey(key));
  }
  return labels;
}
