// @ts-nocheck
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import PlatformLayout from "@/platform/components/PlatformLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { Search, Loader2, Settings2, CheckCircle2, XCircle } from "lucide-react";
import { usePlatformTenants } from "@/platform/hooks/usePlatformDashboard";
import {
  isTenantAwaitingApproval,
  isTenantLockedOrPendingPayment,
} from "@/platform/lib/tenantSubscription";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

type TenantListFilter = "all" | "awaiting_approval" | "locked_pending";

function statusBadge(status: string | null, awaitingApproval?: boolean) {
  const map: Record<string, string> = {
    active: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    trial: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
    pending: "bg-orange-500/10 text-orange-800 dark:text-orange-400",
    locked: "bg-red-500/10 text-red-700 dark:text-red-400",
    suspended: "bg-amber-500/10 text-amber-800 dark:text-amber-400",
    expired: "bg-red-500/10 text-red-700 dark:text-red-400",
    cancelled: "bg-muted text-muted-foreground",
  };
  const label = awaitingApproval ? "awaiting approval" : (status ?? "legacy");
  return (
    <Badge variant="outline" className={map[status ?? ""] ?? ""}>
      {label}
    </Badge>
  );
}

export default function TenantManagement() {
  const { data: tenants, isLoading } = usePlatformTenants();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const filterParam = searchParams.get("filter");
  const initialFilter: TenantListFilter =
    filterParam === "awaiting_approval" || filterParam === "locked_pending"
      ? filterParam
      : "all";

  const [search, setSearch] = useState("");
  const [listFilter, setListFilter] = useState<TenantListFilter>(initialFilter);
  const [actingId, setActingId] = useState<string | null>(null);

  const awaitingCount = useMemo(
    () => (tenants ?? []).filter(isTenantAwaitingApproval).length,
    [tenants],
  );

  const lockedPendingCount = useMemo(
    () => (tenants ?? []).filter(isTenantLockedOrPendingPayment).length,
    [tenants],
  );

  const filtered = useMemo(() => {
    let rows = tenants ?? [];
    if (listFilter === "awaiting_approval") {
      rows = rows.filter(isTenantAwaitingApproval);
    } else if (listFilter === "locked_pending") {
      rows = rows.filter(isTenantLockedOrPendingPayment);
    }
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (t) =>
        t.school_name.toLowerCase().includes(q) ||
        t.school_code.toLowerCase().includes(q) ||
        (t.plan_name ?? "").toLowerCase().includes(q),
    );
  }, [tenants, search, listFilter]);

  const setFilter = (v: TenantListFilter) => {
    setListFilter(v);
    if (v === "all") {
      searchParams.delete("filter");
      setSearchParams(searchParams, { replace: true });
    } else {
      setSearchParams({ filter: v }, { replace: true });
    }
  };

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["platform-tenants"] });
    void queryClient.invalidateQueries({ queryKey: ["platform-dashboard-stats"] });
  };

  const handleApprove = async (schoolId: string) => {
    setActingId(schoolId);
    try {
      const { data, error } = await supabase.rpc("approve_organization_subscription", {
        p_school_id: schoolId,
      });
      if (error) throw error;
      if (data && data.ok === false) throw new Error(data.error || "Approve failed");
      toast.success("Organization approved — admin can now access the dashboard");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Approve failed");
    } finally {
      setActingId(null);
    }
  };

  const handleReject = async (schoolId: string) => {
    if (!window.confirm("Reject this organization? They will be locked until you reactivate them.")) {
      return;
    }
    setActingId(schoolId);
    try {
      const { data, error } = await supabase.rpc("reject_organization_subscription", {
        p_school_id: schoolId,
        p_reason: "Rejected by Super Admin",
      });
      if (error) throw error;
      if (data && data.ok === false) throw new Error(data.error || "Reject failed");
      toast.success("Organization rejected and locked");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Reject failed");
    } finally {
      setActingId(null);
    }
  };

  return (
    <PlatformLayout
      title="Tenants"
      description="Approve schools, check plans, and open an organization to configure it"
    >
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[200px] max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search organization, code, plan…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={listFilter} onValueChange={(v) => setFilter(v as TenantListFilter)}>
            <SelectTrigger className="w-[240px]">
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All organizations</SelectItem>
              <SelectItem value="awaiting_approval">
                Awaiting approval{awaitingCount > 0 ? ` (${awaitingCount})` : ""}
              </SelectItem>
              <SelectItem value="locked_pending">
                Locked / pending{lockedPendingCount > 0 ? ` (${lockedPendingCount})` : ""}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organization</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Students</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-12 text-center">
                      <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                      {listFilter === "awaiting_approval"
                        ? "No organizations awaiting approval"
                        : "No organizations found"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((t) => {
                    const awaiting = isTenantAwaitingApproval(t);
                    const busy = actingId === t.school_id;
                    return (
                      <TableRow key={t.school_id}>
                        <TableCell>
                          <div className="font-medium">{t.school_name}</div>
                          <div className="font-mono text-xs text-muted-foreground">{t.school_code}</div>
                        </TableCell>
                        <TableCell>{t.plan_name ?? "—"}</TableCell>
                        <TableCell>{statusBadge(t.subscription_status, awaiting)}</TableCell>
                        <TableCell>{t.student_count}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {t.expires_at ? new Date(t.expires_at).toLocaleDateString() : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-wrap justify-end gap-1">
                            {awaiting ? (
                              <>
                                <Button
                                  size="sm"
                                  className="h-8"
                                  disabled={busy}
                                  onClick={() => void handleApprove(t.school_id)}
                                >
                                  {busy ? (
                                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                                  )}
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 text-destructive"
                                  disabled={busy}
                                  onClick={() => void handleReject(t.school_id)}
                                >
                                  <XCircle className="mr-1 h-3.5 w-3.5" />
                                  Reject
                                </Button>
                              </>
                            ) : null}
                            <Button variant="ghost" size="sm" asChild>
                              <Link to={`/platform/tenants/${t.school_id}`}>
                                <Settings2 className="mr-1 h-4 w-4" />
                                Open
                              </Link>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </PlatformLayout>
  );
}
