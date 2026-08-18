// @ts-nocheck
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Loader2, MessageSquare, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { usePlatformSchoolSmsOverview } from "@/platform/hooks/usePlatformDashboard";
import { PlatformArkeselSetupCard } from "@/platform/components/PlatformArkeselSetupCard";

type SmsFilter = "all" | "active" | "inactive";

function smsStatusBadge(enabled: boolean, adminOverride: boolean) {
  if (enabled) {
    return (
      <Badge className="bg-emerald-500/10 text-emerald-700">
        Active{adminOverride ? " · override" : ""}
      </Badge>
    );
  }
  return <Badge variant="outline">Inactive</Badge>;
}

export default function PlatformSmsManagement() {
  const queryClient = useQueryClient();
  const { data: rows = [], isLoading } = usePlatformSchoolSmsOverview();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<SmsFilter>("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const stats = useMemo(() => {
    const active = rows.filter((r) => r.sms_enabled).length;
    const sent30d = rows.reduce((s, r) => s + (r.sms_sent_30d ?? 0), 0);
    return { active, total: rows.length, sent30d };
  }, [rows]);

  const filtered = useMemo(() => {
    let list = rows;
    if (filter === "active") list = list.filter((r) => r.sms_enabled);
    if (filter === "inactive") list = list.filter((r) => !r.sms_enabled);
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (r) =>
        r.school_name.toLowerCase().includes(q) ||
        (r.school_code ?? "").toLowerCase().includes(q) ||
        (r.plan_name ?? "").toLowerCase().includes(q),
    );
  }, [rows, search, filter]);

  const toggleSms = async (schoolId: string, enabled: boolean) => {
    setUpdatingId(schoolId);
    try {
      const { data, error } = await supabase.rpc("set_platform_school_sms", {
        p_school_id: schoolId,
        p_enabled: enabled,
        p_admin_override: true,
      });
      if (error) throw error;
      const result = data as { ok?: boolean; error?: string };
      if (!result?.ok) throw new Error(result?.error ?? "Update failed");
      toast.success(enabled ? "SMS enabled for school" : "SMS disabled for school");
      await queryClient.invalidateQueries({ queryKey: ["platform-school-sms-overview"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update SMS status");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <DashboardLayout role="super_admin">
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Button variant="ghost" size="sm" className="mb-2 -ml-2" asChild>
              <Link to="/platform">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Platform
              </Link>
            </Button>
            <h1 className="text-3xl font-bold tracking-tight">SMS Management</h1>
            <p className="text-muted-foreground">
              View schools with SMS enabled, override settings, and monitor usage
            </p>
          </div>
        </div>

        <PlatformArkeselSetupCard />

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="channel-stats-bg rounded-xl border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">Schools with SMS active</p>
            <p className="text-2xl font-bold">{stats.active}</p>
          </div>
          <div className="channel-stats-bg rounded-xl border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">Total organizations</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </div>
          <div className="channel-stats-bg rounded-xl border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">SMS sent (30 days)</p>
            <p className="text-2xl font-bold">{stats.sent30d.toLocaleString()}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search schools…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={filter} onValueChange={(v) => setFilter(v as SmsFilter)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All schools</SelectItem>
              <SelectItem value="active">SMS active</SelectItem>
              <SelectItem value="inactive">SMS inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
            <MessageSquare className="mx-auto mb-3 h-10 w-10 opacity-50" />
            <p>No schools match your filters, or the SMS overview view is not deployed yet.</p>
            <p className="mt-1 text-sm">Run the SMS subscription billing SQL migration in Supabase.</p>
          </div>
        ) : (
          <div className="rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>School</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Sent (30d)</TableHead>
                  <TableHead className="text-right">Total sent</TableHead>
                  <TableHead>Last SMS</TableHead>
                  <TableHead className="text-right">Enable SMS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row) => (
                  <TableRow key={row.school_id}>
                    <TableCell>
                      <div>
                        <Link
                          to={`/platform/tenants/${row.school_id}`}
                          className="font-medium hover:underline"
                        >
                          {row.school_name}
                        </Link>
                        <p className="text-xs text-muted-foreground">{row.school_code ?? "—"}</p>
                      </div>
                    </TableCell>
                    <TableCell>{row.plan_name ?? "—"}</TableCell>
                    <TableCell>
                      {smsStatusBadge(row.sms_enabled, row.sms_admin_override)}
                    </TableCell>
                    <TableCell className="text-right">{row.sms_sent_30d ?? 0}</TableCell>
                    <TableCell className="text-right">{row.sms_sent_total ?? 0}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.last_sms_at ? new Date(row.last_sms_at).toLocaleString() : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Switch
                        checked={row.sms_enabled}
                        disabled={updatingId === row.school_id}
                        onCheckedChange={(checked) => void toggleSms(row.school_id, checked)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
