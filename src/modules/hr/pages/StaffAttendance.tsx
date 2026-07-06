import { useCallback, useEffect, useState } from "react";
import { ClipboardCheck, Download, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useSchoolInfo } from "@/hooks/useSchoolInfo";
import { useModuleAccess } from "@/modules/lib/useModuleAccess";
import { ModuleAccessDenied } from "@/modules/lib/ModuleAccessDenied";
import { downloadCsv } from "@/modules/lib/exportCsv";
import { isMissingTableError, operationsSchemaSetupMessage } from "@/modules/lib/missingSchema";
import { OperationsSchemaSetupCard } from "@/modules/lib/OperationsSchemaSetupCard";
import { toast } from "sonner";
import { format } from "date-fns";

type AttendanceRow = {
  id: string;
  staff_name: string;
  attendance_date: string;
  status: string;
  check_in: string | null;
  check_out: string | null;
  notes: string | null;
};

const STATUSES = ["present", "absent", "late", "half_day", "on_leave"];

export default function StaffAttendancePage() {
  const { currentSchool } = useSchoolInfo();
  const schoolId = currentSchool?.id ?? null;
  const access = useModuleAccess("staff_attendance");
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [staffOptions, setStaffOptions] = useState<{ id: string; name: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [staffId, setStaffId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState("present");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [notes, setNotes] = useState("");
  const [schemaMissing, setSchemaMissing] = useState(false);

  const handleDbError = (error: { code?: string; message?: string; status?: number }) => {
    if (isMissingTableError(error)) {
      setSchemaMissing(true);
      toast.error(operationsSchemaSetupMessage());
      return true;
    }
    toast.error(error.message ?? "Request failed");
    return false;
  };

  const load = useCallback(async () => {
    if (!schoolId) return;
    const { data, error } = await supabase
      .from("hr_staff_attendance")
      .select("id, staff_user_id, attendance_date, status, check_in, check_out, notes")
      .eq("school_id", schoolId)
      .order("attendance_date", { ascending: false });

    if (error) {
      handleDbError(error);
      return;
    }

    setSchemaMissing(false);

    const staffIds = [...new Set((data ?? []).map((r) => r.staff_user_id))];
    const nameMap = new Map<string, string>();
    if (staffIds.length) {
      const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", staffIds);
      for (const p of profiles ?? []) {
        nameMap.set(p.id, p.full_name ?? "Staff");
      }
    }

    setRows(
      (data ?? []).map((r) => ({
        id: r.id,
        staff_name: nameMap.get(r.staff_user_id) ?? "Staff",
        attendance_date: r.attendance_date,
        status: r.status,
        check_in: r.check_in,
        check_out: r.check_out,
        notes: r.notes,
      })),
    );
  }, [schoolId]);

  const loadStaff = useCallback(async () => {
    if (!schoolId) return;
    const { data } = await supabase.from("profiles").select("id, full_name").eq("school_id", schoolId).order("full_name");
    setStaffOptions((data ?? []).map((p) => ({ id: p.id, name: p.full_name ?? "Staff" })));
  }, [schoolId]);

  useEffect(() => {
    void load();
    void loadStaff();
  }, [load, loadStaff]);

  const create = async () => {
    if (!schoolId || !staffId || !date) {
      toast.error("Fill in required fields.");
      return;
    }
    const { error } = await supabase.from("hr_staff_attendance").insert({
      school_id: schoolId,
      staff_user_id: staffId,
      attendance_date: date,
      status,
      check_in: checkIn || null,
      check_out: checkOut || null,
      notes: notes.trim() || null,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Attendance recorded");
    setOpen(false);
    void load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("hr_staff_attendance").delete().eq("id", id);
    if (error) toast.error(error.message);
    else void load();
  };

  if (!access.canView) return <ModuleAccessDenied label="Staff Attendance" />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <ClipboardCheck className="h-6 w-6" />
            Staff Attendance
          </h1>
          <p className="text-sm text-muted-foreground">Daily staff attendance register.</p>
        </div>
        <div className="flex gap-2">
          {access.canExport ? (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() =>
                downloadCsv(
                  "staff-attendance.csv",
                  ["Staff", "Date", "Status", "Check in", "Check out", "Notes"],
                  rows.map((r) => [r.staff_name, r.attendance_date, r.status, r.check_in, r.check_out, r.notes]),
                )
              }
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
          ) : null}
          {access.canCreate ? (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5">
                  <Plus className="h-4 w-4" />
                  Record attendance
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Record staff attendance</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Staff member</Label>
                    <Select value={staffId} onValueChange={setStaffId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select staff" />
                      </SelectTrigger>
                      <SelectContent>
                        {staffOptions.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Date</Label>
                    <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Status</Label>
                    <Select value={status} onValueChange={setStatus}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s.replace("_", " ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Check in</Label>
                      <Input type="time" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Check out</Label>
                      <Input type="time" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Notes</Label>
                    <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
                  </div>
                  <Button onClick={() => void create()}>Save</Button>
                </div>
              </DialogContent>
            </Dialog>
          ) : null}
        </div>
      </div>

      {schemaMissing ? <OperationsSchemaSetupCard moduleLabel="Staff Attendance" /> : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Attendance records</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Staff</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Times</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.staff_name}</TableCell>
                  <TableCell>{format(new Date(r.attendance_date), "dd MMM yyyy")}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{r.status.replace("_", " ")}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {r.check_in ?? "—"} – {r.check_out ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {access.canDelete ? (
                      <Button variant="ghost" size="icon" onClick={() => void remove(r.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
