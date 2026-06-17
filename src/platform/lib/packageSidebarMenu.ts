import type { LucideIcon } from "lucide-react";
import {
  buildAdminNav,
  ensureClassTeacherActivityInNav,
  ensurePaymentGatewaysInNav,
  type AdminNavGroup,
  type AdminNavItem,
} from "@/lib/rbac/adminNavConfig";
import { moduleByPath, parsePermissionCode } from "@/lib/rbac/permissionCatalog";
import {
  PACKAGE_EXEMPT_PORTAL_KEYS,
} from "@/platform/lib/packagePortalPages";

export type PackageSidebarItem = {
  portalKey: string;
  label: string;
  path: string;
  viewPermission: string;
  icon: LucideIcon;
};

export type PackageSidebarGroup = {
  label: string;
  icon: LucideIcon;
  items: PackageSidebarItem[];
};

function portalKeyFromNavItem(item: AdminNavItem): string | null {
  const parsed = parsePermissionCode(item.viewPermission);
  if (parsed && !PACKAGE_EXEMPT_PORTAL_KEYS.has(parsed.moduleKey)) {
    return parsed.moduleKey;
  }
  const mod = moduleByPath(item.path);
  if (mod && !PACKAGE_EXEMPT_PORTAL_KEYS.has(mod.key)) {
    return mod.key;
  }
  return null;
}

function mapNavItem(item: AdminNavItem): PackageSidebarItem | null {
  const portalKey = portalKeyFromNavItem(item);
  if (!portalKey) return null;
  return {
    portalKey,
    label: item.label,
    path: item.path,
    viewPermission: item.viewPermission,
    icon: item.icon,
  };
}

/** Same structure as the school admin sidebar — all items selectable for Super Admin plans. */
export function buildPackageSidebarMenu(): {
  standalone: PackageSidebarItem[];
  groups: PackageSidebarGroup[];
} {
  let nav = buildAdminNav(() => true);
  nav = ensurePaymentGatewaysInNav(nav);
  nav = ensureClassTeacherActivityInNav(nav);

  const standalone: PackageSidebarItem[] = [];
  const groups: PackageSidebarGroup[] = [];

  for (const entry of nav) {
    if (!("items" in entry)) {
      const mapped = mapNavItem(entry as AdminNavItem);
      if (mapped) standalone.push(mapped);
      continue;
    }

    const group = entry as AdminNavGroup;
    const items = group.items
      .map(mapNavItem)
      .filter((item): item is PackageSidebarItem => item != null);

    if (items.length > 0) {
      groups.push({
        label: group.label,
        icon: group.icon,
        items,
      });
    }
  }

  return { standalone, groups };
}

export function allPackageSidebarPortalKeys(): string[] {
  const { standalone, groups } = buildPackageSidebarMenu();
  const keys = new Set<string>();
  for (const item of standalone) keys.add(item.portalKey);
  for (const group of groups) {
    for (const item of group.items) keys.add(item.portalKey);
  }
  return [...keys];
}

export function buildSidebarPermissionSummary(
  selectedPortalKeys: string[],
): { groupLabel: string; items: { label: string; path: string }[] }[] {
  const selected = new Set(selectedPortalKeys);
  const { standalone, groups } = buildPackageSidebarMenu();
  const result: { groupLabel: string; items: { label: string; path: string }[] }[] = [];

  const standaloneSelected = standalone.filter((i) => selected.has(i.portalKey));
  if (standaloneSelected.length > 0) {
    result.push({
      groupLabel: "Dashboard",
      items: standaloneSelected.map((i) => ({ label: i.label, path: i.path })),
    });
  }

  for (const group of groups) {
    const items = group.items.filter((i) => selected.has(i.portalKey));
    if (items.length > 0) {
      result.push({
        groupLabel: group.label,
        items: items.map((i) => ({ label: i.label, path: i.path })),
      });
    }
  }

  return result;
}

export function sidebarLabelForPortalKey(portalKey: string): string {
  const { standalone, groups } = buildPackageSidebarMenu();
  for (const item of standalone) {
    if (item.portalKey === portalKey) return item.label;
  }
  for (const group of groups) {
    const item = group.items.find((i) => i.portalKey === portalKey);
    if (item) return item.label;
  }
  return portalKey.replace(/_/g, " ");
}
