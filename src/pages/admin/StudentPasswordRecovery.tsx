// @ts-nocheck
import { useCallback, useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  adminResetStudentPassword,
  fetchStudentPasswordRecoveryOverview,
  processStudentPasswordResetRequest,
  resetStatusLabel,
  resetStatusVariant,
  type StudentRecoveryRow,
} from "@/lib/studentPasswordRecovery";
import {
  Bell,
  CheckCircle2,
  Copy,
  KeyRound,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Smartphone,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import { format } from "date-fns";
import { ExportMenu } from "@/modules/lib/ExportMenu";

const StudentPasswordRecovery = () => {
  const { schoolId } = usePermissions();
  const [rows, setRows] = useState<StudentRecoveryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [resettingUserId, setResettingUserId] = useState<string | null>(null);
  const [tempPasswordModal, setTempPasswordModal] = useState<{
    name: string;
    admissionNumber: string;
    password: string;
    parentDashboard: boolean;
    sms: boolean;
  } | null>(null);

  const load = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const data = await fetchStudentPasswordRecoveryOverview(schoolId);
      setRows(data);
    } catch (err: any) {
      toast.error(err?.message ?? "Could not load student recovery data.");
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!schoolId) return;
    const channel = supabase
      .channel(`student-pw-reset-${schoolId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "student_password_reset_requests",
          filter: `school_id=eq.${schoolId}`,
        },
        () => void load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [schoolId, load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.student_name.toLowerCase().includes(q) ||
        r.admission_number.toLowerCase().includes(q) ||
        r.parent_name.toLowerCase().includes(q) ||
        r.parent_phone.toLowerCase().includes(q),
    );
  }, [rows, search]);

  const pendingRows = useMemo(
    () => filtered.filter((r) => r.reset_status === "pending"),
    [filtered],
  );

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard.");
    } catch {
      toast.error("Could not copy.");
    }
  };

  const showResultModal = (
    result: {
      student_name?: string;
      admission_number?: string;
      temporary_password?: string;
      parent_dashboard_delivered?: boolean;
      sms_delivered?: boolean;
    },
    fallbackName: string,
    fallbackAdmission: string,
  ) => {
    if (!result.temporary_password) return;
    setTempPasswordModal({
      name: result.student_name ?? fallbackName,
      admissionNumber: result.admission_number ?? fallbackAdmission,
      password: result.temporary_password,
      parentDashboard: !!result.parent_dashboard_delivered,
      sms: !!result.sms_delivered,
    });
  };

  const processRequest = async (row: StudentRecoveryRow) => {
    if (!row.reset_request_id) return;
    if (
      !confirm(
        `Verify admission number ${row.admission_number} and generate a temporary password for ${row.student_name}? This will notify the parent/guardian.`,
      )
    ) {
      return;
    }
    setProcessingId(row.reset_request_id);
    try {
      const result = await processStudentPasswordResetRequest(row.reset_request_id);
      if (!result.ok) throw new Error(result.message ?? "Processing failed");
      showResultModal(result, row.student_name, row.admission_number);
      toast.success("Password reset processed.");
      await load();
    } catch (err: any) {
      toast.error(err?.message ?? "Could not process request.");
    } finally {
      setProcessingId(null);
    }
  };

  const directReset = async (row: StudentRecoveryRow) => {
    if (
      !confirm(
        `Generate a temporary password for ${row.student_name} (${row.admission_number})? Parent/guardian will be notified if contact details exist.`,
      )
    ) {
      return;
    }
    setResettingUserId(row.student_user_id);
    try {
      const result = await adminResetStudentPassword(row.student_user_id);
      if (!result.ok) throw new Error(result.message ?? "Reset failed");
      showResultModal(result, row.student_name, row.admission_number);
      toast.success("Temporary password generated.");
      await load();
    } catch (err: any) {
      toast.error(err?.message ?? "Could not reset password.");
    } finally {
      setResettingUserId(null);
    }
  };

  const renderDeliveryBadges = (row: StudentRecoveryRow) => {
    if (row.reset_status !== "completed") return "—";
    return (
      <div className="flex flex-wrap gap-1">
        <Badge variant={row.parent_notification_sent ? "default" : "outline"} className="text-[10px]">
          {row.parent_notification_sent ? (
            <><CheckCircle2 className="h-3 w-3 mr-0.5" /> Dashboard</>
          ) : (
            <><XCircle className="h-3 w-3 mr-0.5" /> Dashboard</>
          )}
        </Badge>
        <Badge variant={row.sms_sent ? "default" : "outline"} className="text-[10px]">
          {row.sms_sent ? (
            <><Smartphone className="h-3 w-3 mr-0.5" /> SMS</>
          ) : (
            <><XCircle className="h-3 w-3 mr-0.5" /> SMS</>
          )}
        </Badge>
      </div>
    );
  };

  const renderTable = (data: StudentRecoveryRow[], showProcess = false) => (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Student</TableHead>
            <TableHead>Admission No.</TableHead>
            <TableHead>Parent / Guardian</TableHead>
            <TableHead>Parent Phone</TableHead>
            <TableHead>Parent Dashboard</TableHead>
            <TableHead>Reset Status</TableHead>
            <TableHead>Delivery</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                {loading ? "Loading…" : "No students found."}
              </TableCell>
            </TableRow>
          ) : (
            data.map((row) => (
              <TableRow key={row.student_id}>
                <TableCell>
                  <div className="font-medium">{row.student_name}</div>
                  <div className="text-xs text-muted-foreground">{row.class_name}</div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="font-mono text-xs">
                    {row.admission_number}
                  </Badge>
                </TableCell>
                <TableCell>{row.parent_name}</TableCell>
                <TableCell className="text-sm">{row.parent_phone}</TableCell>
                <TableCell>
                  <Badge variant={row.parent_has_dashboard ? "default" : "secondary"}>
                    {row.parent_has_dashboard ? "Active" : "Not linked"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <Badge variant={resetStatusVariant(row.reset_status)}>
                      {resetStatusLabel(row.reset_status)}
                    </Badge>
                    {row.reset_requested_at && (
                      <div className="text-[10px] text-muted-foreground">
                        {format(new Date(row.reset_requested_at), "PPp")}
                      </div>
                    )}
                    {row.processed_by_name && row.processed_by_name !== "—" && (
                      <div className="text-[10px] text-muted-foreground">
                        by {row.processed_by_name}
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>{renderDeliveryBadges(row)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    {showProcess && row.reset_request_id && row.reset_status === "pending" && (
                      <Button
                        size="sm"
                        onClick={() => processRequest(row)}
                        disabled={processingId === row.reset_request_id}
                      >
                        {processingId === row.reset_request_id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>Process</>
                        )}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => directReset(row)}
                      disabled={resettingUserId === row.student_user_id}
                    >
                      {resettingUserId === row.student_user_id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <><KeyRound className="h-3.5 w-3.5 mr-1" /> Reset</>
                      )}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <DashboardLayout role="admin">
      <div className="mingo-content space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="font-display text-[21px] font-semibold tracking-tight text-foreground flex items-center gap-2">
              <KeyRound className="h-5 w-5" /> Student Password Recovery
            </h1>
            <p className="text-[12.5px] text-muted-foreground mt-1 max-w-2xl">
              Review student password reset requests, verify admission numbers, and issue secure temporary passwords.
              Passwords are never stored in plain text — only new temporary passwords are generated at reset time.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => load()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        <Alert>
          <ShieldCheck className="h-4 w-4" />
          <AlertTitle>Secure workflow</AlertTitle>
          <AlertDescription>
            Students submit reset requests from the login page using their admission number. You verify each request,
            generate a one-time temporary password, and the system delivers it to the parent dashboard and registered
            parent phone when available. All actions are recorded in audit logs.
          </AlertDescription>
        </Alert>

        {pendingRows.length > 0 && (
          <Alert variant="destructive">
            <Bell className="h-4 w-4" />
            <AlertTitle>{pendingRows.length} pending request{pendingRows.length === 1 ? "" : "s"}</AlertTitle>
            <AlertDescription>
              Students are waiting for password recovery. Process pending requests in the Pending Requests tab.
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Search students</CardTitle>
            <CardDescription>Filter by name, admission number, or parent contact.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative max-w-md flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <ExportMenu
                filename="student-password-recovery"
                title="Student Password Recovery"
                headers={[
                  "Student",
                  "Admission No.",
                  "Parent / Guardian",
                  "Parent Phone",
                  "Parent Dashboard",
                  "Reset Status",
                  "Delivery",
                ]}
                rows={filtered.map((row) => [
                  `${row.student_name}${row.class_name ? ` (${row.class_name})` : ""}`,
                  row.admission_number,
                  row.parent_name,
                  row.parent_phone,
                  row.parent_has_dashboard ? "Active" : "Not linked",
                  resetStatusLabel(row.reset_status),
                  row.reset_status === "completed"
                    ? [
                        row.parent_notification_sent ? "Dashboard" : null,
                        row.sms_sent ? "SMS" : null,
                      ]
                        .filter(Boolean)
                        .join(", ") || "—"
                    : "—",
                ])}
                disabled={filtered.length === 0}
              />
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue={pendingRows.length > 0 ? "pending" : "all"}>
          <TabsList>
            <TabsTrigger value="pending" className="gap-1.5">
              Pending Requests
              {pendingRows.length > 0 && (
                <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">
                  {pendingRows.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="all">All Students</TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Pending password reset requests</CardTitle>
                <CardDescription>
                  Verify the admission number, then process to generate a temporary password and notify the parent.
                </CardDescription>
              </CardHeader>
              <CardContent>{renderTable(pendingRows, true)}</CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="all" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>All registered students</CardTitle>
                <CardDescription>
                  Full roster with parent/guardian contact and latest password reset status.
                </CardDescription>
              </CardHeader>
              <CardContent>{renderTable(filtered)}</CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {tempPasswordModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5" /> Temporary password issued
              </CardTitle>
              <CardDescription>
                <strong>{tempPasswordModal.name}</strong> ·{" "}
                <span className="font-mono">{tempPasswordModal.admissionNumber}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  This password is shown <strong>once</strong>. Copy it now. The student must change it on next login.
                </AlertDescription>
              </Alert>

              <div>
                <Label className="text-xs">Temporary password</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    readOnly
                    value={tempPasswordModal.password}
                    className="font-mono text-lg tracking-wider"
                  />
                  <Button type="button" variant="outline" onClick={() => copy(tempPasswordModal.password)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant={tempPasswordModal.parentDashboard ? "default" : "outline"}>
                  Parent dashboard: {tempPasswordModal.parentDashboard ? "Sent" : "Not delivered"}
                </Badge>
                <Badge variant={tempPasswordModal.sms ? "default" : "outline"}>
                  SMS: {tempPasswordModal.sms ? "Sent" : "Not delivered"}
                </Badge>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={() => setTempPasswordModal(null)}>
                  I've copied it
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </DashboardLayout>
  );
};

export default StudentPasswordRecovery;
