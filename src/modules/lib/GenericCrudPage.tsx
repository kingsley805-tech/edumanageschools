import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Archive, Pencil, Plus, RefreshCw, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { OperationsSchemaSetupCard } from "@/modules/lib/OperationsSchemaSetupCard";
import { ModuleAccessDenied } from "@/modules/lib/ModuleAccessDenied";
import { useModuleAccess } from "@/modules/lib/useModuleAccess";
import { useSchoolInfo } from "@/hooks/useSchoolInfo";
import { useAuth } from "@/contexts/AuthContext";
import { downloadCsv } from "@/modules/lib/exportCsv";
import { isMissingTableError } from "@/modules/lib/missingSchema";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type FieldDef = {
  key: string;
  label: string;
  type?: "text" | "number" | "date" | "datetime" | "textarea" | "select" | "checkbox";
  required?: boolean;
  options?: { value: string; label: string }[];
  list?: boolean;
  placeholder?: string;
};

type Props = {
  moduleKey: string;
  title: string;
  description: string;
  table: string;
  accentLabel: string;
  fields: FieldDef[];
  softDelete?: boolean;
  statusKey?: string;
  orderBy?: string;
  searchKeys?: string[];
  quickScript?: string;
  transformRow?: (row: Record<string, unknown>) => Record<string, unknown>;
  beforeSave?: (form: Record<string, unknown>) => Record<string, unknown>;
  extraActions?: (row: Record<string, unknown>, refresh: () => void) => ReactNode;
  restoreStatus?: string;
};

function emptyFromFields(fields: FieldDef[]) {
  const o: Record<string, unknown> = {};
  for (const f of fields) {
    if (f.type === "checkbox") o[f.key] = false;
    else if (f.type === "number") o[f.key] = "";
    else if (f.type === "select" && f.options?.[0]) o[f.key] = f.options[0].value;
    else if (f.type === "date") o[f.key] = new Date().toISOString().slice(0, 10);
    else o[f.key] = "";
  }
  return o;
}

