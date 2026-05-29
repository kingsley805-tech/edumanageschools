// @ts-nocheck
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { fetchAttendanceStatusTypes } from "@/register/lib/api";
import {
  fetchRegisterSmsSettings,
  listSmsLogs,
  saveRegisterSmsSettings,
  type RegisterSmsSettings,
} from "@/register/lib/sms";

export function RegisterSettings({ schoolId, embedded }: { schoolId: string; embedded?: boolean }) {
  const [statuses, setStatuses] = useState([]);
  const [sms, setSms] = useState<RegisterSmsSettings>({
    sms_sender_id: "",
    sms_notify_absent: true,
    sms_notify_late: true,
    sms_notify_present: false,
  });
  const [logs, setLogs] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void fetchAttendanceStatusTypes(schoolId).then(setStatuses);
    void fetchRegisterSmsSettings(schoolId).then(setSms);
    void listSmsLogs(schoolId, 20).then(setLogs);
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
            Parent SMS (Arkesel)
          </CardTitle>
          <CardDescription>
            When a teacher submits attendance, linked parents receive SMS alerts. Configure your
            Arkesel sender ID in Supabase secrets as <code className="text-xs">ARKESEL_API_KEY</code>{" "}
            (never store the key in the browser).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
                <p className="font-medium text-sm">Notify when absent / sick</p>
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
          <Button onClick={() => void saveSms()} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Save SMS settings
          </Button>
        </CardContent>
      </Card>

      {logs.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent SMS log</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs">
                      {new Date(log.sent_at).toLocaleString()}
                    </TableCell>
                    <TableCell>{log.phone_number}</TableCell>
                    <TableCell className="capitalize">{log.sms_status}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
