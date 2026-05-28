import { ALL_PORTAL_MODULES, viewPermissionForPath } from "@/lib/rbac/permissionCatalog";

/** Admin shell routes: path pattern → minimum view permission */
const ADMIN_ROUTE_PERMISSIONS: Record<string, string> = {};

for (const mod of ALL_PORTAL_MODULES) {
  if (!mod.path.startsWith("/admin") && mod.path !== "/settings") continue;
  ADMIN_ROUTE_PERMISSIONS[mod.path] = viewPermissionForPath(mod.path) ?? `portal.${mod.key}.view`;
}

/** Longest-prefix match for nested routes */
export function requiredViewPermissionForPath(pathname: string): string | null {
  const path = pathname.replace(/\/$/, "") || "/admin";
  if (ADMIN_ROUTE_PERMISSIONS[path]) return ADMIN_ROUTE_PERMISSIONS[path];

  let best: string | null = null;
  let bestLen = 0;
  for (const [route, perm] of Object.entries(ADMIN_ROUTE_PERMISSIONS)) {
    if (route === "/admin") continue;
    if (path === route || path.startsWith(route + "/")) {
      if (route.length > bestLen) {
        bestLen = route.length;
        best = perm;
      }
    }
  }
  if (path === "/admin") return ADMIN_ROUTE_PERMISSIONS["/admin"] ?? "portal.dashboard.view";
  return best;
}

export const ADMIN_SHELL_ROLES = ["admin", "super_admin", "accountant", "auditor"] as const;
