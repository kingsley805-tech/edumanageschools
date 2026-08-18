// @ts-nocheck
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Building2, Users, GraduationCap, UserCircle, AlertTriangle, Loader2, ArrowRight } from "lucide-react";
import { usePlatformDashboardStats, usePlatformTenants } from "@/platform/hooks/usePlatformDashboard";

import { cn } from "@/lib/utils";

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  className,
}: {
  title: string;
  value: string | number;
  description?: string;
  icon: typeof Building2;
  className?: string;
}) {
  return (
    <Card className={cn("channel-stats-bg", className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}
      </CardContent>
    </Card>
  );
}

export default function PlatformDashboard() {
  const { data: stats, isLoading: statsLoading } = usePlatformDashboardStats();
  const { data: tenants, isLoading: tenantsLoading } = usePlatformTenants();

  const expiringSoon =
    tenants?.filter((t) => {
      if (!t.expires_at) return false;
      const days = (new Date(t.expires_at).getTime() - Date.now()) / (86400000);
      return days > 0 && days <= 30;
    }) ?? [];

  return (
    <DashboardLayout role="super_admin">
      <div className="space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Platform Control Center</h1>
            <p className="text-muted-foreground">
              Monitor organizations, subscriptions, and feature access across all tenants
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link to="/platform/tenants">Manage tenants</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/platform/payment-gateway">Payment gateway</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/platform/sms">SMS management</Link>
            </Button>
            <Button asChild>
              <Link to="/platform/plans">Subscription plans</Link>
            </Button>
          </div>
        </div>

        {statsLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard title="Total organizations" value={stats?.totalOrganizations ?? 0} icon={Building2} />
            <StatCard title="Active" value={stats?.activeOrganizations ?? 0} icon={Building2} className="border-emerald-500/20" />
            <StatCard title="Trial" value={stats?.trialOrganizations ?? 0} icon={Users} />
            <StatCard title="Suspended / expired" value={(stats?.suspendedOrganizations ?? 0) + (stats?.expiredOrganizations ?? 0)} icon={AlertTriangle} />
            <StatCard title="Total students" value={(stats?.totalStudents ?? 0).toLocaleString()} icon={GraduationCap} />
            <StatCard title="Total teachers" value={(stats?.totalTeachers ?? 0).toLocaleString()} icon={Users} />
            <StatCard title="Total parents" value={(stats?.totalParents ?? 0).toLocaleString()} icon={UserCircle} />
            <StatCard title="Total users" value={(stats?.totalUsers ?? 0).toLocaleString()} icon={Users} />
          </div>
        )}

        {expiringSoon.length > 0 ? (
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardHeader>
              <CardTitle className="text-base">Expiring within 30 days</CardTitle>
              <CardDescription>{expiringSoon.length} organization(s) need renewal attention</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {expiringSoon.slice(0, 5).map((t) => (
                  <li key={t.school_id} className="flex justify-between gap-4">
                    <span className="font-medium">{t.school_name}</span>
                    <span className="text-muted-foreground">
                      {new Date(t.expires_at!).toLocaleDateString()}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent organizations</CardTitle>
              <CardDescription>Quick overview of tenant status</CardDescription>
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
                      <th className="pb-2 pr-4">Organization</th>
                      <th className="pb-2 pr-4">Code</th>
                      <th className="pb-2 pr-4">Plan</th>
                      <th className="pb-2 pr-4">Status</th>
                      <th className="pb-2 pr-4">Students</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(tenants ?? []).slice(0, 8).map((t) => (
                      <tr key={t.school_id} className="border-b border-border/50">
                        <td className="py-2.5 pr-4 font-medium">{t.school_name}</td>
                        <td className="py-2.5 pr-4 font-mono text-xs">{t.school_code}</td>
                        <td className="py-2.5 pr-4">{t.plan_name ?? "—"}</td>
                        <td className="py-2.5 pr-4 capitalize">{t.subscription_status ?? "legacy"}</td>
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
    </DashboardLayout>
  );
}
