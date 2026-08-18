import { useState } from "react";
import { Eye, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { deleteRoom, saveRoom } from "@/modules/hostel/lib/api";
import type { HostelBlock, HostelRoom, RoomStatus, RoomType } from "@/modules/hostel/lib/types";
import { formatMoney } from "@/lib/currency";
import { toast } from "sonner";

type Access = { canCreate: boolean; canEdit: boolean; canDelete: boolean };

type Props = {
  rooms: HostelRoom[];
  hostels: HostelBlock[];
  access: Access;
  onRefresh: () => void;
  schoolId: string | null;
};

const ROOM_TYPE_LABELS: Record<RoomType, string> = {
  single: "Single",
  double: "Double",
  triple: "Triple",
  dormitory: "Dormitory",
};

function roomStatusBadge(status: RoomStatus) {
  const map: Record<RoomStatus, { label: string; className: string }> = {
    available: { label: "Available", className: "bg-emerald-600/90" },
    full: { label: "Full", className: "bg-blue-600/90" },
    maintenance: { label: "Maintenance", className: "bg-amber-600/90" },
  };
  const s = map[status] ?? map.available;
  return <Badge className={s.className}>{s.label}</Badge>;
}

const emptyForm = {
  block_id: "",
  room_number: "",
  capacity: "4",
  floor: "",
  wing: "",
  room_type: "dormitory" as RoomType,
  monthly_fee: "0",
  term_fee: "0",
  room_status: "available" as RoomStatus,
  gender: "",
};

export function HostelRoomsPanel({ rooms, hostels, access, onRefresh, schoolId }: Props) {
  const [open, setOpen] = useState(false);
  const [viewRoom, setViewRoom] = useState<HostelRoom | null>(null);
  const [editing, setEditing] = useState<HostelRoom | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setForm(emptyForm);
    setEditing(null);
  };

  const openCreate = () => {
    resetForm();
    if (hostels[0]) setForm((f) => ({ ...f, block_id: hostels[0].id }));
    setOpen(true);
  };

  const openEdit = (room: HostelRoom) => {
    setEditing(room);
    setForm({
      block_id: room.block_id,
      room_number: room.room_number,
      capacity: String(room.capacity),
      floor: room.floor ?? "",
      wing: room.wing ?? "",
      room_type: room.room_type,
      monthly_fee: String(room.monthly_fee),
      term_fee: String(room.term_fee),
      room_status: room.room_status,
      gender: room.gender ?? "",
    });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!schoolId || !form.block_id || !form.room_number.trim()) {
      toast.error("Hostel and room number are required.");
      return;
    }
    setSaving(true);
    try {
      await saveRoom(
        schoolId,
        {
          block_id: form.block_id,
          room_number: form.room_number,
          capacity: Math.max(1, Number(form.capacity) || 1),
          floor: form.floor || undefined,
          wing: form.wing || undefined,
          room_type: form.room_type,
          monthly_fee: Number(form.monthly_fee) || 0,
          term_fee: Number(form.term_fee) || 0,
          room_status: form.room_status,
          gender: form.gender || null,
        },
        editing?.id,
      );
      toast.success(editing ? "Room updated" : "Room created");
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
    if (!confirm("Delete this room?")) return;
    try {
      await deleteRoom(id);
      toast.success("Room deleted");
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div>
          <CardTitle className="text-base">Rooms</CardTitle>
          <CardDescription>Manage room capacity, fees, and status.</CardDescription>
        </div>
        {access.canCreate ? (
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5" onClick={openCreate} disabled={!hostels.length}>
                <Plus className="h-4 w-4" />
                Add room
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editing ? "Edit room" : "Add room"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Hostel</Label>
                  <Select value={form.block_id} onValueChange={(v) => setForm({ ...form, block_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select hostel" /></SelectTrigger>
                    <SelectContent>
                      {hostels.map((h) => (
                        <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Room number</Label>
                    <Input value={form.room_number} onChange={(e) => setForm({ ...form, room_number: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Capacity</Label>
                    <Input type="number" min={1} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Floor</Label>
                    <Input value={form.floor} onChange={(e) => setForm({ ...form, floor: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Wing</Label>
                    <Input value={form.wing} onChange={(e) => setForm({ ...form, wing: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Room type</Label>
                    <Select value={form.room_type} onValueChange={(v) => setForm({ ...form, room_type: v as RoomType })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="single">Single</SelectItem>
                        <SelectItem value="double">Double</SelectItem>
                        <SelectItem value="triple">Triple</SelectItem>
                        <SelectItem value="dormitory">Dormitory</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Status</Label>
                    <Select value={form.room_status} onValueChange={(v) => setForm({ ...form, room_status: v as RoomStatus })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="available">Available</SelectItem>
                        <SelectItem value="full">Full</SelectItem>
                        <SelectItem value="maintenance">Maintenance</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Monthly fee</Label>
                    <Input type="number" min={0} value={form.monthly_fee} onChange={(e) => setForm({ ...form, monthly_fee: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Term fee</Label>
                    <Input type="number" min={0} value={form.term_fee} onChange={(e) => setForm({ ...form, term_fee: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Gender</Label>
                  <Select value={form.gender || "mixed"} onValueChange={(v) => setForm({ ...form, gender: v === "mixed" ? "" : v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mixed">Mixed</SelectItem>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={() => void handleSave()} disabled={saving}>
                  {saving ? "Saving…" : "Save room"}
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
              <TableHead>Hostel</TableHead>
              <TableHead>Room</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Floor</TableHead>
              <TableHead>Wing</TableHead>
              <TableHead>Capacity</TableHead>
              <TableHead>Occupied</TableHead>
              <TableHead>Available</TableHead>
              <TableHead>Gender</TableHead>
              <TableHead>Monthly</TableHead>
              <TableHead>Term</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rooms.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.block_name ?? "—"}</TableCell>
                <TableCell className="font-medium">{r.room_number}</TableCell>
                <TableCell>{ROOM_TYPE_LABELS[r.room_type]}</TableCell>
                <TableCell>{r.floor ?? "—"}</TableCell>
                <TableCell>{r.wing ?? "—"}</TableCell>
                <TableCell>{r.capacity}</TableCell>
                <TableCell>{r.occupied}</TableCell>
                <TableCell>{Math.max(0, r.capacity - r.occupied)}</TableCell>
                <TableCell>{r.gender ?? "mixed"}</TableCell>
                <TableCell>{formatMoney(r.monthly_fee)}</TableCell>
                <TableCell>{formatMoney(r.term_fee)}</TableCell>
                <TableCell>{roomStatusBadge(r.room_status)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => setViewRoom(r)} title="View room details">
                      <Eye className="h-4 w-4" />
                    </Button>
                    {access.canEdit ? (
                      <Button variant="ghost" size="icon" onClick={() => openEdit(r)} title="Edit">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    ) : null}
                    {access.canDelete ? (
                      <Button variant="ghost" size="icon" onClick={() => void handleDelete(r.id)} title="Delete">
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

      <Dialog open={!!viewRoom} onOpenChange={(v) => !v && setViewRoom(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-2 pr-6">
              <span>{viewRoom?.block_name} — Room {viewRoom?.room_number}</span>
              {viewRoom?.room_status ? roomStatusBadge(viewRoom.room_status) : null}
            </DialogTitle>
          </DialogHeader>
          {viewRoom ? (
            <dl className="grid gap-2.5 text-sm sm:grid-cols-2 py-2">
              {[
                ["Hostel Block", viewRoom.block_name],
                ["Room Number", viewRoom.room_number],
                ["Room Type", ROOM_TYPE_LABELS[viewRoom.room_type]],
                ["Floor", viewRoom.floor],
                ["Wing", viewRoom.wing],
                ["Gender", viewRoom.gender ?? "mixed"],
                ["Total Capacity", viewRoom.capacity],
                ["Occupied Beds", viewRoom.occupied],
                ["Available Beds", Math.max(0, viewRoom.capacity - viewRoom.occupied)],
                ["Monthly Fee", formatMoney(viewRoom.monthly_fee)],
                ["Term Fee", formatMoney(viewRoom.term_fee)],
              ].map(([k, v]) => (
                <div key={String(k)} className="rounded-md border bg-muted/20 p-2">
                  <dt className="text-xs text-muted-foreground">{k}</dt>
                  <dd className="font-medium mt-0.5">{String(v ?? "—")}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={() => setViewRoom(null)}>
              Close
            </Button>
            {access.canEdit && viewRoom ? (
              <Button
                type="button"
                onClick={() => {
                  const r = viewRoom;
                  setViewRoom(null);
                  openEdit(r);
                }}
              >
                Edit Room
              </Button>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
