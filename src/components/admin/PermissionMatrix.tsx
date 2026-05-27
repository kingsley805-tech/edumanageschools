import { useMemo } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  PORTAL_CATEGORIES,
  ACTION_LABELS,
  permissionCode,
  type PermissionAction,
} from "@/lib/rbac/permissionCatalog";
import { cn } from "@/lib/utils";

type Props = {
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  search: string;
  categoryFilter: string;
  readOnly?: boolean;
};

export function PermissionMatrix({
  selected,
  onChange,
  search,
  categoryFilter,
  readOnly = false,
}: Props) {
  const q = search.trim().toLowerCase();

  const filteredCategories = useMemo(() => {
    return PORTAL_CATEGORIES.filter((cat) => {
      if (categoryFilter !== "all" && cat.key !== categoryFilter) return false;
      if (!q) return true;
      if (cat.label.toLowerCase().includes(q)) return true;
      return cat.modules.some(
        (m) =>
          m.label.toLowerCase().includes(q) ||
          m.actions.some((a) => ACTION_LABELS[a].toLowerCase().includes(q)),
      );
    }).map((cat) => ({
      ...cat,
      modules: cat.modules.filter((m) => {
        if (!q) return true;
        if (m.label.toLowerCase().includes(q)) return true;
        return m.actions.some((a) => ACTION_LABELS[a].toLowerCase().includes(q));
      }),
    }));
  }, [q, categoryFilter]);

  const allVisibleCodes = useMemo(() => {
    const codes: string[] = [];
    for (const cat of filteredCategories) {
      for (const mod of cat.modules) {
        for (const action of mod.actions) {
          codes.push(permissionCode(mod.key, action));
        }
      }
    }
    return codes;
  }, [filteredCategories]);

  const toggle = (code: string, checked: boolean) => {
    if (readOnly) return;
    const next = new Set(selected);
    if (checked) next.add(code);
    else next.delete(code);
    onChange(next);
  };

  const setMany = (codes: string[], checked: boolean) => {
    if (readOnly) return;
    const next = new Set(selected);
    for (const code of codes) {
      if (checked) next.add(code);
      else next.delete(code);
    }
    onChange(next);
  };

  const categoryCodes = (catKey: string) => {
    const cat = filteredCategories.find((c) => c.key === catKey);
    if (!cat) return [];
    return cat.modules.flatMap((m) => m.actions.map((a) => permissionCode(m.key, a)));
  };

  const allSelected =
    allVisibleCodes.length > 0 && allVisibleCodes.every((c) => selected.has(c));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-3">
        <span className="text-sm font-medium">Global</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={readOnly || !allVisibleCodes.length}
          onClick={() => setMany(allVisibleCodes, !allSelected)}
        >
          {allSelected ? "Clear all visible" : "Select all visible"}
        </Button>
        <Badge variant="secondary">{selected.size} selected</Badge>
      </div>

      {filteredCategories.map((cat) => {
        const codes = categoryCodes(cat.key);
        const catAll = codes.length > 0 && codes.every((c) => selected.has(c));
        return (
          <div key={cat.key} className="rounded-lg border overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 bg-muted/40 px-4 py-3">
              <h3 className="font-semibold">{cat.label}</h3>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={readOnly || !codes.length}
                onClick={() => setMany(codes, !catAll)}
              >
                {catAll ? "Clear category" : "Select all in category"}
              </Button>
            </div>
            <div className="divide-y">
              {cat.modules.map((mod) => (
                <div key={mod.key} className="px-4 py-3">
                  <p className="mb-2 text-sm font-medium text-foreground">{mod.label}</p>
                  <div className="flex flex-wrap gap-3">
                    {mod.actions.map((action) => {
                      const code = permissionCode(mod.key, action as PermissionAction);
                      const checked = selected.has(code);
                      return (
                        <label
                          key={code}
                          className={cn(
                            "flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors",
                            checked && "border-primary/50 bg-primary/5",
                            readOnly && "opacity-70 cursor-not-allowed",
                          )}
                        >
                          <Checkbox
                            checked={checked}
                            disabled={readOnly}
                            onCheckedChange={(v) => toggle(code, v === true)}
                          />
                          {ACTION_LABELS[action]}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {filteredCategories.length === 0 && (
        <p className="text-sm text-muted-foreground py-8 text-center">
          No permissions match your search.
        </p>
      )}
    </div>
  );
}
