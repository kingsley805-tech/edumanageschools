import type { PermissionAction, PortalModuleDef } from "@/lib/rbac/permissionCatalog";
import { permissionCode } from "@/lib/rbac/permissionCatalog";

/** Matrix columns matching the Roles & Permissions grid layout. */
export const MATRIX_COLUMNS = [
  { key: "view" as const, label: "View" },
  { key: "create" as const, label: "Create" },
  { key: "edit" as const, label: "Edit" },
  { key: "update" as const, label: "Update" },
  { key: "delete" as const, label: "Delete" },
  { key: "manage" as const, label: "Manage" },
  { key: "approve" as const, label: "Approve" },
  { key: "export" as const, label: "Export" },
  { key: "access_settings" as const, label: "Access Settings" },
] as const;

export type MatrixColumnKey = (typeof MATRIX_COLUMNS)[number]["key"];

const SETTINGS_MODULE_KEYS = new Set([
  "school_settings",
  "report_settings",
  "staff_access",
  "account_settings",
]);

/** Resolve a matrix column to a permission action for this module (null = N/A). */
export function matrixColumnAction(
  mod: PortalModuleDef,
  column: MatrixColumnKey,
): PermissionAction | null {
  switch (column) {
    case "view":
      return mod.actions.includes("view") ? "view" : null;
    case "create":
      return mod.actions.includes("create") ? "create" : null;
    case "edit":
      return mod.actions.includes("edit") ? "edit" : null;
    case "update":
      return mod.actions.includes("edit") ? "edit" : null;
    case "delete":
      return mod.actions.includes("delete") ? "delete" : null;
    case "manage":
      return mod.actions.includes("manage") ? "manage" : null;
    case "approve":
      return mod.actions.includes("approve") ? "approve" : null;
    case "export":
      return mod.actions.includes("export") ? "export" : null;
    case "access_settings":
      if (!SETTINGS_MODULE_KEYS.has(mod.key)) return null;
      if (mod.actions.includes("manage")) return "manage";
      if (mod.actions.includes("edit")) return "edit";
      return null;
    default:
      return null;
  }
}

export function matrixColumnPermissionCode(
  mod: PortalModuleDef,
  column: MatrixColumnKey,
): string | null {
  const action = matrixColumnAction(mod, column);
  if (!action) return null;
  return permissionCode(mod.key, action);
}

/** All distinct permission codes for a module row (edit/update share one code). */
export function modulePermissionCodes(mod: PortalModuleDef): string[] {
  const codes = new Set<string>();
  for (const col of MATRIX_COLUMNS) {
    const code = matrixColumnPermissionCode(mod, col.key);
    if (code) codes.add(code);
  }
  return [...codes];
}
