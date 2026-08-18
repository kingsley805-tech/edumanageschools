import { useMemo, useState } from "react";
import { Eye, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { deleteSupplier, saveSupplier } from "@/modules/inventory/lib/api";
import type { InventorySupplier } from "@/modules/inventory/lib/types";
import { ExportMenu } from "@/modules/lib/ExportMenu";
import { toast } from "sonner";

type Access = { canCreate: boolean; canEdit: boolean; canDelete: boolean; canExport?: boolean };

type Props = {
  suppliers: InventorySupplier[];
  schoolId: string | null;
  access: Access;
  onRefresh: () => void;
};

const emptyForm = {
  name: "",
  company_name: "",
  contact_person: "",
  phone: "",
  email: "",
  address: "",
  payment_terms: "",
  products_supplied: "",
  status: "active" as InventorySupplier["status"],
};

export function InventorySuppliersPanel({ suppliers, schoolId, access, onRefresh }: Props) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [viewSupplier, setViewSupplier] = useState<InventorySupplier | null>(null);
  const [editing, setEditing] = useState<InventorySupplier | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter((s) =>
      [s.name, s.company_name, s.contact_person, s.email, s.phone].filter(Boolean).join(" ").toLowerCase().includes(q),
    );
  }, [suppliers, search]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditing(null);
  };

  const openCreate = () => {
    resetForm();
    setOpen(true);
  };

  const openEdit = (s: InventorySupplier) => {
    setEditing(s);
    setForm({
      name: s.name,
      company_name: s.company_name ?? "",
      contact_person: s.contact_person ?? "",
      phone: s.phone ?? "",
      email: s.email ?? "",
      address: s.address ?? "",
      payment_terms: s.payment_terms ?? "",
      products_supplied: s.products_supplied ?? "",
      status: s.status,
    });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!schoolId || !form.name.trim()) {
      toast.error("Supplier name is required.");
      return;
    }
    setSaving(true);
    try {
      await saveSupplier(schoolId, form, editing?.id);
      toast.success(editing ? "Supplier updated" : "Supplier created");
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
    if (!confirm("Delete this supplier?")) return;
    try {
      await deleteSupplier(id);
      toast.success("Supplier deleted");
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle className="text-base">Supplier Management</CardTitle>
          <CardDescription>{filtered.length} supplier(s)</CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <Input
            className="w-[200px]"
            placeholder="Search suppliers…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {access.canExport !== false ? (
            <ExportMenu
              filename="suppliers"
              title="Suppliers"
              headers={["Name", "Company", "Contact", "Phone", "Email", "Products", "Status", "POs"]}
              rows={filtered.map((s) => [
                s.name,
                s.company_name,
                s.contact_person,
                s.phone,
                s.email,
                s.products_supplied,
                s.status,
                s.purchase_count,
              ])}
            />
          ) : null}
          {access.canCreate ? (
            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5" onClick={openCreate}>
                  <Plus className="h-4 w-4" />
                  Add supplier
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>{editing ? "Edit supplier" : "Add supplier"}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Name *</Label>
                    <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Company</Label>
                    <Input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Contact person</Label>
                    <Input value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Phone</Label>
                    <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Email</Label>
                    <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Address</Label>
                    <Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} rows={2} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Payment terms</Label>
                    <Input value={form.payment_terms} onChange={(e) => setForm({ ...form, payment_terms: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Status</Label>
                    <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as InventorySupplier["status"] })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Products supplied</Label>
                    <Textarea value={form.products_supplied} onChange={(e) => setForm({ ...form, products_supplied: e.target.value })} rows={2} />
                  </div>
                </div>
                <Button onClick={() => void handleSave()} disabled={saving} className="mt-2">
                  {saving ? "Saving…" : "Save supplier"}
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
              <TableHead>Name</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Products</TableHead>
              <TableHead>POs</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell>{s.company_name ?? "—"}</TableCell>
                <TableCell>{s.contact_person ?? "—"}</TableCell>
                <TableCell>{s.phone ?? "—"}</TableCell>
                <TableCell className="max-w-[160px] truncate">{s.products_supplied ?? "—"}</TableCell>
                <TableCell>{s.purchase_count ?? 0}</TableCell>
                <TableCell>
                  <Badge variant={s.status === "active" ? "success" : "secondary"}>{s.status}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => setViewSupplier(s)} title="View details">
                      <Eye className="h-4 w-4" />
                    </Button>
                    {access.canEdit ? (
                      <Button variant="ghost" size="icon" onClick={() => openEdit(s)} title="Edit">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    ) : null}
                    {access.canDelete ? (
                      <Button variant="ghost" size="icon" onClick={() => void handleDelete(s.id)} title="Delete">
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

      <Dialog open={!!viewSupplier} onOpenChange={(v) => !v && setViewSupplier(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-2 pr-6">
              <span>{viewSupplier?.name}</span>
              {viewSupplier?.status ? (
                <Badge variant={viewSupplier.status === "active" ? "success" : "secondary"}>
                  {viewSupplier.status}
                </Badge>
              ) : null}
            </DialogTitle>
          </DialogHeader>
          {viewSupplier ? (
            <dl className="grid gap-2.5 text-sm sm:grid-cols-2 py-2">
              {[
                ["Company", viewSupplier.company_name],
                ["Contact Person", viewSupplier.contact_person],
                ["Phone", viewSupplier.phone],
                ["Email", viewSupplier.email],
                ["Payment Terms", viewSupplier.payment_terms],
                ["Purchase Orders", viewSupplier.purchase_count ?? 0],
              ].map(([k, v]) => (
                <div key={String(k)} className="rounded-md border bg-muted/20 p-2">
                  <dt className="text-xs text-muted-foreground">{k}</dt>
                  <dd className="font-medium mt-0.5">{String(v ?? "—")}</dd>
                </div>
              ))}
              {viewSupplier.address ? (
                <div className="sm:col-span-2 rounded-md border bg-muted/20 p-2">
                  <dt className="text-xs text-muted-foreground">Address</dt>
                  <dd className="font-medium mt-0.5">{viewSupplier.address}</dd>
                </div>
              ) : null}
              {viewSupplier.products_supplied ? (
                <div className="sm:col-span-2 rounded-md border bg-muted/20 p-2">
                  <dt className="text-xs text-muted-foreground">Products Supplied</dt>
                  <dd className="font-medium mt-0.5">{viewSupplier.products_supplied}</dd>
                </div>
              ) : null}
            </dl>
          ) : null}
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={() => setViewSupplier(null)}>
              Close
            </Button>
            {access.canEdit && viewSupplier ? (
              <Button
                type="button"
                onClick={() => {
                  const s = viewSupplier;
                  setViewSupplier(null);
                  openEdit(s);
                }}
              >
                Edit Supplier
              </Button>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
