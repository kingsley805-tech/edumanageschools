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
        {/* Page head — Metronic page title block */}
        <div className="flex flex-wrap items-center lg:items-end justify-between gap-5 pb-7.5">
          <div className="flex min-w-0 flex-col justify-center gap-2">
            <h1 className="text-xl font-medium leading-none text-mono">Finance dashboard</h1>
            <div className="flex items-center gap-2 text-sm font-normal text-secondary-foreground">
              {schoolName ? `${schoolName} · live billing summary` : "Live billing summary"}
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              className="kt-btn kt-btn-primary"
              onClick={() => navigate("/admin/billing")}
            >
              Open billing overview
              <i className="ki-filled ki-right text-xs" />
            </button>
          </div>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-5 lg:gap-7.5 mb-5 lg:mb-7.5">
          {[
            { label: "Total Billed", value: loading ? "—" : fmt(totalBilled), icon: "document", tone: "" },
            {
              label: "Collected",
              value: loading ? "—" : fmt(totalCollected),
              icon: "wallet",
              tone: "kt-badge-success",
              sub: `${collectionRate.toFixed(0)}% collection rate`,
            },
            { label: "Outstanding", value: loading ? "—" : fmt(outstandingBalance), icon: "bank", tone: "kt-badge-warning" },
            {
              label: "Overdue",
              value: loading ? "—" : fmt(overdueFees),
              icon: "calendar-remove",
              tone: "kt-badge-danger",
              sub: `${defaulterCount} defaulter(s)`,
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
                {kpi.sub ? (
                  <span className={`kt-badge kt-badge-outline kt-badge-sm ${kpi.tone}`}>{kpi.sub}</span>
                ) : null}
              </div>
            </div>
          ))}
        </div>

        {/* Charts row */}
        <div className="grid lg:grid-cols-3 gap-5 lg:gap-7.5 items-stretch mb-5 lg:mb-7.5">
          <div className="kt-card lg:col-span-2">
            <div className="kt-card-header">
              <h3 className="kt-card-title">Collections trend</h3>
            </div>
            <div className="kt-card-content p-5 lg:p-7.5">
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
                <p className="text-sm text-secondary-foreground">No payment data yet.</p>
              )}
            </div>
          </div>

          <div className="kt-card">
            <div className="kt-card-header">
              <h3 className="kt-card-title">Billing funnel</h3>
            </div>
            <div className="kt-card-content p-5 lg:p-7.5">
              {funnelItems.length ? (
                <MingoCategoryBars items={funnelItems} bordered={false} />
              ) : (
                <p className="text-sm text-secondary-foreground">No billing data yet.</p>
              )}
            </div>
          </div>
        </div>

        {/* Quick links */}
        <div className="kt-card">
          <div className="kt-card-header">
            <h3 className="kt-card-title">Quick links</h3>
          </div>
          <div className="kt-card-content p-5 lg:p-7.5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Link to="/admin/billing/invoices" className="kt-btn kt-btn-outline justify-start">
              <i className="ki-filled ki-document text-base" />
              Invoices
            </Link>
            <Link to="/admin/billing/payments" className="kt-btn kt-btn-outline justify-start">
              <i className="ki-filled ki-credit-cart text-base" />
              Payments
            </Link>
            <Link to="/admin/billing/reports" className="kt-btn kt-btn-outline justify-start">
              <i className="ki-filled ki-chart-simple text-base" />
              Reports
            </Link>
            <Link to="/admin/billing/payroll" className="kt-btn kt-btn-outline justify-start">
              <i className="ki-filled ki-wallet text-base" />
              Payroll
            </Link>
          </div>
        </div>
      </DashboardLayout>
    </PermissionGate>
  );
};

export default AccountantDashboard;
