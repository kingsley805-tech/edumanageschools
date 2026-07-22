import { Link, useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { useBillingDashboardData } from "@/billing/hooks/useBillingDashboardData";
import { PermissionGate } from "@/components/PermissionGate";
import { PERMISSIONS } from "@/lib/permissions";
import { formatMoney } from "@/lib/currency";
import { MingoLineChart, type MingoLinePoint } from "@/components/charts/MingoLineChart";
import { MingoCategoryBars, type MingoCategoryItem } from "@/components/charts/MingoCategoryBars";

const AccountantDashboard = () => {
  const navigate = useNavigate();
  const {
    totalBilled,
    totalCollected,
    outstandingBalance,
    overdueFees,
    collectionRate,
    defaulterCount,
    currency,
    schoolName,
    collectionsByMonth,
    loading,
  } = useBillingDashboardData();

  const fmt = (n: number) => formatMoney(n, currency, { maximumFractionDigits: 0 });

  const trendPoints: MingoLinePoint[] = collectionsByMonth.map((row) => ({
    label: row.month,
    primary: row.online + row.manual,
    secondary: row.manual,
  }));
  const trendMax = Math.max(1, ...trendPoints.map((p) => Math.max(p.primary, p.secondary)));

  const funnelItems: MingoCategoryItem[] = (() => {
    const rows = [
      { name: "Billed", amount: totalBilled },
      { name: "Collected", amount: totalCollected },
      { name: "Outstanding", amount: outstandingBalance },
      { name: "Overdue", amount: overdueFees },
    ].filter((r) => r.amount > 0);
    if (!rows.length) return [];
    const max = Math.max(...rows.map((r) => r.amount), 1);
    return rows.map((r) => ({
      name: r.name,
      value: fmt(r.amount),
      percent: Math.max(8, Math.round((r.amount / max) * 82)),
    }));
  })();

  return (
    <PermissionGate anyOf={[PERMISSIONS.reports.viewFinancial, PERMISSIONS.payments.view]} showDenied>
      <DashboardLayout role="accountant">
        <div className="mingo-content">
          <div className="mingo-page-head">
            <div>
              <h1>Finance dashboard</h1>
              <p>{schoolName ? `${schoolName} · live billing summary` : "Live billing summary"}</p>
            </div>
            <div className="mingo-head-actions">
              <button
                type="button"
                className="mingo-btn mingo-btn-primary"
                onClick={() => navigate("/admin/billing")}
              >
                Open billing overview →
              </button>
            </div>
          </div>

          <div className="mingo-kpi-row">
            <div className="mingo-kpi">
              <div className="label">Total Billed</div>
              <div className="val mono">{loading ? "—" : fmt(totalBilled)}</div>
            </div>
            <div className="mingo-kpi">
              <div className="label">Collected</div>
              <div className="val mono">{loading ? "—" : fmt(totalCollected)}</div>
              <div className="sub up">▲ {collectionRate.toFixed(0)}% collection rate</div>
            </div>
            <div className="mingo-kpi warn">
              <div className="label">Outstanding</div>
              <div className="val mono">{loading ? "—" : fmt(outstandingBalance)}</div>
            </div>
            <div className="mingo-kpi crit">
              <div className="label">Overdue</div>
              <div className="val mono">{loading ? "—" : fmt(overdueFees)}</div>
              <div className="sub down">{defaulterCount} defaulter(s)</div>
            </div>
          </div>

          <div className="mingo-charts-row">
            <div className="mingo-panel mingo-charts-line">
              <div className="mingo-panel-head">
                <h2>Collections trend</h2>
              </div>
              <div className="mingo-panel-body" style={{ paddingTop: 14 }}>
                {trendPoints.length ? (
                  <MingoLineChart
                    points={trendPoints}
                    primaryLabel="Total collected"
                    secondaryLabel="Manual"
                    yMaxLabel={fmt(trendMax)}
                    yMidLabel=""
                    yMinLabel="0"
                  />
                ) : (
                  <p className="text-[12.5px] text-[hsl(var(--ink-faint))]">No payment data yet.</p>
                )}
              </div>
            </div>

            <div className="mingo-panel mingo-charts-cat">
              <div className="mingo-panel-head">
                <h2>Billing funnel</h2>
              </div>
              <div className="mingo-panel-body">
                {funnelItems.length ? (
                  <MingoCategoryBars items={funnelItems} bordered={false} />
                ) : (
                  <p className="text-[12.5px] text-[hsl(var(--ink-faint))]">No billing data yet.</p>
                )}
              </div>
            </div>
          </div>

          <div className="mingo-panel-head mingo-table-cap">
            <h2>Quick links</h2>
          </div>
          <div className="mingo-table-wrap" style={{ padding: 4 }}>
            <div className="grid gap-3 p-3 sm:grid-cols-4">
              <Link to="/admin/billing/invoices" className="mingo-btn mingo-btn-ghost" style={{ justifyContent: "flex-start" }}>
                Invoices
              </Link>
              <Link to="/admin/billing/payments" className="mingo-btn mingo-btn-ghost" style={{ justifyContent: "flex-start" }}>
                Payments
              </Link>
              <Link to="/admin/billing/reports" className="mingo-btn mingo-btn-ghost" style={{ justifyContent: "flex-start" }}>
                Reports
              </Link>
              <Link to="/admin/billing/payroll" className="mingo-btn mingo-btn-ghost" style={{ justifyContent: "flex-start" }}>
                Payroll
              </Link>
            </div>
          </div>
        </div>
      </DashboardLayout>
    </PermissionGate>
  );
};

export default AccountantDashboard;
