import { Link } from "react-router-dom";
import AdminKpiCard from "@/billing/components/dashboard/AdminKpiCard";
import AdminUserCountCard from "@/billing/components/dashboard/AdminUserCountCard";
import CollectionsOverviewChart from "@/billing/components/dashboard/CollectionsOverviewChart";
import FeeCollectionDonutCard from "@/billing/components/dashboard/FeeCollectionDonutCard";
import RecentActivity from "@/billing/components/dashboard/RecentActivity";
import RecentPaystackPayments from "@/billing/components/dashboard/RecentPaystackPayments";
import { Button } from "@/components/ui/button";
import { useBillingDashboardData } from "@/billing/hooks/useBillingDashboardData";
import { useBillingAuth } from "@/billing/hooks/useBillingAuth";
import {
  DollarSign,
  TrendingUp,
  FileText,
  AlertCircle,
  GraduationCap,
  Users,
  UserCheck,
  Briefcase,
  Banknote,
} from "lucide-react";

function BillingDashboard() {
  const { isAdmin } = useBillingAuth();
  const {
    totalBilled,
    totalCollected,
    outstandingBalance,
    overdueFees,
    totalStudents,
    totalParents,
    totalTeachers,
    totalAccountants,
    feesDueThisWeek,
    collectionRate,
    defaulterCount,
    currency,
    schoolName,
    collectionsByMonth,
    totalMonthlyPayrollLiability,
    payrollPaidThisMonth,
    payrollPendingThisMonth,
    loading,
  } = useBillingDashboardData();

  const fmt = (value: number) =>
    `${currency} ${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  const totalUsers = totalStudents + totalParents + totalTeachers + totalAccountants;
  const pct = (part: number, whole: number) => (whole > 0 ? Math.min(100, (part / whole) * 100) : 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Billing overview</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {schoolName} · financial summary
          </p>
        </div>
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
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <AdminKpiCard
          title="Total fees billed"
          value={loading ? "—" : fmt(totalBilled)}
          icon={DollarSign}
          progressPercent={totalBilled > 0 ? 100 : 0}
          tone="neutral"
        />
        <AdminKpiCard
          title="Amount collected"
          value={loading ? "—" : fmt(totalCollected)}
          icon={TrendingUp}
          progressPercent={collectionRate}
          tone="success"
          footer={loading ? undefined : `${collectionRate.toFixed(0)}% collection rate`}
        />
        <AdminKpiCard
          title="Outstanding balance"
          value={loading ? "—" : fmt(outstandingBalance)}
          icon={FileText}
          progressPercent={pct(outstandingBalance, totalBilled)}
          tone="warning"
          footer={loading ? undefined : `${pct(outstandingBalance, totalBilled).toFixed(0)}% unpaid`}
        />
        <AdminKpiCard
          title="Overdue fees"
          value={loading ? "—" : fmt(overdueFees)}
          icon={AlertCircle}
          progressPercent={pct(overdueFees, totalBilled)}
          tone="danger"
          footer={loading ? undefined : `${defaulterCount} defaulter${defaulterCount === 1 ? "" : "s"}`}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminUserCountCard
          label="Total students"
          value={loading ? "—" : String(totalStudents)}
          icon={GraduationCap}
          accent="emerald"
        />
        <AdminUserCountCard
          label="Total parents"
          value={loading ? "—" : String(totalParents)}
          icon={Users}
          accent="sky"
        />
        <AdminUserCountCard
          label="Total teachers"
          value={loading ? "—" : String(totalTeachers)}
          icon={UserCheck}
          accent="rose"
        />
        <AdminUserCountCard
          label="Total accountants"
          value={loading ? "—" : String(totalAccountants)}
          icon={Briefcase}
          accent="slate"
        />
      </div>

      {isAdmin ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold tracking-tight text-foreground">Payroll snapshot</h2>
            <Button variant="link" asChild className="h-auto p-0 text-sm">
              <Link to="/admin/billing/payroll">Open payroll</Link>
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <AdminKpiCard
              title="Monthly payroll (configured)"
              value={loading ? "—" : fmt(totalMonthlyPayrollLiability)}
              icon={Banknote}
              progressPercent={totalMonthlyPayrollLiability > 0 ? 100 : 0}
              tone="neutral"
            />
            <AdminKpiCard
              title="Paid this month"
              value={loading ? "—" : fmt(payrollPaidThisMonth)}
              icon={TrendingUp}
              progressPercent={
                totalMonthlyPayrollLiability > 0
                  ? Math.min(100, (payrollPaidThisMonth / totalMonthlyPayrollLiability) * 100)
                  : 0
              }
              tone="success"
            />
            <AdminKpiCard
              title="Pending this month"
              value={loading ? "—" : fmt(payrollPendingThisMonth)}
              icon={AlertCircle}
              progressPercent={
                totalMonthlyPayrollLiability > 0
                  ? Math.min(100, (payrollPendingThisMonth / totalMonthlyPayrollLiability) * 100)
                  : 0
              }
              tone={payrollPendingThisMonth > 0 ? "warning" : "success"}
            />
          </div>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <CollectionsOverviewChart
            data={collectionsByMonth}
            currency={currency}
            loading={loading}
          />
          {!loading ? (
            <div className="mt-4 flex flex-wrap gap-6 border-t border-border/60 pt-4 text-sm text-muted-foreground">
              <span>
                <span className="font-medium text-foreground">Fees this week:</span>{" "}
                {fmt(feesDueThisWeek)}
              </span>
              <span>
                <span className="font-medium text-foreground">Collection rate:</span>{" "}
                {collectionRate.toFixed(1)}%
              </span>
              <span>
                <span className="font-medium text-foreground">Total users:</span> {totalUsers}
              </span>
            </div>
          ) : null}
        </div>
        <div className="lg:col-span-2">
          <FeeCollectionDonutCard
            collected={totalCollected}
            outstanding={outstandingBalance}
            collectionRatePercent={collectionRate}
            defaulterCount={defaulterCount}
            currency={currency}
            loading={loading}
          />
        </div>
      </div>

      {isAdmin ? <RecentPaystackPayments /> : null}
      <RecentActivity />
    </div>
  );
}

export default BillingDashboard;
