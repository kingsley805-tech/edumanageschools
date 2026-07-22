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
        <div className="mingo-content">
          <div className="mingo-page-head">
            <div>
              <h1>Auditor portal</h1>
              <p>Read-only financial and compliance overview for your school.</p>
            </div>
            <div className="mingo-head-actions">
              {hasPermission(PERMISSIONS.admin.viewAudit) && (
                <button type="button" className="mingo-btn mingo-btn-ghost" onClick={() => navigate("/admin/audit-logs")}>
                  Audit logs
                </button>
              )}
              {hasPermission(PERMISSIONS.reports.exportFinancial) && (
                <button
                  type="button"
                  className="mingo-btn mingo-btn-primary"
                  onClick={() => navigate("/admin/reports")}
                >
                  Export reports
                </button>
              )}
            </div>
          </div>

          <div className="mingo-kpi-row">
            <div className="mingo-kpi">
              <div className="label">Invoices On Record</div>
              <div className="val mono">{summary.invoiceCount}</div>
            </div>
            <div className="mingo-kpi">
              <div className="label">Payment Transactions</div>
              <div className="val mono">{summary.paymentCount}</div>
            </div>
            <div className="mingo-kpi">
              <div className="label">Audit Log Entries</div>
              <div className="val mono">{summary.auditEntries}</div>
            </div>
            <div className="mingo-kpi">
              <div className="label">Logged Last 14 Days</div>
              <div className="val mono">{recentLogs.length ? trendPoints.reduce((s, p) => s + p.primary, 0) : 0}</div>
            </div>
          </div>

          <div className="mingo-charts-row">
            <div className="mingo-panel mingo-charts-line">
              <div className="mingo-panel-head">
                <h2>System activity — last 7 days</h2>
              </div>
              <div className="mingo-panel-body" style={{ paddingTop: 14 }}>
                {trendPoints.some((p) => p.primary > 0 || p.secondary > 0) ? (
                  <MingoLineChart
                    points={trendPoints}
                    primaryLabel="Total events"
                    secondaryLabel="Data changes"
                    yMaxLabel={String(Math.max(1, ...trendPoints.map((p) => Math.max(p.primary, p.secondary))))}
                    yMidLabel=""
                    yMinLabel="0"
                  />
                ) : (
                  <p className="text-[12.5px] text-[hsl(var(--ink-faint))]">No audit activity recorded yet.</p>
                )}
              </div>
            </div>

            <div className="mingo-panel mingo-charts-cat">
              <div className="mingo-panel-head">
                <h2>Activity by module</h2>
              </div>
              <div className="mingo-panel-body">
                {moduleItems.length ? (
                  <MingoCategoryBars items={moduleItems} bordered={false} />
                ) : (
                  <p className="text-[12.5px] text-[hsl(var(--ink-faint))]">No data yet.</p>
                )}
              </div>
            </div>
          </div>

          <div className="mingo-panel-head mingo-table-cap">
            <h2>Recent audit entries</h2>
            <button type="button" className="meta" onClick={() => navigate("/admin/audit-logs")}>
              VIEW ALL →
            </button>
          </div>
          <div className="mingo-table-wrap">
            <table>
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
                      <span className={cn("mingo-status-pill", row.action_type === "delete" ? "overdue" : "paid")}>
                        {row.action_type ?? "—"}
                      </span>
                    </td>
                    <td>{row.entity_type ?? "—"}</td>
                    <td>{row.module ?? "—"}</td>
                    <td className="mono-cell">
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

          <div className="mingo-panel-head mingo-table-cap" style={{ marginTop: 18 }}>
            <h2>Quick links</h2>
          </div>
          <div className="mingo-table-wrap" style={{ padding: 4 }}>
            <div className="grid gap-3 p-3 sm:grid-cols-3">
              {hasPermission(PERMISSIONS.invoices.view) && (
                <button
                  type="button"
                  className="mingo-btn mingo-btn-ghost"
                  style={{ justifyContent: "flex-start" }}
                  onClick={() => navigate("/admin/billing/invoices")}
                >
                  <FileText className="h-4 w-4" /> View invoices
                </button>
              )}
              {hasPermission(PERMISSIONS.admin.viewAudit) && (
                <button
                  type="button"
                  className="mingo-btn mingo-btn-ghost"
                  style={{ justifyContent: "flex-start" }}
                  onClick={() => navigate("/admin/audit-logs")}
                >
                  <Eye className="h-4 w-4" /> Audit logs
                </button>
              )}
              {hasPermission(PERMISSIONS.reports.exportFinancial) && (
                <button
                  type="button"
                  className="mingo-btn mingo-btn-ghost"
                  style={{ justifyContent: "flex-start" }}
                  onClick={() => navigate("/admin/reports")}
                >
                  <Download className="h-4 w-4" /> Export reports
                </button>
              )}
            </div>
          </div>
        </div>
      </DashboardLayout>
    </PermissionGate>
  );
};

export default AuditorDashboard;
