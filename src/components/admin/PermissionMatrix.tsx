import { useMemo, type ReactNode } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ALL_PORTAL_MODULES } from "@/lib/rbac/permissionCatalog";
import type { PortalModuleDef } from "@/lib/rbac/permissionCatalog";
import {
  MATRIX_COLUMNS,
  matrixColumnPermissionCode,
  modulePermissionCodes,
  type MatrixColumnKey,
} from "@/lib/rbac/matrixColumns";

type Props = {
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  search: string;
  onSearchChange: (value: string) => void;
  readOnly?: boolean;
  onFullAccess?: () => void;
  onRevokeFullAccess?: () => void;
  /** Role dropdown — rendered inline after "Role" label */
  roleControl: ReactNode;
  /** Optional save / status row below title (outside this card) */
};

const checkboxClass =
  "h-4 w-4 rounded-[3px] border-2 border-muted-foreground/50 bg-background shadow-none " +
  "data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600 data-[state=checked]:text-white";

export function PermissionMatrix({
  selected,
  onChange,
  search,
  onSearchChange,
  readOnly = false,
  onFullAccess,
  onRevokeFullAccess,
  roleControl,
}: Props) {
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

  const toggle = (code: string | null, checked: boolean) => {
    if (readOnly || !code) return;
    const next = new Set(selected);
    if (checked) next.add(code);
    else next.delete(code);
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
    <div className="rounded-xl border border-border/80 bg-card/95 shadow-sm overflow-hidden">
      {/* Toolbar — Role + Full Access + Revoke + Search (exact reference layout) */}
      <div className="flex flex-col gap-3 border-b border-border/80 bg-muted/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-foreground shrink-0">Role</span>
          {roleControl}
          {onFullAccess && (
            <Button
              type="button"
              size="sm"
              disabled={readOnly || !modules.length}
              className="h-8 rounded-md bg-emerald-600 px-3 text-white hover:bg-emerald-700 border-0 shadow-none"
              onClick={onFullAccess}
            >
              Full Access
            </Button>
          )}
          {onRevokeFullAccess && (
            <Button
              type="button"
              size="sm"
              disabled={readOnly || !modules.length}
              className="h-8 rounded-md bg-red-600 px-3 text-white hover:bg-red-700 border-0 shadow-none"
              onClick={onRevokeFullAccess}
            >
              Revoke Full Access
            </Button>
          )}
        </div>
        <Input
          placeholder="Search modules..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-9 w-full sm:w-56 shrink-0 bg-background/80 border-border/80"
        />
      </div>

      {/* Matrix table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1020px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border/80 bg-muted/30">
              <th className="sticky left-0 z-10 min-w-[160px] border-r border-border/80 bg-muted/30 px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Module
              </th>
              {MATRIX_COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className="min-w-[76px] px-1 py-2.5 text-center text-xs font-medium text-muted-foreground whitespace-nowrap"
                >
                  {col.label}
                </th>
              ))}
              <th className="min-w-[148px] px-2 py-2.5 text-center text-xs font-medium text-muted-foreground">
                Bulk
              </th>
            </tr>
          </thead>
          <tbody>
            {modules.map((mod) => (
              <tr
                key={mod.key}
                className="border-b border-border/60 last:border-b-0 hover:bg-muted/10"
              >
                <td className="sticky left-0 z-10 border-r border-border/60 bg-card/95 px-4 py-2 text-sm font-medium text-foreground">
                  {mod.label}
                </td>
                {MATRIX_COLUMNS.map((col) => {
                  const code = matrixColumnPermissionCode(mod, col.key);
                  const checked = isChecked(mod, col.key);
                  const disabled = readOnly || !code;
                  return (
                    <td key={col.key} className="px-1 py-2 text-center align-middle">
                      <Checkbox
                        checked={code ? checked : false}
                        disabled={disabled}
                        className={checkboxClass}
                        onCheckedChange={(v) => toggle(code, v === true)}
                      />
                    </td>
                  );
                })}
                <td className="px-2 py-1.5 text-center align-middle">
                  <div className="flex items-center justify-center gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 rounded-md border-border/80 bg-background/50 px-2.5 text-xs font-normal"
                      disabled={readOnly || !modulePermissionCodes(mod).length}
                      onClick={() => setModuleCodes(mod, true)}
                    >
                      Select All
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 rounded-md border-border/80 bg-background/50 px-2.5 text-xs font-normal"
                      disabled={readOnly || !modulePermissionCodes(mod).length}
                      onClick={() => setModuleCodes(mod, false)}
                    >
                      Clear
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {modules.length === 0 && (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No modules match your search.
          </p>
        )}
      </div>
    </div>
  );
}
