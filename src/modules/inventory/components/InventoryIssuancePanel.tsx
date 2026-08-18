import { useMemo, useState } from "react";
import { Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { returnIssuance, saveIssuance } from "@/modules/inventory/lib/api";
import type { InventoryIssuance, InventoryItem } from "@/modules/inventory/lib/types";
import { ExportMenu } from "@/modules/lib/ExportMenu";
import { toast } from "sonner";

type Access = { canCreate: boolean; canEdit: boolean; canExport?: boolean };

type Props = {
  issuances: InventoryIssuance[];
  items: InventoryItem[];
  schoolId: string | null;
  access: Access;
  onRefresh: () => void;
};

const emptyForm = {
  item_id: "",
  recipient_type: "student" as InventoryIssuance["recipient_type"],
  recipient_name: "",
  recipient_ref: "",
  class_or_department: "",
  quantity: "1",
  issue_date: new Date().toISOString().slice(0, 10),
  expected_return_date: "",
  remarks: "",
};

function statusBadge(s: InventoryIssuance["status"]) {
  const map = {
    issued: { label: "Issued", className: "bg-blue-600/90" },
    returned: { label: "Returned", className: "bg-emerald-600/90" },
    overdue: { label: "Overdue", className: "bg-red-600/90" },
  };
  const m = map[s];
  return <Badge className={m.className}>{m.label}</Badge>;
}

export function InventoryIssuancePanel({ issuances, items, schoolId, access, onRefresh }: Props) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return issuances;
    return issuances.filter((i) =>
      [i.recipient_name, i.recipient_ref, i.item_name, i.class_or_department]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [issuances, search]);

  const handleSave = async () => {
    if (!schoolId || !form.item_id || !form.recipient_name.trim()) {
      toast.error("Item and recipient are required.");
      return;
    }
    setSaving(true);
    try {
      await saveIssuance(schoolId, {
        item_id: form.item_id,
        recipient_type: form.recipient_type,
        recipient_name: form.recipient_name,
        recipient_ref: form.recipient_ref || null,
        class_or_department: form.class_or_department || null,
        quantity: Number(form.quantity),
        issue_date: form.issue_date,
        expected_return_date: form.expected_return_date || null,
        remarks: form.remarks || null,
      });
      toast.success("Item issued");
      setOpen(false);
      setForm(emptyForm);
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Issue failed");
    } finally {
      setSaving(false);
    }
  };

  const handleReturn = async (issuance: InventoryIssuance) => {
    if (!confirm(`Mark as returned from ${issuance.recipient_name}?`)) return;
    try {
      await returnIssuance(issuance);
      toast.success("Item returned");
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Return failed");
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle className="text-base">Item Issuance & Return</CardTitle>
          <CardDescription>{filtered.length} issuance record(s)</CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <Input
            className="w-[200px]"
            placeholder="Search recipient, item…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {access.canExport !== false ? (
            <ExportMenu
              filename="item-issuances"
              title="Item Issuances"
              headers={["Item", "Recipient", "Type", "Ref", "Class/Dept", "Qty", "Issue Date", "Return Date", "Status"]}
              rows={filtered.map((i) => [
                i.item_name,
                i.recipient_name,
                i.recipient_type,
                i.recipient_ref,
                i.class_or_department,
                i.quantity,
                i.issue_date,
                i.return_date,
                i.status,
              ])}
            />
          ) : null}
          {access.canCreate ? (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5">
                  <Plus className="h-4 w-4" />
                  Issue item
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Issue inventory item</DialogTitle>
                </DialogHeader>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Item *</Label>
                    <Select value={form.item_id || "none"} onValueChange={(v) => setForm({ ...form, item_id: v === "none" ? "" : v })}>
                      <SelectTrigger><SelectValue placeholder="Select item" /></SelectTrigger>
                      <SelectContent>
                        {items.map((i) => (
                          <SelectItem key={i.id} value={i.id}>
                            {i.name} ({i.quantity} {i.unit})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Recipient type</Label>
                    <Select value={form.recipient_type} onValueChange={(v) => setForm({ ...form, recipient_type: v as InventoryIssuance["recipient_type"] })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="student">Student</SelectItem>
                        <SelectItem value="teacher">Teacher</SelectItem>
                        <SelectItem value="department">Department</SelectItem>
                        <SelectItem value="office">Office</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Recipient name *</Label>
                    <Input value={form.recipient_name} onChange={(e) => setForm({ ...form, recipient_name: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Admission / Staff ID</Label>
                    <Input value={form.recipient_ref} onChange={(e) => setForm({ ...form, recipient_ref: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Class / Department</Label>
                    <Input value={form.class_or_department} onChange={(e) => setForm({ ...form, class_or_department: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Quantity</Label>
                    <Input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} min={1} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Issue date</Label>
                    <Input type="date" value={form.issue_date} onChange={(e) => setForm({ ...form, issue_date: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Expected return</Label>
                    <Input type="date" value={form.expected_return_date} onChange={(e) => setForm({ ...form, expected_return_date: e.target.value })} />
                  </div>
                </div>
                <Button onClick={() => void handleSave()} disabled={saving} className="mt-2">
                  {saving ? "Issuing…" : "Issue item"}
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
              <TableHead>Item</TableHead>
              <TableHead>Recipient</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Class/Dept</TableHead>
              <TableHead>Qty</TableHead>
              <TableHead>Issue date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((i) => (
              <TableRow key={i.id}>
                <TableCell className="font-medium">{i.item_name ?? "—"}</TableCell>
                <TableCell>
                  {i.recipient_name}
                  {i.recipient_ref ? <span className="ml-1 text-xs text-muted-foreground">({i.recipient_ref})</span> : null}
                </TableCell>
                <TableCell className="capitalize">{i.recipient_type}</TableCell>
                <TableCell>{i.class_or_department ?? "—"}</TableCell>
                <TableCell>{i.quantity}</TableCell>
                <TableCell>{i.issue_date}</TableCell>
                <TableCell>{statusBadge(i.status)}</TableCell>
                <TableCell className="text-right">
                  {access.canEdit && i.status === "issued" ? (
                    <Button variant="ghost" size="icon" onClick={() => void handleReturn(i)} title="Return">
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
