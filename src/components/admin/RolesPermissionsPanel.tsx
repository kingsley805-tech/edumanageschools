import { useMemo, type ReactNode } from "react";
import { Check } from "lucide-react";
import { ALL_PORTAL_MODULES } from "@/lib/rbac/permissionCatalog";
import type { PortalModuleDef } from "@/lib/rbac/permissionCatalog";
import {
  MATRIX_COLUMNS,
  matrixColumnPermissionCode,
  modulePermissionCodes,
  type MatrixColumnKey,
} from "@/lib/rbac/matrixColumns";
import { cn } from "@/lib/utils";
import "./roles-permissions.css";

export type RolesPermissionsPanelProps = {
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  search: string;
  onSearchChange: (value: string) => void;
  controlLabel?: string;
  readOnly?: boolean;
  onFullAccess?: () => void;
  onRevokeFullAccess?: () => void;
  roleControl: ReactNode;
  dirty?: boolean;
  saving?: boolean;
  onSave?: () => void;
};

function MatrixCheckbox({
  checked,
  disabled,
  onToggle,
}: {
  checked: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={checked}
      className={cn("rp-checkbox", checked && "is-checked")}
      onClick={onToggle}
    >
      {checked ? <Check strokeWidth={3} /> : null}
    </button>
  );
}

export function RolesPermissionsPanel({
  selected,
  onChange,
  search,
  onSearchChange,
  controlLabel = "Role",
  readOnly = false,
  onFullAccess,
  onRevokeFullAccess,
  roleControl,
  dirty,
  saving,
  onSave,
}: RolesPermissionsPanelProps) {
  const q = search.trim().toLowerCase();

  const modules = useMemo(() => {
    if (!q) return ALL_PORTAL_MODULES;
    return ALL_PORTAL_MODULES.filter(
      (m) =>
        m.label.toLowerCase().includes(q) ||
        m.categoryLabel.toLowerCase().includes(q) ||
        m.key.toLowerCase().includes(q),
    );
  }, [q]);

  const toggle = (code: string | null) => {
    if (readOnly || !code) return;
    const next = new Set(selected);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    onChange(next);
  };

  const setModuleCodes = (mod: PortalModuleDef, checked: boolean) => {
    if (readOnly) return;
    const next = new Set(selected);
    for (const code of modulePermissionCodes(mod)) {
      if (checked) next.add(code);
      else next.delete(code);
    }
    onChange(next);
  };

  const isChecked = (mod: PortalModuleDef, column: MatrixColumnKey) => {
    const code = matrixColumnPermissionCode(mod, column);
    return code ? selected.has(code) : false;
  };

  return (
    <div className="rp-page">
      <h1 className="rp-title">Roles &amp; Permissions</h1>
      <p className="rp-subtitle">
        Configure module-level access with dynamic permission matrix, select-all controls, and
        audit logging.
      </p>

      {/* Panel 1: control bar (separate rounded box) */}
      <div className="rp-control-panel">
        <div className="rp-control-left">
          <span className="rp-role-label">{controlLabel}</span>
          {roleControl}
          {onFullAccess && (
            <button
              type="button"
              className="rp-btn-full"
              disabled={readOnly || !modules.length}
              onClick={onFullAccess}
            >
              Full Access
            </button>
          )}
          {onRevokeFullAccess && (
            <button
              type="button"
              className="rp-btn-revoke"
              disabled={readOnly || !modules.length}
              onClick={onRevokeFullAccess}
            >
              Revoke Full Access
            </button>
          )}
          {dirty && onSave && !readOnly && (
            <button type="button" className="rp-save-link" disabled={saving} onClick={onSave}>
              {saving ? "Saving…" : "Save changes"}
            </button>
          )}
        </div>
        <input
          type="search"
          className="rp-search"
          placeholder="Search modules..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      {/* Panel 2: matrix table (separate rounded box) */}
      <div className="rp-table-panel">
        <div className="rp-table-wrap">
          <table className="rp-table">
            <thead>
              <tr>
                <th className="rp-th-module">Module</th>
                {MATRIX_COLUMNS.map((col) => (
                  <th key={col.key}>{col.label}</th>
                ))}
                <th>Bulk</th>
              </tr>
            </thead>
            <tbody>
              {modules.map((mod) => (
                <tr key={mod.key}>
                  <td className="rp-td-module">{mod.label}</td>
                  {MATRIX_COLUMNS.map((col) => {
                    const code = matrixColumnPermissionCode(mod, col.key);
                    const checked = isChecked(mod, col.key);
                    return (
                      <td key={col.key} className="rp-td-check">
                        <MatrixCheckbox
                          checked={!!code && checked}
                          disabled={readOnly || !code}
                          onToggle={() => toggle(code)}
                        />
                      </td>
                    );
                  })}
                  <td>
                    <div className="rp-bulk-cell">
                      <button
                        type="button"
                        className="rp-bulk-btn"
                        disabled={readOnly || !modulePermissionCodes(mod).length}
                        onClick={() => setModuleCodes(mod, true)}
                      >
                        Select All
                      </button>
                      <button
                        type="button"
                        className="rp-bulk-btn"
                        disabled={readOnly || !modulePermissionCodes(mod).length}
                        onClick={() => setModuleCodes(mod, false)}
                      >
                        Clear
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {modules.length === 0 && (
            <p className="py-12 text-center text-sm" style={{ color: "var(--rp-muted)" }}>
              No modules match your search.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
