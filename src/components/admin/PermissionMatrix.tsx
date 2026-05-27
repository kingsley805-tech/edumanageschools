import { useMemo } from "react";
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
import { cn } from "@/lib/utils";

type Props = {
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  search: string;
  onSearchChange: (value: string) => void;
  readOnly?: boolean;
  onFullAccess?: () => void;
  onRevokeFullAccess?: () => void;
};

export function PermissionMatrix({
  selected,
  onChange,
  search,
  onSearchChange,
  readOnly = false,
  onFullAccess,
  onRevokeFullAccess,
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

  const allVisibleCodes = useMemo(
    () => modules.flatMap((m) => modulePermissionCodes(m)),
    [modules],
  );

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
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {onFullAccess && (
            <Button
              type="button"
              size="sm"
              disabled={readOnly || !modules.length}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={onFullAccess}
            >
              Full Access
            </Button>
          )}
          {onRevokeFullAccess && (
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={readOnly || !modules.length}
              onClick={onRevokeFullAccess}
            >
              Revoke Full Access
            </Button>
          )}
        </div>
        <Input
          placeholder="Search modules…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="max-w-xs bg-background"
        />
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] border-collapse text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="sticky left-0 z-10 min-w-[180px] border-r bg-muted/50 px-4 py-3 text-left font-semibold">
                  Module
                </th>
                {MATRIX_COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    className="min-w-[72px] px-2 py-3 text-center font-medium text-muted-foreground whitespace-nowrap"
                  >
                    {col.label}
                  </th>
                ))}
                <th className="min-w-[140px] px-3 py-3 text-center font-medium text-muted-foreground">
                  Bulk
                </th>
              </tr>
            </thead>
            <tbody>
              {modules.map((mod) => {
                return (
                  <tr key={mod.key} className="border-b last:border-b-0 hover:bg-muted/20">
                    <td className="sticky left-0 z-10 border-r bg-card px-4 py-2.5 font-medium">
                      {mod.label}
                    </td>
                    {MATRIX_COLUMNS.map((col) => {
                      const code = matrixColumnPermissionCode(mod, col.key);
                      const checked = isChecked(mod, col.key);
                      const na = !code;
                      return (
                        <td key={col.key} className="px-2 py-2.5 text-center">
                          {na ? (
                            <span className="text-muted-foreground/30">—</span>
                          ) : (
                            <Checkbox
                              checked={checked}
                              disabled={readOnly}
                              className="mx-auto data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                              onCheckedChange={(v) => toggle(code, v === true)}
                            />
                          )}
                        </td>
                      );
                    })}
                    <td className="px-2 py-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          disabled={readOnly || !modulePermissionCodes(mod).length}
                          onClick={() => setModuleCodes(mod, true)}
                        >
                          Select All
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          disabled={readOnly || !modulePermissionCodes(mod).length}
                          onClick={() => setModuleCodes(mod, false)}
                        >
                          Clear
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {modules.length === 0 && (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No modules match your search.
          </p>
        )}
      </div>

      <p className={cn("text-xs text-muted-foreground", allVisibleCodes.length === 0 && "hidden")}>
        {selected.size} permission{selected.size === 1 ? "" : "s"} selected
        {q ? ` · showing ${modules.length} module${modules.length === 1 ? "" : "s"}` : ""}
      </p>
    </div>
  );
}
