import { useState } from "react";
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
import { deleteHostel, saveHostel } from "@/modules/hostel/lib/api";
import type { HostelBlock, HostelStatus, HostelType } from "@/modules/hostel/lib/types";
import { toast } from "sonner";

type Access = { canCreate: boolean; canEdit: boolean; canDelete: boolean };

type Props = {
  hostels: HostelBlock[];
  access: Access;
  onRefresh: () => void;
  schoolId: string | null;
};

const TYPE_LABELS: Record<HostelType, string> = {
  boys: "Boys",
  girls: "Girls",
  mixed: "Mixed",
};

function statusBadge(status: HostelStatus) {
  return status === "active" ? (
    <Badge variant="default" className="bg-emerald-600/90">Active</Badge>
  ) : (
    <Badge variant="secondary">Inactive</Badge>
  );
}

const emptyForm = {
  name: "",
  hostel_type: "mixed" as HostelType,
  warden_name: "",
  warden_phone: "",
  status: "active" as HostelStatus,
  description: "",
  capacity: "",
};

export function HostelHostelsPanel({ hostels, access, onRefresh, schoolId }: Props) {
  const [open, setOpen] = useState(false);
  const [viewHostel, setViewHostel] = useState<HostelBlock | null>(null);
  const [editing, setEditing] = useState<HostelBlock | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setForm(emptyForm);
    setEditing(null);
  };

  const openCreate = () => {
    resetForm();
    setOpen(true);
  };

  const openEdit = (hostel: HostelBlock) => {
    setEditing(hostel);
    setForm({
      name: hostel.name,
      hostel_type: hostel.hostel_type ?? "mixed",
      warden_name: hostel.warden_name ?? "",
      warden_phone: hostel.warden_phone ?? "",
      status: hostel.status,
      description: hostel.description ?? "",
      capacity: hostel.capacity != null ? String(hostel.capacity) : "",
    });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!schoolId || !form.name.trim()) {
      toast.error("Hostel name is required.");
      return;
    }
    setSaving(true);
    try {
      await saveHostel(
        schoolId,
        {
          name: form.name,
          hostel_type: form.hostel_type,
          warden_name: form.warden_name || null,
          warden_phone: form.warden_phone || null,
          status: form.status,
          description: form.description || null,
          capacity: form.capacity ? Number(form.capacity) : null,
        },
        editing?.id,
      );
      toast.success(editing ? "Hostel updated" : "Hostel created");
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
    if (!confirm("Delete this hostel? Rooms and allocations must be removed first.")) return;
    try {
      await deleteHostel(id);
      toast.success("Hostel deleted");
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div>
          <CardTitle className="text-base">Hostels</CardTitle>
          <CardDescription>Manage hostel blocks, wardens, and capacity.</CardDescription>
        </div>
        {access.canCreate ? (
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5" onClick={openCreate}>
                <Plus className="h-4 w-4" />
                Add hostel
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editing ? "Edit hostel" : "Add hostel"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Hostel name</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Type</Label>
                    <Select value={form.hostel_type} onValueChange={(v) => setForm({ ...form, hostel_type: v as HostelType })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="boys">Boys</SelectItem>
                        <SelectItem value="girls">Girls</SelectItem>
                        <SelectItem value="mixed">Mixed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Status</Label>
                    <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as HostelStatus })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Warden</Label>
                    <Input value={form.warden_name} onChange={(e) => setForm({ ...form, warden_name: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Warden phone</Label>
                    <Input value={form.warden_phone} onChange={(e) => setForm({ ...form, warden_phone: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Capacity (optional)</Label>
                  <Input type="number" min={0} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Description</Label>
                  <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
                </div>
                <Button onClick={() => void handleSave()} disabled={saving}>
                  {saving ? "Saving…" : "Save hostel"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        ) : null}
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Hostel Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Warden</TableHead>
              <TableHead>Capacity</TableHead>
              <TableHead>Occupied</TableHead>
              <TableHead>Available</TableHead>
              <TableHead>Rooms</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {hostels.map((h) => {
              const capacity = h.total_capacity ?? h.capacity ?? 0;
              const occupied = h.occupied ?? 0;
              const available = Math.max(0, capacity - occupied);
              return (
                <TableRow key={h.id}>
                  <TableCell className="font-medium">{h.name}</TableCell>
                  <TableCell>{TYPE_LABELS[h.hostel_type ?? "mixed"]}</TableCell>
                  <TableCell>{h.warden_name ?? "—"}</TableCell>
                  <TableCell>{capacity}</TableCell>
                  <TableCell>{occupied}</TableCell>
                  <TableCell>{available}</TableCell>
                  <TableCell>{h.room_count ?? 0}</TableCell>
                  <TableCell>{statusBadge(h.status)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setViewHostel(h)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      {access.canEdit ? (
                        <Button variant="ghost" size="icon" onClick={() => openEdit(h)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      ) : null}
                      {access.canDelete ? (
                        <Button variant="ghost" size="icon" onClick={() => void handleDelete(h.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={!!viewHostel} onOpenChange={(v) => !v && setViewHostel(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{viewHostel?.name}</DialogTitle>
          </DialogHeader>
          {viewHostel ? (
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">Type</dt><dd>{TYPE_LABELS[viewHostel.hostel_type ?? "mixed"]}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Warden</dt><dd>{viewHostel.warden_name ?? "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Phone</dt><dd>{viewHostel.warden_phone ?? "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Status</dt><dd>{statusBadge(viewHostel.status)}</dd></div>
              {viewHostel.description ? (
                <div><dt className="mb-1 text-muted-foreground">Description</dt><dd>{viewHostel.description}</dd></div>
              ) : null}
            </dl>
          ) : null}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
