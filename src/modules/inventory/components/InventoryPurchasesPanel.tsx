import { useMemo, useState } from "react";
import { Eye, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { deletePurchaseOrder, savePurchaseOrder } from "@/modules/inventory/lib/api";
import type { InventoryItem, InventorySupplier, PurchaseOrder } from "@/modules/inventory/lib/types";
import { ExportMenu } from "@/modules/lib/ExportMenu";
import { formatMoney } from "@/lib/currency";
import { toast } from "sonner";

type Access = { canCreate: boolean; canEdit: boolean; canDelete: boolean; canExport?: boolean };

type Props = {
  orders: PurchaseOrder[];
  suppliers: InventorySupplier[];
  items: InventoryItem[];
  schoolId: string | null;
  access: Access;
  currency?: string | null;
  onRefresh: () => void;
};

const emptyForm = {
  po_number: "",
  supplier_id: "",
  purchase_date: new Date().toISOString().slice(0, 10),
  expected_delivery_date: "",
  payment_status: "unpaid" as PurchaseOrder["payment_status"],
  delivery_status: "pending" as PurchaseOrder["delivery_status"],
  invoice_number: "",
  receipt_url: "",
  notes: "",
  line_item_id: "",
  line_item_name: "",
  line_qty: "1",
  line_price: "0",
};

export function InventoryPurchasesPanel({
  orders,
  suppliers,
  items,
  schoolId,
  access,
  currency,
  onRefresh,
}: Props) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [viewOrder, setViewOrder] = useState<PurchaseOrder | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [lines, setLines] = useState<{ item_id?: string; item_name: string; quantity: number; unit_price: number }[]>([]);
  const [saving, setSaving] = useState(false);

  const money = (v: number) => formatMoney(v, currency);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter((o) =>
      [o.po_number, o.supplier_name, o.invoice_number].filter(Boolean).join(" ").toLowerCase().includes(q),
    );
  }, [orders, search]);

  const addLine = () => {
    const name = form.line_item_name.trim() || items.find((i) => i.id === form.line_item_id)?.name;
    if (!name) {
      toast.error("Select or enter an item name.");
      return;
    }
    setLines([
      ...lines,
      {
        item_id: form.line_item_id || undefined,
        item_name: name,
        quantity: Number(form.line_qty) || 1,
        unit_price: Number(form.line_price) || 0,
      },
    ]);
    setForm({ ...form, line_item_id: "", line_item_name: "", line_qty: "1", line_price: "0" });
  };

  const handleSave = async () => {
    if (!schoolId || !form.po_number.trim()) {
      toast.error("PO number is required.");
      return;
    }
    if (lines.length === 0) {
      toast.error("Add at least one line item.");
      return;
    }
    setSaving(true);
    try {
      await savePurchaseOrder(schoolId, {
        po_number: form.po_number,
        supplier_id: form.supplier_id || null,
        purchase_date: form.purchase_date,
        expected_delivery_date: form.expected_delivery_date || null,
        payment_status: form.payment_status,
        delivery_status: form.delivery_status,
        invoice_number: form.invoice_number || null,
        receipt_url: form.receipt_url || null,
        notes: form.notes || null,
        lines,
      });
      toast.success("Purchase order created");
      setOpen(false);
      setForm(emptyForm);
      setLines([]);
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this purchase order?")) return;
    try {
      await deletePurchaseOrder(id);
      toast.success("Purchase order deleted");
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle className="text-base">Purchase Management</CardTitle>
          <CardDescription>{filtered.length} purchase order(s)</CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <Input
            className="w-[200px]"
            placeholder="Search PO, supplier…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {access.canExport !== false ? (
            <ExportMenu
              filename="purchase-orders"
              title="Purchase Orders"
              headers={["PO#", "Supplier", "Date", "Expected", "Total", "Payment", "Delivery", "Invoice"]}
              rows={filtered.map((o) => [
                o.po_number,
                o.supplier_name,
                o.purchase_date,
                o.expected_delivery_date,
                o.total_cost,
                o.payment_status,
                o.delivery_status,
                o.invoice_number,
              ])}
            />
          ) : null}
          {access.canCreate ? (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5">
                  <Plus className="h-4 w-4" />
                  New PO
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto max-w-lg">
                <DialogHeader>
                  <DialogTitle>Create purchase order</DialogTitle>
                </DialogHeader>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>PO number *</Label>
                    <Input value={form.po_number} onChange={(e) => setForm({ ...form, po_number: e.target.value })} className="font-mono" />
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
                    <Label>Purchase date</Label>
                    <Input type="date" value={form.purchase_date} onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Expected delivery</Label>
                    <Input type="date" value={form.expected_delivery_date} onChange={(e) => setForm({ ...form, expected_delivery_date: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Payment status</Label>
                    <Select value={form.payment_status} onValueChange={(v) => setForm({ ...form, payment_status: v as PurchaseOrder["payment_status"] })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unpaid">Unpaid</SelectItem>
                        <SelectItem value="partial">Partial</SelectItem>
                        <SelectItem value="paid">Paid</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Delivery status</Label>
                    <Select value={form.delivery_status} onValueChange={(v) => setForm({ ...form, delivery_status: v as PurchaseOrder["delivery_status"] })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="partial">Partial</SelectItem>
                        <SelectItem value="delivered">Delivered</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Invoice number</Label>
                    <Input value={form.invoice_number} onChange={(e) => setForm({ ...form, invoice_number: e.target.value })} />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Receipt URL</Label>
                    <Input value={form.receipt_url} onChange={(e) => setForm({ ...form, receipt_url: e.target.value })} placeholder="https://…" />
                  </div>
                </div>
                <div className="mt-4 space-y-2 rounded-lg border p-3">
                  <p className="text-sm font-medium">Line items</p>
                  <div className="grid gap-2 sm:grid-cols-4">
                    <Select value={form.line_item_id || "custom"} onValueChange={(v) => {
                      if (v === "custom") setForm({ ...form, line_item_id: "" });
                      else {
                        const item = items.find((i) => i.id === v);
                        setForm({ ...form, line_item_id: v, line_item_name: item?.name ?? "", line_price: String(item?.unit_cost ?? 0) });
                      }
                    }}>
                      <SelectTrigger><SelectValue placeholder="Item" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="custom">Custom item</SelectItem>
                        {items.map((i) => (
                          <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input placeholder="Item name" value={form.line_item_name} onChange={(e) => setForm({ ...form, line_item_name: e.target.value })} />
                    <Input type="number" placeholder="Qty" value={form.line_qty} onChange={(e) => setForm({ ...form, line_qty: e.target.value })} />
                    <Input type="number" placeholder="Unit price" value={form.line_price} onChange={(e) => setForm({ ...form, line_price: e.target.value })} />
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={addLine}>Add line</Button>
                  {lines.length > 0 ? (
                    <ul className="text-sm space-y-1">
                      {lines.map((l, i) => (
                        <li key={i} className="flex justify-between">
                          <span>{l.item_name} × {l.quantity}</span>
                          <span>{money(l.quantity * l.unit_price)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
                <Button onClick={() => void handleSave()} disabled={saving} className="mt-2">
                  {saving ? "Saving…" : "Create PO"}
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
              <TableHead>PO#</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Delivery</TableHead>
              <TableHead>Invoice</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((o) => (
              <TableRow key={o.id}>
                <TableCell className="font-mono text-xs">{o.po_number}</TableCell>
                <TableCell>{o.supplier_name ?? "—"}</TableCell>
                <TableCell>{o.purchase_date}</TableCell>
                <TableCell>{money(o.total_cost)}</TableCell>
                <TableCell><Badge variant={o.payment_status === "paid" ? "success" : "warning"}>{o.payment_status}</Badge></TableCell>
                <TableCell><Badge variant={o.delivery_status === "delivered" ? "success" : "secondary"}>{o.delivery_status}</Badge></TableCell>
                <TableCell>{o.invoice_number ?? "—"}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => setViewOrder(o)} title="View order details">
                      <Eye className="h-4 w-4" />
                    </Button>
                    {access.canDelete ? (
                      <Button variant="ghost" size="icon" onClick={() => void handleDelete(o.id)} title="Delete">
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

      <Dialog open={!!viewOrder} onOpenChange={(v) => !v && setViewOrder(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-2 pr-6">
              <span>PO: {viewOrder?.po_number}</span>
              <div className="flex gap-1.5">
                {viewOrder?.payment_status ? (
                  <Badge variant={viewOrder.payment_status === "paid" ? "success" : "warning"}>
                    {viewOrder.payment_status}
                  </Badge>
                ) : null}
                {viewOrder?.delivery_status ? (
                  <Badge variant={viewOrder.delivery_status === "delivered" ? "success" : "secondary"}>
                    {viewOrder.delivery_status}
                  </Badge>
                ) : null}
              </div>
            </DialogTitle>
          </DialogHeader>
          {viewOrder ? (
            <div className="space-y-3 py-2">
              <dl className="grid gap-2.5 text-sm sm:grid-cols-2">
                {[
                  ["Supplier", viewOrder.supplier_name],
                  ["Purchase Date", viewOrder.purchase_date],
                  ["Expected Delivery", viewOrder.expected_delivery_date],
                  ["Total Cost", money(viewOrder.total_cost)],
                  ["Invoice Number", viewOrder.invoice_number],
                  ["Items Count", viewOrder.items_count ?? 0],
                ].map(([k, v]) => (
                  <div key={String(k)} className="rounded-md border bg-muted/20 p-2">
                    <dt className="text-xs text-muted-foreground">{k}</dt>
                    <dd className="font-medium mt-0.5">{String(v ?? "—")}</dd>
                  </div>
                ))}
              </dl>
              {viewOrder.receipt_url ? (
                <div className="rounded-md border bg-muted/20 p-2">
                  <dt className="text-xs text-muted-foreground">Receipt</dt>
                  <dd className="mt-0.5">
                    <a href={viewOrder.receipt_url} target="_blank" rel="noreferrer" className="text-primary hover:underline text-xs break-all">
                      {viewOrder.receipt_url}
                    </a>
                  </dd>
                </div>
              ) : null}
              {viewOrder.notes ? (
                <div className="rounded-md border bg-muted/20 p-2">
                  <dt className="text-xs text-muted-foreground">Notes</dt>
                  <dd className="text-sm mt-0.5">{viewOrder.notes}</dd>
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={() => setViewOrder(null)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
