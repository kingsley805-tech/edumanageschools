import { useEffect, useMemo, useState } from "react";
import { ArrowRightLeft, LogOut, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  assignStudentHostel,
  checkoutAllocation,
  fetchBedsForRoom,
} from "@/modules/hostel/lib/api";
import type {
  HostelAllocation,
  HostelBed,
  HostelBlock,
  HostelRoom,
  StudentOption,
} from "@/modules/hostel/lib/types";
import { HostelFiltersBar, type HostelFilters } from "@/modules/hostel/components/HostelFiltersBar";
import { formatMoney } from "@/lib/currency";
import { toast } from "sonner";

type Access = { canCreate: boolean; canEdit: boolean; canDelete: boolean };

type Props = {
  allocations: HostelAllocation[];
  students: StudentOption[];
  hostels: HostelBlock[];
  rooms: HostelRoom[];
  access: Access;
  onRefresh: () => void;
  schoolId: string | null;
  filters: HostelFilters;
};

function allocationStatusBadge(status: HostelAllocation["allocation_status"]) {
  const map = {
    active: { label: "Active", className: "bg-emerald-600/90" },
    pending: { label: "Pending", className: "bg-amber-600/90" },
    checked_out: { label: "Checked out", className: "" },
  };
  const s = map[status];
  return <Badge variant={status === "checked_out" ? "secondary" : "default"} className={s.className}>{s.label}</Badge>;
}

function paymentStatusBadge(status: HostelAllocation["payment_status"]) {
  const map = {
    paid: { label: "Paid", className: "bg-emerald-600/90" },
    partial: { label: "Partial", className: "bg-amber-600/90" },
    unpaid: { label: "Unpaid", className: "bg-red-600/90" },
  };
  const s = map[status];
  return <Badge className={s.className}>{s.label}</Badge>;
}

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