export function GenericCrudPage({
  moduleKey,
  title,
  description,
  table,
  accentLabel,
  fields,
  softDelete = true,
  statusKey = "status",
  orderBy = "created_at",
  searchKeys,
  quickScript = "apply-wave-b-f-modules.sql",
  transformRow,
  beforeSave,
  extraActions,
  restoreStatus = "active",
}: Props) {
  const { user } = useAuth();
  const { currentSchool } = useSchoolInfo();
  const schoolId = currentSchool?.id ?? null;
  const access = useModuleAccess(moduleKey);

  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [schemaMissing, setSchemaMissing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>(emptyFromFields(fields));
  const [saving, setSaving] = useState(false);

  const listFields = fields.filter((f) => f.list !== false).slice(0, 5);
  const keysToSearch = searchKeys ?? fields.map((f) => f.key);

  const load = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .eq("school_id", schoolId)
        .order(orderBy, { ascending: false });
      if (error) {
        if (isMissingTableError(error)) {
          setSchemaMissing(true);
          setRows([]);
          return;
        }
        throw error;
      }
      setSchemaMissing(false);
      const mapped = (data ?? []).map((r) => (transformRow ? transformRow(r as Record<string, unknown>) : (r as Record<string, unknown>)));
      setRows(mapped);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [schoolId, table, orderBy, transformRow]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      const archived = Boolean(r.is_archived);
      if (!showArchived && archived) return false;
      if (showArchived && !archived) return false;
      if (!q) return true;
      return keysToSearch.some((k) => String(r[k] ?? "").toLowerCase().includes(q));
    });
  }, [rows, search, showArchived, keysToSearch]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyFromFields(fields));
    setOpen(true);
  };

  const openEdit = (row: Record<string, unknown>) => {
    setEditing(row);
    const next = emptyFromFields(fields);
    for (const f of fields) {
      const v = row[f.key];
      if (v == null) continue;
      if (f.type === "datetime" && typeof v === "string") next[f.key] = v.slice(0, 16);
      else if (f.type === "date" && typeof v === "string") next[f.key] = v.slice(0, 10);
      else next[f.key] = v;
    }
    setForm(next);
    setOpen(true);
  };

  const handleSave = async () => {
    if (!schoolId) return;
    for (const f of fields) {
      if (f.required && !String(form[f.key] ?? "").trim()) {
        toast.error(`${f.label} is required`);
        return;
      }
    }
    setSaving(true);
    try {
      let payload: Record<string, unknown> = { school_id: schoolId, updated_at: new Date().toISOString(), updated_by: user?.id ?? null };
      for (const f of fields) {
        let v = form[f.key];
        if (f.type === "number") v = v === "" || v == null ? null : Number(v);
        if (f.type === "checkbox") v = Boolean(v);
        if (typeof v === "string" && v.trim() === "" && f.type !== "text") v = null;
        payload[f.key] = v;
      }
      if (beforeSave) payload = beforeSave(payload);

      if (editing?.id) {
        const { error } = await supabase.from(table).update(payload).eq("id", editing.id as string);
        if (error) throw error;
        toast.success("Updated");
      } else {
        const { error } = await supabase.from(table).insert({ ...payload, created_by: user?.id ?? null });
        if (error) throw error;
        toast.success("Created");
      }
      setOpen(false);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (row: Record<string, unknown>, archived: boolean) => {
    try {
      const { error } = await supabase
        .from(table)
        .update({
          is_archived: archived,
          ...(statusKey ? { [statusKey]: archived ? "archived" : restoreStatus } : {}),
          updated_at: new Date().toISOString(),
          updated_by: user?.id ?? null,
          ...(archived ? { deleted_by: user?.id ?? null } : {}),
        })
        .eq("id", row.id as string);
      if (error) throw error;
      toast.success(archived ? "Archived" : "Restored");
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Archive failed");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Permanently delete this record?")) return;
    try {
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
      toast.success("Deleted");
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const exportCsv = () => {
    downloadCsv(
      `${table}.csv`,
      fields.map((f) => f.label),
      filtered.map((r) => fields.map((f) => r[f.key] as string | number | null)),
    );
  };

  if (!access.canView) return <ModuleAccessDenied label={title} />;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-primary">{accentLabel}</p>
          <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`mr-1.5 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {schemaMissing ? (
        <OperationsSchemaSetupCard moduleLabel={title} quickScript={quickScript} />
      ) : (
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>{title}</CardTitle>
              <CardDescription>{filtered.length} record(s)</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              {access.canExport ? (
                <Button type="button" variant="outline" size="sm" onClick={exportCsv}>
                  Export CSV
                </Button>
              ) : null}
              {access.canCreate ? (
                <Button type="button" size="sm" onClick={openCreate}>
                  <Plus className="mr-1.5 h-4 w-4" />
                  Add
                </Button>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Input
                className="max-w-sm"
                placeholder="Search…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {softDelete ? (
                <Button
                  type="button"
                  variant={showArchived ? "secondary" : "outline"}
                  onClick={() => setShowArchived((v) => !v)}
                >
                  {showArchived ? "Showing archived" : "Show archived"}
                </Button>
              ) : null}
            </div>

            {filtered.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">No records found.</div>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {listFields.map((f) => (
                        <TableHead key={f.key}>{f.label}</TableHead>
                      ))}
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((row) => (
                      <TableRow key={String(row.id)}>
                        {listFields.map((f, idx) => (
                          <TableCell key={f.key}>
                            {idx === 0 ? (
                              <span className="font-medium text-foreground">{String(row[f.key] ?? "—")}</span>
                            ) : f.key === statusKey ? (
                              <Badge variant={String(row[f.key]) === "active" || String(row[f.key]) === "approved" || String(row[f.key]) === "paid" ? "success" : "secondary"}>
                                {String(row[f.key] ?? "—")}
                              </Badge>
                            ) : (
                              String(row[f.key] ?? "—")
                            )}
                          </TableCell>
                        ))}
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            {extraActions?.(row, () => void load())}
                            {access.canEdit ? (
                              <Button type="button" size="icon" variant="ghost" onClick={() => openEdit(row)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                            ) : null}
                            {access.canEdit && softDelete ? (
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                onClick={() => handleArchive(row, !Boolean(row.is_archived))}
                              >
                                {row.is_archived ? <RotateCcw className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                              </Button>
                            ) : null}
                            {access.canDelete ? (
                              <Button type="button" size="icon" variant="ghost" onClick={() => handleDelete(String(row.id))}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${title}` : `New ${title}`}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            {fields.map((f) => (
              <div
                key={f.key}
                className={`space-y-1 ${f.type === "textarea" ? "sm:col-span-2" : ""}`}
              >
                <Label>
                  {f.label}
                  {f.required ? " *" : ""}
                </Label>
                {f.type === "textarea" ? (
                  <Textarea
                    rows={3}
                    value={String(form[f.key] ?? "")}
                    onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                  />
                ) : f.type === "select" ? (
                  <Select
                    value={String(form[f.key] ?? "")}
                    onValueChange={(v) => setForm((prev) => ({ ...prev, [f.key]: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(f.options ?? []).map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : f.type === "checkbox" ? (
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={Boolean(form[f.key])}
                      onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.checked }))}
                    />
                    Enabled
                  </label>
                ) : (
                  <Input
                    type={f.type === "number" ? "number" : f.type === "datetime" ? "datetime-local" : f.type === "date" ? "date" : "text"}
                    placeholder={f.placeholder}
                    value={String(form[f.key] ?? "")}
                    onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
