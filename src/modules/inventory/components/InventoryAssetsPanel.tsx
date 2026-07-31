import { useMemo, useState } from "react";
import { Download, Eye, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { InventoryFiltersBar } from "@/modules/inventory/components/InventoryFiltersBar";
import { deleteAsset, saveAsset } from "@/modules/inventory/lib/api";
import type { InventoryAsset, InventoryFilters } from "@/modules/inventory/lib/types";
import { downloadCsv } from "@/modules/lib/exportCsv";
import { formatMoney } from "@/lib/currency";
import { toast } from "sonner";

type Access = { canCreate: boolean; canEdit: boolean; canDelete: boolean; canExport?: boolean };

type Props = {
  assets: InventoryAsset[];
  schoolId: string | null;
  access: Access;
  currency?: string | null;
  teachers: { id: string; name: string }[];
  classes: { id: string; name: string }[];
  onRefresh: () => void;
};

const emptyForm = {
  asset_code: "",
  name: "",
  category: "",
  serial_number: "",
  purchase_date: "",
  purchase_cost: "0",
  current_value: "0",
  assigned_department: "",
  assigned_staff_id: "",
  assigned_class_id: "",
  asset_condition: "good" as InventoryAsset["asset_condition"],
  warranty_info: "",
  maintenance_schedule: "",
  last_maintenance_date: "",
  next_maintenance_date: "",
  asset_status: "active" as InventoryAsset["asset_status"],
  barcode: "",
  notes: "",
};

function conditionBadge(c: InventoryAsset["asset_condition"]) {
  const colors: Record<InventoryAsset["asset_condition"], string> = {
    excellent: "bg-emerald-600/90",
    good: "bg-blue-600/90",
    fair: "bg-amber-600/90",
    damaged: "bg-red-600/90",
  };
  return <Badge className={colors[c]}>{c}</Badge>;
}

function statusBadge(s: InventoryAsset["asset_status"]) {
  const labels: Record<InventoryAsset["asset_status"], string> = {
    active: "Active",
    maintenance: "Under Maintenance",
    retired: "Retired",
    lost: "Lost",
  };
  return <Badge variant={s === "active" ? "success" : "secondary"}>{labels[s]}</Badge>;
}

export function InventoryAssetsPanel({
  assets,
  schoolId,
  access,
  currency,
  teachers,
  classes,
  onRefresh,
}: Props) {
  const [filters, setFilters] = useState<InventoryFilters>({
    search: "",
    category: "",
    supplierId: "",
    department: "",
    stockStatus: "",
    assetStatus: "",
    dateFrom: "",
    dateTo: "",
  });
  const [open, setOpen] = useState(false);
  const [viewAsset, setViewAsset] = useState<InventoryAsset | null>(null);
  const [editing, setEditing] = useState<InventoryAsset | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const categories = useMemo(
    () => [...new Set(assets.map((a) => a.category).filter(Boolean) as string[])].sort(),
    [assets],
  );

  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    return assets.filter((a) => {
      if (q) {
        const hay = [a.name, a.asset_code, a.serial_number, a.category, a.barcode].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filters.category && a.category !== filters.category) return false;
      if (filters.assetStatus && a.asset_status !== filters.assetStatus) return false;
      if (filters.department && a.assigned_department !== filters.department) return false;
      return true;
    });
  }, [assets, filters]);

  const money = (v: number) => formatMoney(v, currency);

  const resetForm = () => {
    setForm(emptyForm);
    setEditing(null);
  };

  const openCreate = () => {
    resetForm();
    setOpen(true);
  };

  const openEdit = (asset: InventoryAsset) => {
    setEditing(asset);
    setForm({
      asset_code: asset.asset_code,
      name: asset.name,
      category: asset.category ?? "",
      serial_number: asset.serial_number ?? "",
      purchase_date: asset.purchase_date ?? "",
      purchase_cost: String(asset.purchase_cost),
      current_value: String(asset.current_value),
      assigned_department: asset.assigned_department ?? "",
      assigned_staff_id: asset.assigned_staff_id ?? "",
      assigned_class_id: asset.assigned_class_id ?? "",
      asset_condition: asset.asset_condition,
      warranty_info: asset.warranty_info ?? "",
      maintenance_schedule: asset.maintenance_schedule ?? "",
      last_maintenance_date: asset.last_maintenance_date ?? "",
      next_maintenance_date: asset.next_maintenance_date ?? "",
      asset_status: asset.asset_status,
      barcode: asset.barcode ?? "",
      notes: asset.notes ?? "",
    });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!schoolId || !form.name.trim() || !form.asset_code.trim()) {
      toast.error("Asset name and code are required.");
      return;
    }
    setSaving(true);
    try {
      await saveAsset(
        schoolId,
        {
          asset_code: form.asset_code,
          name: form.name,
          category: form.category || null,
          serial_number: form.serial_number || null,
          purchase_date: form.purchase_date || null,
          purchase_cost: Number(form.purchase_cost),
          current_value: Number(form.current_value),
          assigned_department: form.assigned_department || null,
          assigned_staff_id: form.assigned_staff_id || null,
          assigned_class_id: form.assigned_class_id || null,
          asset_condition: form.asset_condition,
          warranty_info: form.warranty_info || null,
          maintenance_schedule: form.maintenance_schedule || null,
          last_maintenance_date: form.last_maintenance_date || null,
          next_maintenance_date: form.next_maintenance_date || null,
          asset_status: form.asset_status,
          barcode: form.barcode || null,
          notes: form.notes || null,
        },
        editing?.id,
      );
      toast.success(editing ? "Asset updated" : "Asset created");
      setOpen(false);
      resetForm();
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this asset?")) return;
    try {
      await deleteAsset(id);
      toast.success("Asset deleted");
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  return (
    <div className="space-y-4">
      <InventoryFiltersBar
        filters={filters}
        onChange={setFilters}
        categories={categories}
        suppliers={[]}
        showAssetStatus
      />

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">Asset Management</CardTitle>
            <CardDescription>{filtered.length} school asset(s)</CardDescription>
          </div>
          <div className="flex gap-2">
            {access.canExport !== false ? (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() =>
                  downloadCsv(
                    "asset-register.csv",
                    ["Code", "Name", "Category", "Serial", "Purchase Cost", "Current Value", "Department", "Condition", "Status"],
                    filtered.map((a) => [
                      a.asset_code,
                      a.name,
                      a.category,
                      a.serial_number,
                      a.purchase_cost,
                      a.current_value,
                      a.assigned_department,
                      a.asset_condition,
                      a.asset_status,
                    ]),
                  )
                }
              >
                <Download className="h-4 w-4" />
                Export
              </Button>
            ) : null}
            {access.canCreate ? (
              <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-1.5" onClick={openCreate}>
                    <Plus className="h-4 w-4" />
                    Add asset
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-h-[90vh] overflow-y-auto max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>{editing ? "Edit asset" : "Register asset"}</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Asset code *</Label>
                      <Input value={form.asset_code} onChange={(e) => setForm({ ...form, asset_code: e.target.value })} className="font-mono" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Asset name *</Label>
                      <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Category</Label>
                      <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Serial number</Label>
                      <Input value={form.serial_number} onChange={(e) => setForm({ ...form, serial_number: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Purchase date</Label>
                      <Input type="date" value={form.purchase_date} onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Purchase cost</Label>
                      <Input type="number" value={form.purchase_cost} onChange={(e) => setForm({ ...form, purchase_cost: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Current value</Label>
                      <Input type="number" value={form.current_value} onChange={(e) => setForm({ ...form, current_value: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Department</Label>
                      <Input value={form.assigned_department} onChange={(e) => setForm({ ...form, assigned_department: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Assigned staff</Label>
                      <Select value={form.assigned_staff_id || "none"} onValueChange={(v) => setForm({ ...form, assigned_staff_id: v === "none" ? "" : v })}>
                        <SelectTrigger><SelectValue placeholder="Staff" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {teachers.map((t) => (
                            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Classroom</Label>
                      <Select value={form.assigned_class_id || "none"} onValueChange={(v) => setForm({ ...form, assigned_class_id: v === "none" ? "" : v })}>
                        <SelectTrigger><SelectValue placeholder="Class" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {classes.map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Condition</Label>
                      <Select value={form.asset_condition} onValueChange={(v) => setForm({ ...form, asset_condition: v as InventoryAsset["asset_condition"] })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="excellent">Excellent</SelectItem>
                          <SelectItem value="good">Good</SelectItem>
                          <SelectItem value="fair">Fair</SelectItem>
                          <SelectItem value="damaged">Damaged</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Status</Label>
                      <Select value={form.asset_status} onValueChange={(v) => setForm({ ...form, asset_status: v as InventoryAsset["asset_status"] })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="maintenance">Under Maintenance</SelectItem>
                          <SelectItem value="retired">Retired</SelectItem>
                          <SelectItem value="lost">Lost</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Last maintenance</Label>
                      <Input type="date" value={form.last_maintenance_date} onChange={(e) => setForm({ ...form, last_maintenance_date: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Next maintenance</Label>
                      <Input type="date" value={form.next_maintenance_date} onChange={(e) => setForm({ ...form, next_maintenance_date: e.target.value })} />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label>Warranty info</Label>
                      <Input value={form.warranty_info} onChange={(e) => setForm({ ...form, warranty_info: e.target.value })} />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label>Maintenance schedule</Label>
                      <Input value={form.maintenance_schedule} onChange={(e) => setForm({ ...form, maintenance_schedule: e.target.value })} />
                    </div>
                  </div>
                  <Button onClick={() => void handleSave()} disabled={saving} className="mt-2">
                    {saving ? "Saving…" : "Save asset"}
                  </Button>
                </DialogContent>
              </Dialog>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Condition</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-mono text-xs">{a.asset_code}</TableCell>
                  <TableCell className="font-medium">{a.name}</TableCell>
                  <TableCell>{a.category ?? "—"}</TableCell>
                  <TableCell>{a.assigned_department ?? a.class_name ?? "—"}</TableCell>
                  <TableCell>{money(a.current_value)}</TableCell>
                  <TableCell>{conditionBadge(a.asset_condition)}</TableCell>
                  <TableCell>{statusBadge(a.asset_status)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setViewAsset(a)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      {access.canEdit ? (
                        <Button variant="ghost" size="icon" onClick={() => openEdit(a)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      ) : null}
                      {access.canDelete ? (
                        <Button variant="ghost" size="icon" onClick={() => void handleDelete(a.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!viewAsset} onOpenChange={(v) => !v && setViewAsset(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{viewAsset?.name}</DialogTitle>
          </DialogHeader>
          {viewAsset ? (
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              {[
                ["Code", viewAsset.asset_code],
                ["Serial", viewAsset.serial_number],
                ["Purchase cost", money(viewAsset.purchase_cost)],
                ["Current value", money(viewAsset.current_value)],
                ["Staff", viewAsset.staff_name],
                ["Class", viewAsset.class_name],
                ["Warranty", viewAsset.warranty_info],
                ["Next maintenance", viewAsset.next_maintenance_date],
              ].map(([k, v]) => (
                <div key={String(k)}>
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="font-medium">{v ?? "—"}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
