// @ts-nocheck
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Archive, Eye, Pencil, Plus, RefreshCw, RotateCcw, Trash2 } from "lucide-react";
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
import { ExportMenu } from "@/modules/lib/ExportMenu";
import { isMissingTableError } from "@/modules/lib/missingSchema";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { uploadShopProductImage } from "@/modules/shop/lib/uploadProductImage";

export type FieldDef = {
  key: string;
  label: string;
  type?: "text" | "number" | "date" | "datetime" | "textarea" | "select" | "checkbox" | "image" | "student";
  required?: boolean;
  options?: { value: string; label: string }[];
  list?: boolean;
  /** When false, field is kept for list/search/save but hidden from the create/edit dialog */
  form?: boolean;
  placeholder?: string;
  /** Storage bucket for type="image" uploads */
  uploadBucket?: string;
};

type StudentOption = {
  id: string;
  name: string;
  admission: string;
  class_name: string;
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
    if (f.type === "student") o[`_class_${f.key}`] = "";
  }
  return o;
}

function pickerClassKey(fieldKey: string) {
  return `_class_${fieldKey}`;
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
  const [viewingRow, setViewingRow] = useState<Record<string, unknown> | null>(null);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>(emptyFromFields(fields));
  const [saving, setSaving] = useState(false);
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [students, setStudents] = useState<StudentOption[]>([]);

  const listFields = fields.filter((f) => f.list !== false);
  const keysToSearch = searchKeys ?? fields.map((f) => f.key);
  const hasStudentField = fields.some((f) => f.type === "student");

  const classOptions = useMemo(
    () =>
      [...new Set(students.map((s) => s.class_name).filter((c) => c && c !== "—"))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [students],
  );

  const loadStudents = useCallback(async () => {
    if (!schoolId || !hasStudentField) {
      setStudents([]);
      return;
    }
    const { data, error } = await supabase
      .from("students")
      .select("id, full_name, admission_number, classes(name)")
      .eq("school_id", schoolId)
      .order("full_name");
    if (error) {
      console.error(error);
      return;
    }
    setStudents(
      (data ?? []).map((s) => ({
        id: s.id as string,
        name: (s.full_name as string) ?? "Student",
        admission: (s.admission_number as string) ?? "",
        class_name: (s.classes as { name?: string } | null)?.name ?? "—",
      })),
    );
  }, [schoolId, hasStudentField]);

  const load = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const select = hasStudentField
        ? "*, students(full_name, admission_number, classes(name))"
        : "*";
      const { data, error } = await supabase
        .from(table)
        .select(select)
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
      const mapped = (data ?? []).map((raw) => {
        const r = raw as Record<string, unknown>;
        if (hasStudentField) {
          const st = r.students as {
            full_name?: string;
            admission_number?: string;
            classes?: { name?: string } | null;
          } | null;
          r.student_name = st?.full_name ?? "";
          r.admission_number = st?.admission_number ?? "";
          r.class_name = st?.classes?.name ?? "";
        }
        return transformRow ? transformRow(r) : r;
      });
      setRows(mapped);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [schoolId, table, orderBy, transformRow, hasStudentField]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadStudents();
  }, [loadStudents]);

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
      if (f.type === "student") {
        const sid = String(v);
        const match = students.find((s) => s.id === sid);
        next[pickerClassKey(f.key)] = match?.class_name || String(row.class_name ?? "") || "";
      }
    }
    setForm(next);
    setOpen(true);
  };

  const handleImageUpload = async (field: FieldDef, file: File) => {
    if (!schoolId) return;
    setUploadingField(field.key);
    try {
      let url: string;
      if (field.uploadBucket === "shop-products") {
        url = await uploadShopProductImage({
          schoolId,
          file,
          productId: editing?.id ? String(editing.id) : undefined,
        });
      } else {
        throw new Error("Image upload bucket not configured");
      }
      setForm((prev) => ({ ...prev, [field.key]: url }));
      toast.success("Image uploaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploadingField(null);
    }
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
      let payload: Record<string, unknown> = {
        school_id: schoolId,
        updated_at: new Date().toISOString(),
      };
      if (user?.id) payload.updated_by = user.id;

      for (const f of fields) {
        if (f.key.startsWith("_class_")) continue;
        let v = form[f.key];
        if (f.type === "number") v = v === "" || v == null ? null : Number(v);
        if (f.type === "checkbox") v = Boolean(v);
        if (typeof v === "string" && v.trim() === "") v = null;
        if (f.type === "number" && typeof v === "number" && Number.isNaN(v)) v = null;
        payload[f.key] = v;
      }
      // Strip any picker-only keys
      for (const key of Object.keys(payload)) {
        if (key.startsWith("_class_")) delete payload[key];
      }
      if (beforeSave) payload = beforeSave(payload);

      if (editing?.id) {
        let { error } = await supabase.from(table).update(payload).eq("id", editing.id as string);
        if (error && /foreign key|updated_by|created_by/i.test(`${error.message} ${error.details ?? ""}`)) {
          const retry = { ...payload };
          delete retry.updated_by;
          delete retry.created_by;
          ({ error } = await supabase.from(table).update(retry).eq("id", editing.id as string));
        }
        if (error) throw error;
        toast.success("Updated");
      } else {
        const insertRow = { ...payload };
        if (user?.id) insertRow.created_by = user.id;
        let { error } = await supabase.from(table).insert(insertRow);
        if (error && /foreign key|updated_by|created_by/i.test(`${error.message} ${error.details ?? ""}`)) {
          const retry = { ...insertRow };
          delete retry.updated_by;
          delete retry.created_by;
          ({ error } = await supabase.from(table).insert(retry));
        }
        if (error) throw error;
        toast.success("Created");
      }
      setOpen(false);
      void load();
    } catch (e) {
      const err = e as { message?: string; details?: string; hint?: string; code?: string };
      const parts = [err.message, err.details, err.hint].filter(Boolean);
      toast.error(parts.length ? parts.join(" — ") : e instanceof Error ? e.message : "Save failed");
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

  if (!access.canView) return <ModuleAccessDenied label={title} />;

  const exportHeaders = fields.map((f) => (f.type === "student" ? "Student" : f.label));
  const exportRows = filtered.map((r) =>
    fields.map((f) => {
      if (f.type === "student") {
        return (r.student_name as string) || (r[f.key] as string) || "";
      }
      return r[f.key] as string | number | null;
    }),
  );

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
                <ExportMenu filename={table} title={title} headers={exportHeaders} rows={exportRows} />
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
              <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
                <Table className="min-w-full">
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      {listFields.map((f) => (
                        <TableHead key={f.key} className="whitespace-nowrap font-semibold text-xs py-3 px-4 text-foreground">
                          {f.type === "student" ? "Student" : f.label}
                        </TableHead>
                      ))}
                      <TableHead className="text-right whitespace-nowrap font-semibold text-xs py-3 px-4 text-foreground">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((row) => (
                      <TableRow key={String(row.id)} className="hover:bg-muted/30 transition-colors">
                        {listFields.map((f, idx) => (
                          <TableCell key={f.key} className="py-3 px-4 text-xs">
                            {f.type === "image" ? (
                              row[f.key] ? (
                                <img
                                  src={String(row[f.key])}
                                  alt=""
                                  className="h-10 w-10 rounded-md border object-cover"
                                />
                              ) : (
                                <div className="flex h-10 w-10 items-center justify-center rounded-md border bg-muted text-[10px] text-muted-foreground">
                                  —
                                </div>
                              )
                            ) : f.type === "student" ? (
                              <div>
                                <div className="font-medium text-foreground whitespace-nowrap">
                                  {String(row.student_name || row[f.key] || "—")}
                                </div>
                                {(row.admission_number || row.class_name) && (
                                  <div className="text-[11px] text-muted-foreground whitespace-nowrap">
                                    {[row.admission_number, row.class_name].filter(Boolean).join(" · ")}
                                  </div>
                                )}
                              </div>
                            ) : idx === 0 || (idx === 1 && listFields[0]?.type === "image") ? (
                              <span className="font-medium text-foreground whitespace-nowrap">{String(row[f.key] ?? "—")}</span>
                            ) : f.key === statusKey || f.key.includes("status") ? (
                              <Badge variant={String(row[f.key]) === "active" || String(row[f.key]) === "approved" || String(row[f.key]) === "paid" || String(row[f.key]) === "delivered" ? "success" : String(row[f.key]) === "pending" || String(row[f.key]) === "processing" || String(row[f.key]) === "ready" ? "warning" : String(row[f.key]) === "unpaid" || String(row[f.key]) === "cancelled" || String(row[f.key]) === "returned" ? "destructive" : "secondary"}>
                                {String(row[f.key] ?? "—")}
                              </Badge>
                            ) : f.type === "checkbox" ? (
                              Boolean(row[f.key]) ? "Yes" : "No"
                            ) : f.type === "number" ? (
                              <span className="font-mono text-foreground whitespace-nowrap">{row[f.key] != null ? Number(row[f.key]).toLocaleString() : "—"}</span>
                            ) : (
                              <span className="whitespace-nowrap">{String(row[f.key] ?? "—")}</span>
                            )}
                          </TableCell>
                        ))}
                        <TableCell className="py-3 px-4 text-right">
                          <div className="flex justify-end gap-1 whitespace-nowrap">
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              onClick={() => setViewingRow(row)}
                              title={`View ${title} details`}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {extraActions?.(row, () => void load())}
                            {access.canEdit ? (
                              <Button type="button" size="icon" variant="ghost" onClick={() => openEdit(row)} title="Edit">
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
            {fields.filter((f) => f.form !== false).map((f) => (
              <div
                key={f.key}
                className={`space-y-1 ${
                  f.type === "textarea" || f.type === "image" || f.type === "student"
                    ? "sm:col-span-2"
                    : ""
                }`}
              >
                {f.type === "student" ? (
                  <div className="space-y-3 rounded-md border border-border bg-muted/30 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Student
                    </p>
                    <div className="space-y-1">
                      <Label>Class *</Label>
                      <Select
                        value={String(form[pickerClassKey(f.key)] || "") || undefined}
                        onValueChange={(v) =>
                          setForm((prev) => ({
                            ...prev,
                            [pickerClassKey(f.key)]: v,
                            [f.key]: "",
                          }))
                        }
                        disabled={Boolean(editing)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select class first" />
                        </SelectTrigger>
                        <SelectContent>
                          {classOptions.map((c) => (
                            <SelectItem key={c} value={c}>
                              {c}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>
                        {f.label}
                        {f.required ? " *" : ""}
                      </Label>
                      <Select
                        value={String(form[f.key] || "") || undefined}
                        onValueChange={(v) => setForm((prev) => ({ ...prev, [f.key]: v }))}
                        disabled={Boolean(editing) || !String(form[pickerClassKey(f.key)] || "")}
                      >
                        <SelectTrigger>
                          <SelectValue
                            placeholder={
                              String(form[pickerClassKey(f.key)] || "")
                                ? "Select student"
                                : "Select class first"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent className="max-h-72">
                          {students.filter((s) => s.class_name === String(form[pickerClassKey(f.key)] || "")).length ===
                          0 ? (
                            <div className="px-2 py-3 text-sm text-muted-foreground">
                              {String(form[pickerClassKey(f.key)] || "")
                                ? "No students in this class."
                                : "Select a class first."}
                            </div>
                          ) : (
                            students
                              .filter((s) => s.class_name === String(form[pickerClassKey(f.key)] || ""))
                              .map((s) => (
                                <SelectItem key={s.id} value={s.id}>
                                  {s.name}
                                  {s.admission ? ` (${s.admission})` : ""}
                                </SelectItem>
                              ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ) : (
                  <>
                <Label>
                  {f.label}
                  {f.required ? " *" : ""}
                </Label>
                {f.type === "image" ? (
                  <div className="space-y-2">
                    {form[f.key] ? (
                      <div className="relative aspect-video max-w-xs overflow-hidden rounded-lg border bg-muted">
                        <img
                          src={String(form[f.key])}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ) : null}
                    <Input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      disabled={uploadingField === f.key}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handleImageUpload(f, file);
                        e.target.value = "";
                      }}
                    />
                    <Input
                      type="url"
                      placeholder="Or paste image URL"
                      value={String(form[f.key] ?? "")}
                      onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                    />
                    {uploadingField === f.key ? (
                      <p className="text-xs text-muted-foreground">Uploading…</p>
                    ) : null}
                  </div>
                ) : f.type === "textarea" ? (
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
                  </>
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

      {/* Entity Details View Dialog */}
      <Dialog open={!!viewingRow} onOpenChange={(v) => !v && setViewingRow(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-2 pr-6">
              <span>{title} Details</span>
              {viewingRow?.status || viewingRow?.[statusKey] ? (
                <Badge variant={String(viewingRow?.status ?? viewingRow?.[statusKey]) === "active" || String(viewingRow?.status ?? viewingRow?.[statusKey]) === "approved" || String(viewingRow?.status ?? viewingRow?.[statusKey]) === "paid" ? "success" : "secondary"}>
                  {String(viewingRow?.status ?? viewingRow?.[statusKey])}
                </Badge>
              ) : null}
            </DialogTitle>
          </DialogHeader>
          {viewingRow ? (
            <div className="space-y-4 py-2">
              <div className="grid gap-3 sm:grid-cols-2">
                {fields.map((f) => {
                  const val = viewingRow[f.key];
                  if (f.type === "image" && val) {
                    return (
                      <div key={f.key} className="sm:col-span-2 space-y-1">
                        <span className="text-xs font-medium text-muted-foreground">{f.label}</span>
                        <div className="aspect-video max-w-sm overflow-hidden rounded-lg border bg-muted">
                          <img src={String(val)} alt={f.label} className="h-full w-full object-cover" />
                        </div>
                      </div>
                    );
                  }
                  if (f.type === "textarea") {
                    return (
                      <div key={f.key} className="sm:col-span-2 space-y-1 rounded-md border bg-muted/20 p-2.5">
                        <span className="text-xs font-medium text-muted-foreground">{f.label}</span>
                        <p className="text-sm whitespace-pre-wrap">{String(val ?? "—")}</p>
                      </div>
                    );
                  }
                  if (f.type === "student") {
                    const studentObj = students.find((s) => s.id === val);
                    return (
                      <div key={f.key} className="space-y-1 rounded-md border bg-muted/20 p-2.5">
                        <span className="text-xs font-medium text-muted-foreground">{f.label}</span>
                        <p className="text-sm font-medium">{studentObj ? `${studentObj.name} (${studentObj.class_name})` : String(val ?? "—")}</p>
                      </div>
                    );
                  }
                  if (f.type === "checkbox") {
                    return (
                      <div key={f.key} className="space-y-1 rounded-md border bg-muted/20 p-2.5">
                        <span className="text-xs font-medium text-muted-foreground">{f.label}</span>
                        <p className="text-sm font-medium">{Boolean(val) ? "Yes" : "No"}</p>
                      </div>
                    );
                  }
                  return (
                    <div key={f.key} className="space-y-1 rounded-md border bg-muted/20 p-2.5">
                      <span className="text-xs font-medium text-muted-foreground">{f.label}</span>
                      <p className="text-sm font-medium">{val != null && val !== "" ? String(val) : "—"}</p>
                    </div>
                  );
                })}
              </div>

              {viewingRow.created_at || viewingRow.updated_at ? (
                <div className="border-t pt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
                  {viewingRow.created_at ? (
                    <div>Created: <span className="font-medium text-foreground">{new Date(String(viewingRow.created_at)).toLocaleString()}</span></div>
                  ) : null}
                  {viewingRow.updated_at ? (
                    <div>Updated: <span className="font-medium text-foreground">{new Date(String(viewingRow.updated_at)).toLocaleString()}</span></div>
                  ) : null}
                </div>
              ) : null}

              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button type="button" variant="outline" onClick={() => setViewingRow(null)}>
                  Close
                </Button>
                {access.canEdit ? (
                  <Button
                    type="button"
                    onClick={() => {
                      const r = viewingRow;
                      setViewingRow(null);
                      openEdit(r);
                    }}
                  >
                    Edit {title}
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
