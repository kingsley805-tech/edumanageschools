import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { categoryLabel } from "@/platform/lib/moduleCategories";
import type { ModuleEntitlementRow } from "@/platform/lib/types";

type Props = {
  rows: ModuleEntitlementRow[];
  onChange: (rows: ModuleEntitlementRow[]) => void;
  readOnly?: boolean;
  /** On/off modules only — hides CRUD columns (default for platform UX). */
  simple?: boolean;
};

export default function FeaturePermissionMatrix({
  rows,
  onChange,
  readOnly,
  simple = false,
}: Props) {
  const byCategory = rows.reduce<Record<string, ModuleEntitlementRow[]>>((acc, row) => {
    (acc[row.category] ??= []).push(row);
    return acc;
  }, {});

  const updateRow = (moduleKey: string, patch: Partial<ModuleEntitlementRow>) => {
    onChange(
      rows.map((r) => {
        if (r.module_key !== moduleKey) return r;
        const next = { ...r, ...patch };
        if (patch.enabled === true) {
          next.can_read = true;
          if (simple) {
            next.can_create = true;
            next.can_edit = true;
            next.can_delete = true;
            next.can_export = true;
          }
        }
        if (patch.enabled === false) {
          next.can_read = false;
          next.can_create = false;
          next.can_edit = false;
          next.can_delete = false;
          next.can_export = false;
        }
        return next;
      }),
    );
  };

  return (
    <div className="space-y-6">
      {Object.entries(byCategory).map(([cat, catRows]) => (
        <div key={cat}>
          <h3 className="mb-3 text-sm font-semibold text-foreground">{categoryLabel(cat)}</h3>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]">Module</TableHead>
                  <TableHead className="w-[100px]">Enabled</TableHead>
                  {!simple ? (
                    <>
                      <TableHead>Read</TableHead>
                      <TableHead>Create</TableHead>
                      <TableHead>Edit</TableHead>
                      <TableHead>Delete</TableHead>
                      <TableHead>Export</TableHead>
                    </>
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {catRows.map((row) => (
                  <TableRow key={row.module_key}>
                    <TableCell className="font-medium">{row.label}</TableCell>
                    <TableCell>
                      <Switch
                        checked={row.enabled}
                        disabled={readOnly}
                        onCheckedChange={(v) => updateRow(row.module_key, { enabled: v })}
                      />
                    </TableCell>
                    {!simple
                      ? (
                          [
                            "can_read",
                            "can_create",
                            "can_edit",
                            "can_delete",
                            "can_export",
                          ] as const
                        ).map((field) => (
                          <TableCell key={field}>
                            <Checkbox
                              checked={row[field]}
                              disabled={readOnly || !row.enabled}
                              onCheckedChange={(v) =>
                                updateRow(row.module_key, { [field]: Boolean(v) })
                              }
                            />
                          </TableCell>
                        ))
                      : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ))}
    </div>
  );
}
