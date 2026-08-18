import { useMemo, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  Eye,
  PackageMinus,
  PackagePlus,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
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
import {
  archiveInventoryItem,
  deleteInventoryItem,
  recordStockMovement,
  saveInventoryItem,
} from "@/modules/inventory/lib/api";
import type { InventoryFilters, InventoryItem, InventorySupplier } from "@/modules/inventory/lib/types";
import { ExportMenu } from "@/modules/lib/ExportMenu";
import { formatMoney } from "@/lib/currency";
import { toast } from "sonner";

type Access = { canCreate: boolean; canEdit: boolean; canDelete: boolean; canExport?: boolean };

type Props = {
  items: InventoryItem[];
  suppliers: InventorySupplier[];
  schoolId: string | null;
  access: Access;
  currency?: string | null;
  onRefresh: () => void;
};

const emptyForm = {
  sku: "",
  barcode: "",
  name: "",
  category: "",
  subcategory: "",
  brand: "",
  description: "",
  quantity: "0",
  unit: "pcs",
  location: "",
  reorder_level: "",
  max_stock_level: "",
  unit_cost: "0",
  supplier_id: "",
  item_status: "available" as InventoryItem["item_status"],
};

function statusBadge(status: InventoryItem["item_status"]) {
  const labels: Record<InventoryItem["item_status"], string> = {
    available: "Available",
    low_stock: "Low Stock",
    out_of_stock: "Out of Stock",
    discontinued: "Discontinued",
  };
  const variant =
    status === "available" ? "default" : status === "discontinued" ? "secondary" : "destructive";
  return (
    <Badge variant={variant} className={status === "available" ? "bg-emerald-600/90" : ""}>
      {labels[status]}
    </Badge>
  );
}

function filterItems(items: InventoryItem[], filters: InventoryFilters) {
  const q = filters.search.trim().toLowerCase();
  return items.filter((item) => {
    if (q) {
      const hay = [item.name, item.sku, item.barcode, item.category, item.brand]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (filters.category && item.category !== filters.category) return false;
    if (filters.supplierId && item.supplier_id !== filters.supplierId) return false;
    if (filters.stockStatus && item.item_status !== filters.stockStatus) return false;
    return true;
  });
}

export function InventoryItemsPanel({ items, suppliers, schoolId, access, currency, onRefresh }: Props) {
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
  const [viewItem, setViewItem] = useState<InventoryItem | null>(null);
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [stockDialog, setStockDialog] = useState<{ item: InventoryItem; type: "in" | "out" } | null>(null);
  const [stockQty, setStockQty] = useState("1");

  const categories = useMemo(
    () => [...new Set(items.map((i) => i.category).filter(Boolean) as string[])].sort(),
    [items],
  );
  const filtered = useMemo(() => filterItems(items, filters), [items, filters]);
  const money = (v: number) => formatMoney(v, currency);

  const resetForm = () => {
    setForm(emptyForm);
    setEditing(null);
  };

  const openCreate = () => {
    resetForm();
    setOpen(true);
  };

  const openEdit = (item: InventoryItem) => {
    setEditing(item);
    setForm({
      sku: item.sku ?? "",
      barcode: item.barcode ?? "",
      name: item.name,
      category: item.category ?? "",
      subcategory: item.subcategory ?? "",
      brand: item.brand ?? "",
      description: item.description ?? "",
      quantity: String(item.quantity),
      unit: item.unit ?? "pcs",
      location: item.location ?? "",
      reorder_level: item.reorder_level != null ? String(item.reorder_level) : "",
      max_stock_level: item.max_stock_level != null ? String(item.max_stock_level) : "",
      unit_cost: String(item.unit_cost),
      supplier_id: item.supplier_id ?? "",
      item_status: item.item_status,
    });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!schoolId || !form.name.trim()) {
      toast.error("Item name is required.");
      return;
    }
    setSaving(true);
    try {
      await saveInventoryItem(
        schoolId,
        {
          sku: form.sku || null,
          barcode: form.barcode || null,
          name: form.name,
          category: form.category || null,
          subcategory: form.subcategory || null,
          brand: form.brand || null,
          description: form.description || null,
          quantity: Number(form.quantity),
          unit: form.unit,
          location: form.location || null,
          reorder_level: form.reorder_level ? Number(form.reorder_level) : null,
          max_stock_level: form.max_stock_level ? Number(form.max_stock_level) : null,
          unit_cost: Number(form.unit_cost),
          supplier_id: form.supplier_id || null,
          item_status: form.item_status,
        },
        editing?.id,
      );
      toast.success(editing ? "Item updated" : "Item created");
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
    if (!confirm("Delete this inventory item?")) return;
    try {
      await deleteInventoryItem(id);
      toast.success("Item deleted");
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const handleArchive = async (item: InventoryItem) => {
    try {
      await archiveInventoryItem(item.id, !item.is_archived);
      toast.success(item.is_archived ? "Item restored" : "Item archived");
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Archive failed");
    }
  };

  const handleStock = async () => {
    if (!stockDialog) return;
    const qty = Number(stockQty);
    if (!qty || qty <= 0) {
      toast.error("Enter a valid quantity.");
      return;
    }
    try {
      await recordStockMovement(
        stockDialog.item.id,
        stockDialog.type === "in" ? "stock_in" : "stock_out",
        qty,
        { remarks: stockDialog.type === "in" ? "Manual restock" : "Manual issue" },
      );
      toast.success(stockDialog.type === "in" ? "Stock added" : "Stock issued");
      setStockDialog(null);
      setStockQty("1");
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Stock update failed");
    }
  };

  const exportHeaders = [
    "SKU",
    "Barcode",
    "Name",
    "Category",
    "Qty",
    "Unit",
    "Unit Cost",
    "Stock Value",
    "Location",
    "Status",
    "Supplier",
  ];
  const exportRows = filtered.map((r) => [
    r.sku,
    r.barcode,
    r.name,
    r.category,
    r.quantity,
    r.unit,
    r.unit_cost,
    r.stock_value,
    r.location,
    r.item_status,
    r.supplier_name,
  ]);

  return (
    <div className="space-y-4">
      <InventoryFiltersBar
        filters={filters}
        onChange={setFilters}
        categories={categories}
        suppliers={suppliers}
        showStockStatus
      />

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">Inventory Items</CardTitle>
            <CardDescription>{filtered.length} item(s) — full stock register</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            {access.canExport !== false ? (
              <ExportMenu
                filename="inventory-items"
                title="Inventory Items"
                headers={exportHeaders}
                rows={exportRows}
              />
            ) : null}
            {access.canCreate ? (
              <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-1.5" onClick={openCreate}>
                    <Plus className="h-4 w-4" />
                    Add item
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-h-[90vh] overflow-y-auto max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>{editing ? "Edit item" : "Add inventory item"}</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Item name *</Label>
                      <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>SKU</Label>
                      <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} className="font-mono" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Barcode</Label>
                      <Input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} className="font-mono" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Category</Label>
                      <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Subcategory</Label>
                      <Input value={form.subcategory} onChange={(e) => setForm({ ...form, subcategory: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Brand</Label>
                      <Input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Unit</Label>
                      <Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Location</Label>
                      <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Quantity</Label>
                      <Input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Min stock (reorder)</Label>
                      <Input type="number" value={form.reorder_level} onChange={(e) => setForm({ ...form, reorder_level: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Max stock</Label>
                      <Input type="number" value={form.max_stock_level} onChange={(e) => setForm({ ...form, max_stock_level: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Unit cost</Label>
                      <Input type="number" value={form.unit_cost} onChange={(e) => setForm({ ...form, unit_cost: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Supplier</Label>
                      <Select value={form.supplier_id || "none"} onValueChange={(v) => setForm({ ...form, supplier_id: v === "none" ? "" : v })}>
                        <SelectTrigger><SelectValue placeholder="Supplier" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {suppliers.map((s) => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Status</Label>
                      <Select value={form.item_status} onValueChange={(v) => setForm({ ...form, item_status: v as InventoryItem["item_status"] })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="available">Available</SelectItem>
                          <SelectItem value="low_stock">Low Stock</SelectItem>
                          <SelectItem value="out_of_stock">Out of Stock</SelectItem>
                          <SelectItem value="discontinued">Discontinued</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label>Description</Label>
                      <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
                    </div>
                  </div>
                  <Button onClick={() => void handleSave()} disabled={saving} className="mt-2">
                    {saving ? "Saving…" : "Save item"}
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
                <TableHead>SKU</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Unit cost</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground">
                    No inventory items found.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.sku ?? "—"}</TableCell>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell>{r.category ?? "—"}</TableCell>
                    <TableCell>{r.quantity} {r.unit}</TableCell>
                    <TableCell>{money(r.unit_cost)}</TableCell>
                    <TableCell>{money(r.stock_value ?? 0)}</TableCell>
                    <TableCell>{r.location ?? "—"}</TableCell>
                    <TableCell>{statusBadge(r.item_status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setViewItem(r)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        {access.canEdit ? (
                          <>
                            <Button variant="ghost" size="icon" onClick={() => openEdit(r)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => setStockDialog({ item: r, type: "out" })} title="Issue">
                              <PackageMinus className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => setStockDialog({ item: r, type: "in" })} title="Restock">
                              <PackagePlus className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => void handleArchive(r)}>
                              {r.is_archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                            </Button>
                          </>
                        ) : null}
                        {access.canDelete ? (
                          <Button variant="ghost" size="icon" onClick={() => void handleDelete(r.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!viewItem} onOpenChange={(v) => !v && setViewItem(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{viewItem?.name}</DialogTitle>
          </DialogHeader>
          {viewItem ? (
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              {[
                ["SKU", viewItem.sku],
                ["Barcode", viewItem.barcode],
                ["Category", viewItem.category],
                ["Subcategory", viewItem.subcategory],
                ["Brand", viewItem.brand],
                ["Quantity", `${viewItem.quantity} ${viewItem.unit}`],
                ["Reorder level", viewItem.reorder_level],
                ["Max stock", viewItem.max_stock_level],
                ["Unit cost", money(viewItem.unit_cost)],
                ["Stock value", money(viewItem.stock_value ?? 0)],
                ["Supplier", viewItem.supplier_name],
                ["Location", viewItem.location],
                ["Added", new Date(viewItem.created_at).toLocaleDateString()],
                ["Updated", new Date(viewItem.updated_at).toLocaleDateString()],
              ].map(([k, v]) => (
                <div key={String(k)}>
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="font-medium">{v ?? "—"}</dd>
                </div>
              ))}
              {viewItem.description ? (
                <div className="sm:col-span-2">
                  <dt className="text-muted-foreground">Description</dt>
                  <dd>{viewItem.description}</dd>
                </div>
              ) : null}
            </dl>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={!!stockDialog} onOpenChange={(v) => !v && setStockDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{stockDialog?.type === "in" ? "Restock" : "Issue"} — {stockDialog?.item.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Current stock: {stockDialog?.item.quantity} {stockDialog?.item.unit}</p>
            <div className="space-y-1.5">
              <Label>Quantity</Label>
              <Input type="number" value={stockQty} onChange={(e) => setStockQty(e.target.value)} min={1} />
            </div>
            <Button onClick={() => void handleStock()}>Confirm</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
