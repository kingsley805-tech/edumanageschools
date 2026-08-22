import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { invokeEdgeFunction } from "@/lib/invokeEdgeFunction";
import { toast } from "sonner";
import { RefreshCw, Send } from "lucide-react";
import { ExportMenu } from "@/modules/lib/ExportMenu";

type SummaryRow = {
  id: string;
  summary_date: string;
  payload: Record<string, unknown>;
  delivered_at: string | null;
  delivery_status: string;
};

export default function DailySummaryPage() {
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [summaries, setSummaries] = useState<SummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [timezone, setTimezone] = useState("Africa/Accra");
  const [time, setTime] = useState("10:00");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("school_id")
        .eq("id", user.id)
        .maybeSingle();
      if (!profile?.school_id) return;
      setSchoolId(profile.school_id);

      const { data: settings } = await supabase
        .from("school_settings")
        .select("timezone, daily_summary_enabled, daily_summary_time")
        .eq("school_id", profile.school_id)
        .maybeSingle();

      if (settings) {
        setTimezone((settings as any).timezone || "Africa/Accra");
        setEnabled((settings as any).daily_summary_enabled ?? true);
        const t = String((settings as any).daily_summary_time || "10:00");
        setTime(t.slice(0, 5));
      }

      const { data } = await supabase
        .from("daily_school_summaries")
        .select("id, summary_date, payload, delivered_at, delivery_status")
        .eq("school_id", profile.school_id)
        .order("summary_date", { ascending: false })
        .limit(14);
      setSummaries((data as SummaryRow[]) || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const saveSettings = async () => {
    if (!schoolId) return;
    setSaving(true);
    try {
      const { data: existing } = await supabase
        .from("school_settings")
        .select("id")
        .eq("school_id", schoolId)
        .maybeSingle();

      const patch = {
        timezone,
        daily_summary_enabled: enabled,
        daily_summary_time: time.length === 5 ? `${time}:00` : time,
        school_id: schoolId,
      };

      if (existing?.id) {
        const { error } = await supabase.from("school_settings").update(patch).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("school_settings").insert(patch);
        if (error) throw error;
      }
      toast.success("Daily summary settings saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    if (!schoolId) return;
    setSending(true);
    try {
      await invokeEdgeFunction("daily-school-summary", {
        manual: true,
        force: true,
        school_id: schoolId,
      });
      toast.success("Test summary generated and delivered");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send test summary");
    } finally {
      setSending(false);
    }
  };

  const latest = summaries[0];
  const payload = (latest?.payload ?? {}) as {
    attendance?: {
      total_students?: number;
      present?: number;
      absent?: number;
      percentage?: number | null;
      unusual_absence_classes?: unknown[];
    };
    academic?: {
      results_entered?: number;
      assignments_created?: number;
      assignments_submitted?: number;
      upcoming_examinations?: number;
    };
    teachers?: { attendance_registers_submitted?: number };
    students?: { new_students?: number };
    alerts?: { announcements?: number; attendance_concerns?: number };
  };

  return (
    <DashboardLayout role="admin">
      <div className="flex flex-wrap items-center lg:items-end justify-between gap-5 pb-7.5">
        <div className="flex min-w-0 flex-col justify-center gap-2">
          <h1 className="text-xl font-medium leading-none text-mono">Daily School Summary</h1>
          <p className="text-sm text-secondary-foreground">
            Automated previous-day digest for administrators (default 10:00, Africa/Accra).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportMenu
            filename="daily-school-summaries"
            title="Daily School Summary History"
            headers={["Date", "Status", "Delivered"]}
            rows={summaries.map((s) => [
              s.summary_date,
              s.delivery_status,
              s.delivered_at ? new Date(s.delivered_at).toLocaleString() : "—",
            ])}
            disabled={summaries.length === 0}
          />
          <Button type="button" variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button type="button" onClick={() => void sendTest()} disabled={sending || !schoolId}>
            <Send className="h-4 w-4 mr-2" />
            {sending ? "Sending…" : "Send test summary"}
          </Button>
        </div>
      </div>

      <div className="kt-card mb-5 lg:mb-7.5">
        <div className="kt-card-header">
          <h3 className="kt-card-title">Schedule</h3>
        </div>
        <div className="kt-card-content p-5 lg:p-7.5 grid gap-4 sm:grid-cols-3">
          <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <Label htmlFor="summary-enabled">Daily Summary</Label>
            <Switch id="summary-enabled" checked={enabled} onCheckedChange={setEnabled} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="summary-tz">Timezone</Label>
            <Input id="summary-tz" value={timezone} onChange={(e) => setTimezone(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="summary-time">Time</Label>
            <Input
              id="summary-time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>
          <div className="sm:col-span-3">
            <Button type="button" onClick={() => void saveSettings()} disabled={saving}>
              {saving ? "Saving…" : "Save schedule"}
            </Button>
          </div>
        </div>
      </div>

      {latest ? (
        <div className="kt-card mb-5 lg:mb-7.5">
          <div className="kt-card-header flex flex-wrap items-center justify-between gap-2">
            <h3 className="kt-card-title">Latest — {latest.summary_date}</h3>
            <Badge variant="outline">{latest.delivery_status}</Badge>
          </div>
          <div className="kt-card-content p-5 lg:p-7.5 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-2xl font-semibold">{payload.attendance?.percentage ?? "—"}%</div>
              <div className="text-xs text-muted-foreground">Attendance</div>
            </div>
            <div>
              <div className="text-2xl font-semibold">
                {payload.attendance?.present ?? 0}/{payload.attendance?.absent ?? 0}
              </div>
              <div className="text-xs text-muted-foreground">Present / Absent</div>
            </div>
            <div>
              <div className="text-2xl font-semibold">{payload.academic?.results_entered ?? 0}</div>
              <div className="text-xs text-muted-foreground">Results entered</div>
            </div>
            <div>
              <div className="text-2xl font-semibold">
                {payload.teachers?.attendance_registers_submitted ?? 0}
              </div>
              <div className="text-xs text-muted-foreground">Registers submitted</div>
            </div>
            <div>
              <div className="text-2xl font-semibold">{payload.academic?.assignments_created ?? 0}</div>
              <div className="text-xs text-muted-foreground">Assignments created</div>
            </div>
            <div>
              <div className="text-2xl font-semibold">{payload.academic?.assignments_submitted ?? 0}</div>
              <div className="text-xs text-muted-foreground">Assignments submitted</div>
            </div>
            <div>
              <div className="text-2xl font-semibold">{payload.academic?.upcoming_examinations ?? 0}</div>
              <div className="text-xs text-muted-foreground">Upcoming exams (7d)</div>
            </div>
            <div>
              <div className="text-2xl font-semibold">{payload.alerts?.attendance_concerns ?? 0}</div>
              <div className="text-xs text-muted-foreground">Attendance concerns</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="kt-card mb-5 lg:mb-7.5">
          <div className="kt-card-content p-8 text-center text-sm text-muted-foreground">
            {loading ? "Loading…" : "No summaries yet. Use Send test summary to generate one."}
          </div>
        </div>
      )}

      <div className="kt-card">
        <div className="kt-card-header">
          <h3 className="kt-card-title">History</h3>
        </div>
        <div className="kt-card-content p-0">
          <table className="kt-table w-full">
            <thead>
              <tr>
                <th className="text-left p-3">Date</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Delivered</th>
              </tr>
            </thead>
            <tbody>
              {summaries.map((s) => (
                <tr key={s.id} className="border-t">
                  <td className="p-3 font-mono text-sm">{s.summary_date}</td>
                  <td className="p-3">
                    <Badge variant="outline">{s.delivery_status}</Badge>
                  </td>
                  <td className="p-3 text-sm text-muted-foreground">
                    {s.delivered_at ? new Date(s.delivered_at).toLocaleString() : "—"}
                  </td>
                </tr>
              ))}
              {!summaries.length && !loading && (
                <tr>
                  <td colSpan={3} className="p-6 text-center text-muted-foreground text-sm">
                    No history
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
}
