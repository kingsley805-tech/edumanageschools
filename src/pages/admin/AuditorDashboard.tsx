import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Eye, Download, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";
import { PermissionGate } from "@/components/PermissionGate";
import { PERMISSIONS } from "@/lib/permissions";
import { useNavigate } from "react-router-dom";
import { MingoLineChart, type MingoLinePoint } from "@/components/charts/MingoLineChart";
import { MingoCategoryBars, type MingoCategoryItem } from "@/components/charts/MingoCategoryBars";
import { cn } from "@/lib/utils";

type AuditRow = {
  action_type?: string | null;
  entity_type?: string | null;
  module?: string | null;
  created_at?: string | null;
};

const AuditorDashboard = () => {
  const navigate = useNavigate();
  const { schoolId, hasPermission } = usePermissions();
  const [summary, setSummary] = useState({ invoiceCount: 0, paymentCount: 0, auditEntries: 0 });
  const [trendPoints, setTrendPoints] = useState<MingoLinePoint[]>([]);
  const [moduleItems, setModuleItems] = useState<MingoCategoryItem[]>([]);
  const [recentLogs, setRecentLogs] = useState<AuditRow[]>([]);

  useEffect(() => {
    if (!schoolId) return;
    (async () => {
      const { count: invCount } = await supabase
        .from("invoices")
        .select("id, students!inner(school_id)", { count: "exact", head: true })
        .eq("students.school_id", schoolId);
      const { count: payCount } = await supabase
        .from("payments")
        .select("id", { count: "exact", head: true });
      const { count: auditCount } = await supabase
        .from("audit_logs")
        .select("id", { count: "exact", head: true })
        .eq("school_id", schoolId);
      setSummary({
        invoiceCount: invCount ?? 0,
        paymentCount: payCount ?? 0,
        auditEntries: auditCount ?? 0,
      });

      const since = new Date();
      since.setDate(since.getDate() - 14);
      const { data: logRows } = await supabase
        .from("audit_logs")
        .select("action_type, entity_type, module, created_at")
        .eq("school_id", schoolId)
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: false })
        .limit(500);

      setRecentLogs((logRows ?? []).slice(0, 8));

      const days = 7;
      const dayBuckets = Array.from({ length: days }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (days - 1 - i));
        return d.toISOString().split("T")[0];
      });
      const writes = new Set(["create", "insert", "update", "delete"]);
      const points = dayBuckets.map((date) => {
        const dayRows = (logRows ?? []).filter((r) => (r.created_at ?? "").startsWith(date));
        const total = dayRows.length;
        const changes = dayRows.filter((r) => writes.has(String(r.action_type ?? "").toLowerCase())).length;
        return {
          label: new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
          primary: total,
          secondary: changes,
        };
      });
      setTrendPoints(points);

      const byModule = new Map<string, number>();
      for (const row of logRows ?? []) {
        const name = row.module || row.entity_type || "Other";
        byModule.set(name, (byModule.get(name) ?? 0) + 1);
      }
      const moduleRows = [...byModule.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 7);
      const total = moduleRows.reduce((s, r) => s + r.count, 0) || 1;
      const max = Math.max(...moduleRows.map((r) => r.count), 1);
      setModuleItems(
        moduleRows.map((r) => ({
          name: r.name,
          value: `${((r.count / total) * 100).toFixed(1)}%`,
          percent: Math.max(8, Math.round((r.count / max) * 82)),
        })),
      );
    })();
  }, [schoolId]);

  return (
    <PermissionGate permission={PERMISSIONS.admin.viewAudit} showDenied>
      <DashboardLayout role="auditor">
        {/* Page head — Metronic page title block */}
        <div className="flex flex-wrap items-center lg:items-end justify-between gap-5 pb-7.5">
          <div className="flex min-w-0 flex-col justify-center gap-2">
            <h1 className="text-xl font-medium leading-none text-mono">Auditor portal</h1>
            <div className="flex items-center gap-2 text-sm font-normal text-secondary-foreground">
              Read-only financial and compliance overview for your school.
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            {hasPermission(PERMISSIONS.admin.viewAudit) ? (
              <button
                type="button"
                className="kt-btn kt-btn-outline"
                onClick={() => navigate("/admin/audit-logs")}
              >
                <i className="ki-filled ki-shield-tick text-base" />
                Audit logs
              </button>
            ) : null}
            {hasPermission(PERMISSIONS.reports.exportFinancial) ? (
              <button
                type="button"
                className="kt-btn kt-btn-primary"
                onClick={() => navigate("/admin/reports")}
              >
                <i className="ki-filled ki-file-down text-base" />
                Export reports
              </button>
            ) : null}
          </div>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-5 lg:gap-7.5 mb-5 lg:mb-7.5">
          {[
            { label: "Invoices On Record", value: summary.invoiceCount, icon: "document" },
            { label: "Payment Transactions", value: summary.paymentCount, icon: "credit-cart" },
            { label: "Audit Log Entries", value: summary.auditEntries, icon: "shield-tick" },
            {
              label: "Logged Last 14 Days",
              value: recentLogs.length ? trendPoints.reduce((s, p) => s + p.primary, 0) : 0,
              icon: "timer",
            },
          ].map((kpi) => (
            <div className="kt-card channel-stats-bg" key={kpi.label}>
              <div className="kt-card-content p-5 lg:p-7.5 flex flex-col gap-4">
                <div className="flex items-center justify-between gap-2.5">
                  <span className="text-sm font-normal text-secondary-foreground">{kpi.label}</span>
                  <span className="flex items-center justify-center size-10 shrink-0 rounded-lg bg-accent/60 border border-border">
                    <i className={`ki-filled ki-${kpi.icon} text-lg text-muted-foreground`} />
                  </span>
                </div>
                <span className="text-3xl font-semibold text-mono">{kpi.value}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Charts row */}
        <div className="grid lg:grid-cols-3 gap-5 lg:gap-7.5 items-stretch mb-5 lg:mb-7.5">
          <div className="kt-card lg:col-span-2">
            <div className="kt-card-header">
              <h3 className="kt-card-title">System activity — last 7 days</h3>
            </div>
            <div className="kt-card-content p-5 lg:p-7.5">
              {trendPoints.some((p) => p.primary > 0 || p.secondary > 0) ? (
                <MingoLineChart
                  points={trendPoints}
                  primaryLabel="Total events"
                  secondaryLabel="Data changes"
                  yMaxLabel={String(
                    Math.max(1, ...trendPoints.map((p) => Math.max(p.primary, p.secondary))),
                  )}
                  yMidLabel=""
                  yMinLabel="0"
                />
              ) : (
                <p className="text-sm text-secondary-foreground">No audit activity recorded yet.</p>
              )}
            </div>
          </div>

          <div className="kt-card">
            <div className="kt-card-header">
              <h3 className="kt-card-title">Activity by module</h3>
            </div>
            <div className="kt-card-content p-5 lg:p-7.5">
              {moduleItems.length ? (
                <MingoCategoryBars items={moduleItems} bordered={false} />
              ) : (
                <p className="text-sm text-secondary-foreground">No data yet.</p>
              )}
            </div>
          </div>
        </div>

        {/* Recent audit entries */}
        <div className="kt-card mb-5 lg:mb-7.5">
          <div className="kt-card-header">
            <h3 className="kt-card-title">Recent audit entries</h3>
            <button
              type="button"
              className="kt-btn kt-btn-ghost kt-btn-sm text-muted-foreground hover:text-primary"
              onClick={() => navigate("/admin/audit-logs")}
            >
              View all
              <i className="ki-filled ki-right text-xs" />
            </button>
          </div>
          <div className="kt-card-content p-0 overflow-x-auto">
            <table className="kt-table min-w-full">
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>Module</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {(recentLogs.length
                  ? recentLogs
                  : [{ action_type: "—", entity_type: "No activity yet", module: "—", created_at: null }]
                ).map((row, i) => (
                  <tr key={i}>
                    <td>
                      <span
                        className={
                          row.action_type === "delete"
                            ? "kt-badge kt-badge-sm kt-badge-danger kt-badge-outline"
                            : "kt-badge kt-badge-sm kt-badge-success kt-badge-outline"
                        }
                      >
                        {row.action_type ?? "—"}
                      </span>
                    </td>
                    <td className="text-2sm text-secondary-foreground">{row.entity_type ?? "—"}</td>
                    <td className="text-2sm text-secondary-foreground">{row.module ?? "—"}</td>
                    <td className="font-mono text-2sm text-secondary-foreground">
                      {row.created_at
                        ? new Date(row.created_at).toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick links */}
        <div className="kt-card">
          <div className="kt-card-header">
            <h3 className="kt-card-title">Quick links</h3>
          </div>
          <div className="kt-card-content p-5 lg:p-7.5 grid gap-3 sm:grid-cols-3">
            {hasPermission(PERMISSIONS.invoices.view) ? (
              <button
                type="button"
                className="kt-btn kt-btn-outline justify-start"
                onClick={() => navigate("/admin/billing/invoices")}
              >
                <FileText className="h-4 w-4 shrink-0" />
                View invoices
              </button>
            ) : null}
            {hasPermission(PERMISSIONS.admin.viewAudit) ? (
              <button
                type="button"
                className="kt-btn kt-btn-outline justify-start"
                onClick={() => navigate("/admin/audit-logs")}
              >
                <Eye className="h-4 w-4 shrink-0" />
                Audit logs
              </button>
            ) : null}
            {hasPermission(PERMISSIONS.reports.exportFinancial) ? (
              <button
                type="button"
                className="kt-btn kt-btn-outline justify-start"
                onClick={() => navigate("/admin/reports")}
              >
                <Download className="h-4 w-4 shrink-0" />
                Export reports
              </button>
            ) : null}
          </div>
        </div>
      </DashboardLayout>
    </PermissionGate>
  );
};

export default AuditorDashboard;
