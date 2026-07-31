import { useCallback, useEffect, useState } from "react";
import { CalendarOff, Download, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

type LeaveRow = {
  id: string;
  staff_name: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  status: string;
  reason: string | null;
};

const LEAVE_TYPES = ["Annual", "Sick", "Maternity", "Paternity", "Unpaid", "Other"];
const STATUSES = ["pending", "approved", "rejected", "cancelled"];

export default function LeaveManagementPage() {
  const { currentSchool } = useSchoolInfo();
  const schoolId = currentSchool?.id ?? null;
  const access = useModuleAccess("leave_management");
  const [rows, setRows] = useState<LeaveRow[]>([]);
  const [staffOptions, setStaffOptions] = useState<{ id: string; name: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [staffId, setStaffId] = useState("");
  const [leaveType, setLeaveType] = useState("Annual");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
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
      .from("hr_leave_requests")
      .select("id, staff_user_id, leave_type, start_date, end_date, status, reason")
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false });

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
        leave_type: r.leave_type,
        start_date: r.start_date,
        end_date: r.end_date,
        status: r.status,
        reason: r.reason,
      })),
    );
  }, [schoolId]);

  const loadStaff = useCallback(async () => {
    if (!schoolId) return;
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("school_id", schoolId)
      .order("full_name");
    setStaffOptions((data ?? []).map((p) => ({ id: p.id, name: p.full_name ?? "Staff" })));
  }, [schoolId]);

  useEffect(() => {
    void load();
    void loadStaff();
  }, [load, loadStaff]);

  const create = async () => {
    if (!schoolId || !staffId || !startDate || !endDate) {
      toast.error("Fill in required fields.");
      return;
    }
    const { error } = await supabase.from("hr_leave_requests").insert({
      school_id: schoolId,
      staff_user_id: staffId,
      leave_type: leaveType,
      start_date: startDate,
      end_date: endDate,
      reason: reason.trim() || null,
      status: "pending",
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Leave request created");
    setOpen(false);
    setReason("");
    void load();
  };

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("hr_leave_requests").update({ status }).eq("id", id);
    if (error) toast.error(error.message);
    else void load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("hr_leave_requests").delete().eq("id", id);
    if (error) toast.error(error.message);
    else void load();
  };

  if (!access.canView) return <ModuleAccessDenied label="Leave Management" />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <CalendarOff className="h-6 w-6" />
            Leave Management
          </h1>
          <p className="text-sm text-muted-foreground">Track and approve staff leave requests.</p>
        </div>
        <div className="flex gap-2">
          {access.canExport ? (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() =>
                downloadCsv(
                  "leave-requests.csv",
                  ["Staff", "Type", "Start", "End", "Status", "Reason"],
                  rows.map((r) => [r.staff_name, r.leave_type, r.start_date, r.end_date, r.status, r.reason]),
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
                  New request
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New leave request</DialogTitle>
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
                    <Label>Leave type</Label>
                    <Select value={leaveType} onValueChange={setLeaveType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LEAVE_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Start date</Label>
                      <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>End date</Label>
                      <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Reason</Label>
                    <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
                  </div>
                  <Button onClick={() => void create()}>Save request</Button>
                </div>
              </DialogContent>
            </Dialog>
          ) : null}
        </div>
      </div>

      {schemaMissing ? <OperationsSchemaSetupCard moduleLabel="Leave Management" /> : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Leave requests</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Staff</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.staff_name}</TableCell>
                  <TableCell>{r.leave_type}</TableCell>
                  <TableCell>
                    {format(new Date(r.start_date), "dd MMM yyyy")} –{" "}
                    {format(new Date(r.end_date), "dd MMM yyyy")}
                  </TableCell>
                  <TableCell>
                    <Badge variant={r.status === "approved" ? "success" : r.status === "rejected" ? "destructive" : "secondary"}>{r.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {access.canEdit ? (
                      <Select value={r.status} onValueChange={(v) => void updateStatus(r.id, v)}>
                        <SelectTrigger className="h-8 w-[120px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUSES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : null}
                    {access.canDelete ? (
                      <Button variant="ghost" size="icon" className="ml-1" onClick={() => void remove(r.id)}>
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
