// @ts-nocheck
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { fetchAttendanceStatusTypes } from "@/register/lib/api";
import {
  fetchAttendanceSmsStats,
  fetchRegisterSmsSettings,
  listAttendanceSmsLogs,
  saveRegisterSmsSettings,
  type AttendanceSmsStats,
  type RegisterSmsSettings,
} from "@/register/lib/sms";

const TEMPLATE_HINT = "Placeholders: {school_name}, {student_name}, {date}, {status}";

export function RegisterSettings({ schoolId, embedded }: { schoolId: string; embedded?: boolean }) {
  const [statuses, setStatuses] = useState([]);
  const [sms, setSms] = useState<RegisterSmsSettings>({
    sms_sender_id: "",
    sms_attendance_enabled: true,
    sms_notify_absent: true,
    sms_notify_late: true,
    sms_notify_present: false,
    sms_template_present: "",
    sms_template_absent: "",
    sms_template_late: "",
    sms_template_default: "",
  });
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState<AttendanceSmsStats>({ sent: 0, failed: 0, skipped: 0, total: 0 });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void fetchAttendanceStatusTypes(schoolId).then(setStatuses);
    void fetchRegisterSmsSettings(schoolId).then(setSms);
    void listAttendanceSmsLogs(schoolId, 20).then(setLogs);
    void fetchAttendanceSmsStats(schoolId).then(setStats);
  }, [schoolId]);

  const saveSms = async () => {
    setSaving(true);
    try {
      await saveRegisterSmsSettings(schoolId, sms);
      toast.success("SMS settings saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save SMS settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className={embedded ? "border-border/80" : ""}>
        <CardHeader>
          <CardTitle>Attendance status types</CardTitle>
          <CardDescription>Labels and colors used in the daily register table.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {statuses.map((s) => (
            <Badge
              key={s.id}
              variant="outline"
              style={{ borderColor: s.color, color: s.color, backgroundColor: `${s.color}15` }}
            >
              {s.label}
            </Badge>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Parent attendance SMS
          </CardTitle>
          <CardDescription>
            Sent automatically when teachers save attendance on the Teacher Attendance page or submit the
            daily register. Configure Arkesel API key in Supabase secrets as{" "}
            <code className="text-xs">ARKESEL_API_KEY</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Sent (30 days)</p>
              <p className="text-2xl font-bold">{stats.sent}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Failed</p>
              <p className="text-2xl font-bold text-destructive">{stats.failed}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Skipped</p>
              <p className="text-2xl font-bold">{stats.skipped}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Total logged</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="font-medium text-sm">Enable attendance SMS notifications</p>
              <p className="text-xs text-muted-foreground">Master switch for teacher attendance + register</p>
            </div>
            <Switch
              checked={sms.sms_attendance_enabled}
              onCheckedChange={(v) => setSms({ ...sms, sms_attendance_enabled: v })}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Sender ID (max 11 characters)</Label>
              <Input
                value={sms.sms_sender_id}
                onChange={(e) => setSms({ ...sms, sms_sender_id: e.target.value.slice(0, 11) })}
                placeholder="SchoolShort"
              />
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="font-medium text-sm">Notify when absent / sick / excused</p>
                <p className="text-xs text-muted-foreground">Recommended</p>
              </div>
              <Switch
                checked={sms.sms_notify_absent}
                onCheckedChange={(v) => setSms({ ...sms, sms_notify_absent: v })}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="font-medium text-sm">Notify when late</p>
              </div>
              <Switch
                checked={sms.sms_notify_late}
                onCheckedChange={(v) => setSms({ ...sms, sms_notify_late: v })}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="font-medium text-sm">Notify when present</p>
                <p className="text-xs text-muted-foreground">Optional — uses more SMS credits</p>
              </div>
              <Switch
                checked={sms.sms_notify_present}
                onCheckedChange={(v) => setSms({ ...sms, sms_notify_present: v })}
              />
            </div>
          </div>

          <div className="space-y-3 rounded-lg border p-4">
            <p className="text-sm font-medium">SMS templates</p>
            <p className="text-xs text-muted-foreground">{TEMPLATE_HINT}</p>
            <div className="space-y-2">
              <Label>Present</Label>
              <Textarea
                rows={2}
                value={sms.sms_template_present}
                onChange={(e) => setSms({ ...sms, sms_template_present: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Absent / sick / excused</Label>
              <Textarea
                rows={2}
                value={sms.sms_template_absent}
                onChange={(e) => setSms({ ...sms, sms_template_absent: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Late</Label>
              <Textarea
                rows={2}
                value={sms.sms_template_late}
                onChange={(e) => setSms({ ...sms, sms_template_late: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Other statuses (fallback)</Label>
              <Textarea
                rows={2}
                value={sms.sms_template_default}
                onChange={(e) => setSms({ ...sms, sms_template_default: e.target.value })}
              />
            </div>
          </div>

          <Button onClick={() => void saveSms()} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Save SMS settings
          </Button>
        </CardContent>
      </Card>

      {logs.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Attendance SMS log</CardTitle>
            <CardDescription>Audit trail from teacher attendance and register submissions.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Result</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => {
                  const student = log.students;
                  const name =
                    student?.profiles?.full_name ??
                    student?.full_name ??
                    "—";
                  return (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs whitespace-nowrap">
                        {new Date(log.sent_at ?? log.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-xs">{name}</TableCell>
                      <TableCell className="text-xs capitalize">{log.attendance_status}</TableCell>
                      <TableCell className="text-xs">{log.phone_number ?? "—"}</TableCell>
                      <TableCell className="text-xs capitalize">
                        {log.sms_status}
                        {log.error_message ? (
                          <span className="block text-muted-foreground normal-case">{log.error_message}</span>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
