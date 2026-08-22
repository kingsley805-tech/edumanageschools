import { Link } from "react-router-dom";
import {
  Building2,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Loader2,
  ArrowRight,
} from "lucide-react";
import PlatformLayout from "@/platform/components/PlatformLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePlatformDashboardStats, usePlatformTenants } from "@/platform/hooks/usePlatformDashboard";
import {
  isTenantAwaitingApproval,
  isTenantLockedOrPendingPayment,
} from "@/platform/lib/tenantSubscription";
import { cn } from "@/lib/utils";

function StatCard({
  title,
  value,
  hint,
  icon: Icon,
  tone,
  to,
}: {
  title: string;
  value: string | number;
  hint?: string;
  icon: typeof Building2;
  tone?: string;
  to?: string;
}) {
  const body = (
    <Card className={cn("channel-stats-bg h-full transition-colors", to && "hover:border-primary/40")}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className={cn("h-4 w-4 text-muted-foreground", tone)} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
  return to ? <Link to={to}>{body}</Link> : body;
}

export default function PlatformDashboard() {
  const { data: stats, isLoading: statsLoading } = usePlatformDashboardStats();
  const { data: tenants, isLoading: tenantsLoading } = usePlatformTenants();

  const awaiting = (tenants ?? []).filter(isTenantAwaitingApproval);
  const locked = (tenants ?? []).filter(isTenantLockedOrPendingPayment);
  const expiringSoon = (tenants ?? []).filter((t) => {
    // Never treat awaiting-approval / unpaid-pending orgs as "expiring"
    if (isTenantAwaitingApproval(t)) return false;
    if (t.subscription_status === "pending") return false;
    if (!t.expires_at) return false;
    const days = (new Date(t.expires_at).getTime() - Date.now()) / 86400000;
    return days > 0 && days <= 30;
  });

  const attention = [
    ...awaiting.map((t) => ({
      id: t.school_id,
      name: t.school_name,
      code: t.school_code,
      reason: "Awaiting approval",
      tone: "amber" as const,
    })),
    ...expiringSoon
      .filter((t) => !isTenantAwaitingApproval(t))
      .map((t) => ({
        id: t.school_id,
        name: t.school_name,
        code: t.school_code,
        reason: `Expires ${new Date(t.expires_at!).toLocaleDateString()}`,
        tone: "orange" as const,
      })),
    ...locked
      .filter((t) => !isTenantAwaitingApproval(t))
      .slice(0, 5)
      .map((t) => ({
        id: t.school_id,
        name: t.school_name,
        code: t.school_code,
        reason: "Locked / pending payment",
        tone: "red" as const,
      })),
  ].slice(0, 8);

  return (
    <PlatformLayout
      title="Dashboard"
      description="What needs your attention across all schools"
      actions={
        <Button asChild size="sm">
          <Link to="/platform/tenants">Manage tenants</Link>
        </Button>
      }
    >
      <div className="mx-auto max-w-6xl space-y-8">
        {statsLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Organizations"
              value={stats?.totalOrganizations ?? 0}
              hint="All registered schools"
              icon={Building2}
              to="/platform/tenants"
            />
            <StatCard
              title="Active"
              value={stats?.activeOrganizations ?? 0}
              hint="Live subscriptions"
              icon={CheckCircle2}
              tone="text-emerald-600"
              to="/platform/tenants"
            />
            <StatCard
              title="Awaiting approval"
              value={awaiting.length}
              hint="Need your decision"
              icon={Clock}
              tone="text-amber-600"
              to="/platform/tenants?filter=awaiting_approval"
            />
            <StatCard
              title="Expiring soon"
              value={expiringSoon.length}
              hint="Within 30 days"
              icon={AlertTriangle}
              tone="text-orange-600"
              to="/platform/tenants"
            />
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-5">
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base">Needs attention</CardTitle>
                <CardDescription>Approve, renew, or unlock</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {tenantsLoading ? (
                <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
              ) : attention.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  All clear — nothing urgent right now.
                </p>
              ) : (
                <ul className="space-y-2">
                  {attention.map((item) => (
                    <li key={`${item.id}-${item.reason}`}>
                      <Link
                        to={`/platform/tenants/${item.id}`}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2.5 text-sm transition-colors hover:bg-muted/50"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium">{item.name}</p>
                          <p className="font-mono text-xs text-muted-foreground">{item.code}</p>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn(
                            "shrink-0 text-[10px]",
                            item.tone === "amber" && "border-amber-500/40 text-amber-700",
                            item.tone === "orange" && "border-orange-500/40 text-orange-700",
                            item.tone === "red" && "border-red-500/40 text-red-700",
                          )}
                        >
                          {item.reason}
                        </Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-3">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base">Recent organizations</CardTitle>
                <CardDescription>Latest tenants on the platform</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/platform/tenants">
                  View all <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {tenantsLoading ? (
                <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="pb-2 pr-4 font-medium">Organization</th>
                        <th className="pb-2 pr-4 font-medium">Plan</th>
                        <th className="pb-2 pr-4 font-medium">Status</th>
                        <th className="pb-2 font-medium">Students</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(tenants ?? []).slice(0, 8).map((t) => (
                        <tr key={t.school_id} className="border-b border-border/40">
                          <td className="py-2.5 pr-4">
                            <Link
                              to={`/platform/tenants/${t.school_id}`}
                              className="font-medium hover:text-primary hover:underline"
                            >
                              {t.school_name}
                            </Link>
                            <div className="font-mono text-xs text-muted-foreground">{t.school_code}</div>
                          </td>
                          <td className="py-2.5 pr-4">{t.plan_name ?? "—"}</td>
                          <td className="py-2.5 pr-4 capitalize">
                            {isTenantAwaitingApproval(t)
                              ? "awaiting approval"
                              : (t.subscription_status ?? "legacy")}
                          </td>
                          <td className="py-2.5">{t.student_count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PlatformLayout>
  );
}