export function HostelAllocationsPanel({
  allocations,
  students,
  hostels,
  rooms,
  access,
  onRefresh,
  schoolId,
  filters: initialFilters,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState(initialFilters);

  useEffect(() => {
    setFilters(initialFilters);
  }, [initialFilters]);
  const [assignOpen, setAssignOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferTarget, setTransferTarget] = useState<HostelAllocation | null>(null);
  const [beds, setBeds] = useState<HostelBed[]>([]);
  const [saving, setSaving] = useState(false);

  const [assignForm, setAssignForm] = useState({
    class_name: "",
    student_id: "",
    block_id: "",
    room_id: "",
    bed_id: "",
    check_in_date: new Date().toISOString().slice(0, 10),
    expected_check_out_date: "",
    fee_amount: "",
  });

  const [transferForm, setTransferForm] = useState({
    block_id: "",
    room_id: "",
    bed_id: "",
  });

  const classes = useMemo(
    () => [...new Set(allocations.map((a) => a.class_name).filter(Boolean))].sort(),
    [allocations],
  );

  const studentClassOptions = useMemo(
    () =>
      [...new Set(students.map((s) => s.class_name).filter((c) => c && c !== "—"))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [students],
  );

  const studentsInClass = useMemo(() => {
    if (!assignForm.class_name) return [];
    return students.filter((s) => s.class_name === assignForm.class_name);
  }, [students, assignForm.class_name]);

  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    return allocations.filter((a) => {
      if (filters.hostelId && a.block_id !== filters.hostelId) return false;
      if (filters.className && a.class_name !== filters.className) return false;
      if (filters.paymentStatus && a.payment_status !== filters.paymentStatus) return false;
      if (q) {
        const hay = `${a.student_name} ${a.admission_number} ${a.room_number} ${a.hostel_name}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [allocations, filters]);

  const activeFiltered = filtered.filter((a) => a.allocation_status !== "checked_out");
  const allSelected = activeFiltered.length > 0 && activeFiltered.every((a) => selected.has(a.id));

  const roomsForBlock = (blockId: string) => rooms.filter((r) => r.block_id === blockId);

  useEffect(() => {
    const roomId = assignOpen ? assignForm.room_id : transferForm.room_id;
    if (!roomId) {
      setBeds([]);
      return;
    }
    void fetchBedsForRoom(roomId).then(setBeds).catch(() => setBeds([]));
  }, [assignOpen, assignForm.room_id, transferForm.room_id]);

  const toggleAll = (checked: boolean) => {
    if (checked) setSelected(new Set(activeFiltered.map((a) => a.id)));
    else setSelected(new Set());
  };

  const toggleOne = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleAssign = async () => {
    if (!assignForm.student_id || !assignForm.block_id || !assignForm.room_id) {
      toast.error("Student, hostel, and room are required.");
      return;
    }
    setSaving(true);
    try {
      await assignStudentHostel({
        student_id: assignForm.student_id,
        block_id: assignForm.block_id,
        room_id: assignForm.room_id,
        bed_id: assignForm.bed_id || undefined,
        check_in_date: assignForm.check_in_date,
        expected_check_out_date: assignForm.expected_check_out_date || undefined,
        fee_amount: assignForm.fee_amount ? Number(assignForm.fee_amount) : undefined,
      });
      toast.success("Student assigned to hostel");
      setAssignOpen(false);
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Assignment failed");
    } finally {
      setSaving(false);
    }
  };

  const handleTransfer = async () => {
    if (!transferTarget || !transferForm.block_id || !transferForm.room_id) {
      toast.error("Select a destination hostel and room.");
      return;
    }
    setSaving(true);
    try {
      await assignStudentHostel({
        student_id: transferTarget.student_id,
        block_id: transferForm.block_id,
        room_id: transferForm.room_id,
        bed_id: transferForm.bed_id || undefined,
        fee_amount: transferTarget.fee_amount,
      });
      toast.success("Student transferred");
      setTransferOpen(false);
      setTransferTarget(null);
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Transfer failed");
    } finally {
      setSaving(false);
    }
  };

  const handleCheckout = async (id: string) => {
    try {
      await checkoutAllocation(id);
      toast.success("Student checked out");
      setSelected((prev) => { const n = new Set(prev); n.delete(id); return n; });
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Checkout failed");
    }
  };

  const handleBulkCheckout = async () => {
    const ids = [...selected].filter((id) => {
      const a = allocations.find((x) => x.id === id);
      return a && a.allocation_status !== "checked_out";
    });
    if (!ids.length) return;
    if (!confirm(`Check out ${ids.length} student(s)?`)) return;
    setSaving(true);
    try {
      for (const id of ids) await checkoutAllocation(id);
      toast.success(`${ids.length} student(s) checked out`);
      setSelected(new Set());
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bulk checkout failed");
    } finally {
      setSaving(false);
    }
  };

  const openTransfer = (allocation: HostelAllocation) => {
    setTransferTarget(allocation);
    setTransferForm({ block_id: "", room_id: "", bed_id: "" });
    setTransferOpen(true);
  };

  return (
    <div className="space-y-4">
      <HostelFiltersBar
        filters={filters}
        onChange={setFilters}
        hostels={hostels.map((h) => ({ id: h.id, name: h.name }))}
        classes={classes}
        showPayment
      />

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">Student Allocations</CardTitle>
            <CardDescription>Assign, transfer, and check out hostel residents.</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            {selected.size > 0 && access.canEdit ? (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void handleBulkCheckout()} disabled={saving}>
                <LogOut className="h-4 w-4" />
                Bulk checkout ({selected.size})
              </Button>
            ) : null}
            {access.canCreate ? (
              <Dialog open={assignOpen} onOpenChange={(v) => {
                setAssignOpen(v);
                if (!v) {
                  setAssignForm({
                    class_name: "",
                    student_id: "",
                    block_id: "",
                    room_id: "",
                    bed_id: "",
                    check_in_date: new Date().toISOString().slice(0, 10),
                    expected_check_out_date: "",
                    fee_amount: "",
                  });
                }
              }}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-1.5">
                    <UserPlus className="h-4 w-4" />
                    Assign student
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader><DialogTitle>Assign student to hostel</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label>Class</Label>
                      <Select
                        value={assignForm.class_name || undefined}
                        onValueChange={(v) =>
                          setAssignForm({ ...assignForm, class_name: v, student_id: "" })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select class first" />
                        </SelectTrigger>
                        <SelectContent>
                          {studentClassOptions.map((c) => (
                            <SelectItem key={c} value={c}>
                              {c}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Student</Label>
                      <Select
                        value={assignForm.student_id || undefined}
                        onValueChange={(v) => setAssignForm({ ...assignForm, student_id: v })}
                        disabled={!assignForm.class_name}
                      >
                        <SelectTrigger>
                          <SelectValue
                            placeholder={
                              assignForm.class_name
                                ? `Select student (${studentsInClass.length})`
                                : "Select class first"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {studentsInClass.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name} ({s.admission})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Hostel</Label>
                      <Select value={assignForm.block_id} onValueChange={(v) => setAssignForm({ ...assignForm, block_id: v, room_id: "", bed_id: "" })}>
                        <SelectTrigger><SelectValue placeholder="Select hostel" /></SelectTrigger>
                        <SelectContent>
                          {hostels.map((h) => (
                            <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Room</Label>
                      <Select value={assignForm.room_id} onValueChange={(v) => setAssignForm({ ...assignForm, room_id: v, bed_id: "" })} disabled={!assignForm.block_id}>
                        <SelectTrigger><SelectValue placeholder="Select room" /></SelectTrigger>
                        <SelectContent>
                          {roomsForBlock(assignForm.block_id).map((r) => (
                            <SelectItem key={r.id} value={r.id}>
                              {r.room_number} ({r.occupied}/{r.capacity})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {beds.length > 0 ? (
                      <div className="space-y-1.5">
                        <Label>Bed (optional)</Label>
                        <Select value={assignForm.bed_id || "none"} onValueChange={(v) => setAssignForm({ ...assignForm, bed_id: v === "none" ? "" : v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Auto-assign</SelectItem>
                            {beds.filter((b) => b.status === "available").map((b) => (
                              <SelectItem key={b.id} value={b.id}>Bed {b.bed_number}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : null}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>Check-in</Label>
                        <Input type="date" value={assignForm.check_in_date} onChange={(e) => setAssignForm({ ...assignForm, check_in_date: e.target.value })} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Expected checkout</Label>
                        <Input type="date" value={assignForm.expected_check_out_date} onChange={(e) => setAssignForm({ ...assignForm, expected_check_out_date: e.target.value })} />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Fee amount</Label>
                      <Input type="number" min={0} value={assignForm.fee_amount} onChange={(e) => setAssignForm({ ...assignForm, fee_amount: e.target.value })} />
                    </div>
                    <Button onClick={() => void handleAssign()} disabled={saving}>
                      {saving ? "Saving…" : "Assign"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox checked={allSelected} onCheckedChange={(v) => toggleAll(!!v)} aria-label="Select all" />
                </TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Admission</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Hostel</TableHead>
                <TableHead>Room</TableHead>
                <TableHead>Bed</TableHead>
                <TableHead>Check-in</TableHead>
                <TableHead>Fee</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>
                    {a.allocation_status !== "checked_out" ? (
                      <Checkbox checked={selected.has(a.id)} onCheckedChange={(v) => toggleOne(a.id, !!v)} />
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={a.avatar_url ?? undefined} alt={a.student_name} />
                        <AvatarFallback className="text-xs">{initials(a.student_name)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{a.student_name}</p>
                        {a.gender ? <p className="text-xs text-muted-foreground">{a.gender}</p> : null}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{a.admission_number}</TableCell>
                  <TableCell>{a.class_name}</TableCell>
                  <TableCell>{a.hostel_name}</TableCell>
                  <TableCell>{a.room_number}</TableCell>
                  <TableCell>{a.bed_number ?? "—"}</TableCell>
                  <TableCell>{a.check_in_date}</TableCell>
                  <TableCell>{formatMoney(a.fee_amount)}</TableCell>
                  <TableCell>{formatMoney(a.amount_paid)}</TableCell>
                  <TableCell>{paymentStatusBadge(a.payment_status)}</TableCell>
                  <TableCell>{allocationStatusBadge(a.allocation_status)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {access.canEdit && a.allocation_status !== "checked_out" ? (
                        <>
                          <Button variant="ghost" size="icon" title="Transfer" onClick={() => openTransfer(a)}>
                            <ArrowRightLeft className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" title="Checkout" onClick={() => void handleCheckout(a.id)}>
                            <LogOut className="h-4 w-4" />
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={transferOpen} onOpenChange={(v) => { setTransferOpen(v); if (!v) setTransferTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Transfer {transferTarget?.student_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Destination hostel</Label>
              <Select value={transferForm.block_id} onValueChange={(v) => setTransferForm({ block_id: v, room_id: "", bed_id: "" })}>
                <SelectTrigger><SelectValue placeholder="Select hostel" /></SelectTrigger>
                <SelectContent>
                  {hostels.map((h) => (
                    <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Destination room</Label>
              <Select value={transferForm.room_id} onValueChange={(v) => setTransferForm({ ...transferForm, room_id: v, bed_id: "" })} disabled={!transferForm.block_id}>
                <SelectTrigger><SelectValue placeholder="Select room" /></SelectTrigger>
                <SelectContent>
                  {roomsForBlock(transferForm.block_id).map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.room_number}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {beds.length > 0 ? (
              <div className="space-y-1.5">
                <Label>Bed (optional)</Label>
                <Select value={transferForm.bed_id || "none"} onValueChange={(v) => setTransferForm({ ...transferForm, bed_id: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Auto-assign</SelectItem>
                    {beds.filter((b) => b.status === "available").map((b) => (
                      <SelectItem key={b.id} value={b.id}>Bed {b.bed_number}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <Button onClick={() => void handleTransfer()} disabled={saving}>
              {saving ? "Transferring…" : "Transfer student"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
