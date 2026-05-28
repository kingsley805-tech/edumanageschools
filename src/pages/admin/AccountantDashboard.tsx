import { Link } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { useBillingDashboardData } from "@/billing/hooks/useBillingDashboardData";
import AdminKpiCard from "@/billing/components/dashboard/AdminKpiCard";
import CollectionsOverviewChart from "@/billing/components/dashboard/CollectionsOverviewChart";
import { PermissionGate } from "@/components/PermissionGate";
import { PERMISSIONS } from "@/lib/permissions";
import { DollarSign, TrendingUp, FileText, AlertCircle, ArrowRight } from "lucide-react";

const AccountantDashboard = () => {
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

  const fmt = (n: number) => `${currency} ${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  return (
    <PermissionGate
      anyOf={[PERMISSIONS.reports.viewFinancial, PERMISSIONS.payments.view]}
      showDenied
    >
      <DashboardLayout role="accountant">
        <div className="space-y-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Finance dashboard</h1>
              <p className="text-muted-foreground mt-1">{schoolName} · live billing summary</p>
            </div>
            <Button asChild>
              <Link to="/admin/billing">
                Open billing overview
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            <AdminKpiCard
              title="Total billed"
              value={loading ? "—" : fmt(totalBilled)}
              icon={DollarSign}
              progressPercent={totalBilled > 0 ? 100 : 0}
              tone="neutral"
            />
            <AdminKpiCard
              title="Collected"
              value={loading ? "—" : fmt(totalCollected)}
              icon={TrendingUp}
              progressPercent={collectionRate}
              tone="success"
              footer={loading ? undefined : `${collectionRate.toFixed(0)}% collection rate`}
            />
            <AdminKpiCard
              title="Outstanding"
              value={loading ? "—" : fmt(outstandingBalance)}
              icon={FileText}
              progressPercent={totalBilled > 0 ? (outstandingBalance / totalBilled) * 100 : 0}
              tone="warning"
            />
            <AdminKpiCard
              title="Overdue"
              value={loading ? "—" : fmt(overdueFees)}
              icon={AlertCircle}
              progressPercent={totalBilled > 0 ? (overdueFees / totalBilled) * 100 : 0}
              tone="danger"
              footer={loading ? undefined : `${defaulterCount} defaulter(s)`}
            />
          </div>

          <CollectionsOverviewChart
            data={collectionsByMonth}
            currency={currency}
            loading={loading}
          />

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/admin/billing/invoices">Invoices</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/admin/billing/payments">Payments</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/admin/billing/reports">Reports</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/admin/billing/payroll">Payroll</Link>
            </Button>
          </div>
        </div>
      </DashboardLayout>
    </PermissionGate>
  );
};

export default AccountantDashboard;
