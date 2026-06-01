// @ts-nocheck
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
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
import { Search, Loader2, Settings2, Eye } from "lucide-react";
import { usePlatformTenants } from "@/platform/hooks/usePlatformDashboard";

function statusBadge(status: string | null) {
  const map: Record<string, string> = {
    active: "bg-emerald-500/10 text-emerald-700",
    trial: "bg-blue-500/10 text-blue-700",
    suspended: "bg-amber-500/10 text-amber-800",
    expired: "bg-red-500/10 text-red-700",
    cancelled: "bg-muted text-muted-foreground",
  };
  const label = status ?? "legacy";
  return (
    <Badge variant="outline" className={map[label] ?? ""}>
      {label}
    </Badge>
  );
}

function storagePct(used: number | null, limit: number | null) {
  if (!limit || limit <= 0) return "—";
  const pct = Math.round(((used ?? 0) / limit) * 100);
  return `${Math.round(used ?? 0)} / ${Math.round(limit)} MB (${pct}%)`;
}

export default function TenantManagement() {
  const { data: tenants, isLoading } = usePlatformTenants();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tenants ?? [];
    return (tenants ?? []).filter(
      (t) =>
        t.school_name.toLowerCase().includes(q) ||
        t.school_code.toLowerCase().includes(q) ||
        (t.plan_name ?? "").toLowerCase().includes(q),
    );
  }, [tenants, search]);

  return (
    <DashboardLayout role="super_admin">
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Tenant management</h1>
            <p className="text-muted-foreground">
              Organizations using the platform — plans, modules, and usage
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link to="/platform">Back to dashboard</Link>
          </Button>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search organization, code, plan…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organization</TableHead>
                <TableHead>School code</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Users</TableHead>
                <TableHead>Students</TableHead>
                <TableHead>Storage</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-12 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-12 text-center text-muted-foreground">
                    No organizations found
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((t) => (
                  <TableRow key={t.school_id}>
                    <TableCell className="font-medium">{t.school_name}</TableCell>
                    <TableCell className="font-mono text-xs">{t.school_code}</TableCell>
                    <TableCell>{t.plan_name ?? "—"}</TableCell>
                    <TableCell>{statusBadge(t.subscription_status)}</TableCell>
                    <TableCell>{t.user_count}</TableCell>
                    <TableCell>{t.student_count}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {storagePct(t.storage_used_mb, t.storage_limit_mb)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {t.expires_at ? new Date(t.expires_at).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={`/platform/tenants/${t.school_id}`}>
                          <Settings2 className="mr-1 h-4 w-4" />
                          Manage
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </DashboardLayout>
  );
}
