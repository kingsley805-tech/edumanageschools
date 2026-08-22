// @ts-nocheck
import { useEffect, useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useBillingAuth } from "@/billing/hooks/useBillingAuth";
import { useBillingDashboardData } from "@/billing/hooks/useBillingDashboardData";
import { ExportMenu } from "@/modules/lib/ExportMenu";
import AdminKpiCard from "@/billing/components/dashboard/AdminKpiCard";
import CollectionsOverviewChart from "@/billing/components/dashboard/CollectionsOverviewChart";
import FeeCollectionDonutCard from "@/billing/components/dashboard/FeeCollectionDonutCard";
import RevenueChart from "@/billing/components/dashboard/RevenueChart";
import PaymentStatusChart from "@/billing/components/dashboard/PaymentStatusChart";
import { AnimatedBarChart } from "@/components/charts/AnimatedBarChart";
import { DashboardChartCard } from "@/components/metronic/DashboardStatCard";
import { formatMoney } from "@/lib/currency";
import { AlertCircle, DollarSign, FileText, TrendingUp } from "lucide-react";

type InvoiceRow = { student_id: string | null; status: string };
type PaymentRow = { amount: number; method: string };
type StudentRow = { id: string; class_id: string | null };
type ClassRow = { id: string; name: string; stream: string | null };

const PAID_COLOR = "hsl(152, 60%, 42%)";
const PENDING_COLOR = "hsl(38, 92%, 50%)";
const OVERDUE_COLOR = "hsl(0, 72%, 51%)";
const PRIMARY_BAR = "hsl(173, 80%, 42%)";

export default function BillingReports() {
  const { schoolId } = useBillingAuth();
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
    loading: dashboardLoading,
  } = useBillingDashboardData();

  const [breakdownLoading, setBreakdownLoading] = useState(true);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);

  useEffect(() => {
    const fetchBreakdown = async () => {
      if (!schoolId) {
        setInvoices([]);
        setPayments([]);
        setStudents([]);
        setClasses([]);
        setBreakdownLoading(false);
        return;
      }

      setBreakdownLoading(true);
      const [invoiceRes, paymentRes, studentRes, classRes] = await Promise.all([
        supabase.from("billing_invoices").select("student_id, status").eq("school_id", schoolId),
        supabase.from("billing_payments").select("amount, method").eq("school_id", schoolId).eq("status", "paid"),
        supabase.from("students").select("id, class_id").eq("school_id", schoolId),
        supabase.from("classes").select("id, name, stream").eq("school_id", schoolId).order("level"),
      ]);

      setInvoices((invoiceRes.data || []) as InvoiceRow[]);
      setPayments((paymentRes.data || []) as PaymentRow[]);
      setStudents((studentRes.data || []) as StudentRow[]);
      setClasses((classRes.data || []) as ClassRow[]);
      setBreakdownLoading(false);
    };

    void fetchBreakdown();
  }, [schoolId]);

  const loading = dashboardLoading || breakdownLoading;

  const fmt = (value: number) =>
    formatMoney(value, currency, { maximumFractionDigits: 0 });
  const pct = (part: number, whole: number) =>
    whole > 0 ? Math.min(100, (part / whole) * 100) : 0;

  const revenueByMonth = useMemo(
    () =>
      collectionsByMonth.map((row) => ({
        month: row.month,
        revenue: row.online + row.manual,
      })),
    [collectionsByMonth],
  );

  const methodData = useMemo(() => {
    const totals = new Map<string, number>();
    for (const p of payments) {
      const methodName = (p.method || "other").replace(/_/g, " ");
      totals.set(methodName, (totals.get(methodName) || 0) + Number(p.amount || 0));
    }
    return [...totals.entries()]
      .map(([method, amount]) => ({ method, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [payments]);

  const methodChartData = useMemo(
    () => methodData.map((row) => ({ method: row.method, amount: row.amount })),
    [methodData],
  );

  const classData = useMemo(() => {
    const studentToClass = new Map(students.map((s) => [s.id, s.class_id]));
    const className = (classId: string | null) => {
      if (!classId) return "Unassigned";
      const cls = classes.find((c) => c.id === classId);
      if (!cls) return "Unassigned";
      return cls.stream ? `${cls.name} ${cls.stream}` : cls.name;
    };

    const totals = new Map<string, { name: string; paid: number; pending: number; overdue: number }>();
    for (const inv of invoices) {
      const name = className(inv.student_id ? (studentToClass.get(inv.student_id) || null) : null);
      const row = totals.get(name) || { name, paid: 0, pending: 0, overdue: 0 };
      if (inv.status === "paid") row.paid += 1;
      else if (inv.status === "overdue") row.overdue += 1;
      else row.pending += 1;
      totals.set(name, row);
    }
    return [...totals.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [invoices, students, classes]);

  const classChartData = useMemo(
    () =>
      classData.map((row) => ({
        name: row.name,
        paid: row.paid,
        pending: row.pending,
        overdue: row.overdue,
      })),
    [classData],
  );

  const statusChartData = useMemo(() => {
    const paid = invoices.filter((i) => i.status === "paid").length;
    const overdue = invoices.filter((i) => i.status === "overdue").length;
    const pending = Math.max(0, invoices.length - paid - overdue);
    const total = invoices.length || 1;
    return [
      { name: "Paid", value: Math.round((paid / total) * 100), color: PAID_COLOR },
      { name: "Pending", value: Math.round((pending / total) * 100), color: PENDING_COLOR },
      { name: "Overdue", value: Math.round((overdue / total) * 100), color: OVERDUE_COLOR },
    ];
  }, [invoices]);

  const exportHeaders = ["Method", "Amount"];
  const exportRows = methodData.map((row) => [row.method, String(row.amount)]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Reports</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {schoolName ? `${schoolName} · ` : ""}financial reports and analytics
          </p>
        </div>
        <ExportMenu
          filename="reports-payment-methods"
          title="Revenue by Payment Method"
          headers={exportHeaders}
          rows={exportRows}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <AdminKpiCard
          title="Total fees billed"
          value={dashboardLoading ? "—" : fmt(totalBilled)}
          icon={DollarSign}
          progressPercent={totalBilled > 0 ? 100 : 0}
          tone="neutral"
        />
        <AdminKpiCard
          title="Amount collected"
          value={dashboardLoading ? "—" : fmt(totalCollected)}
          icon={TrendingUp}
          progressPercent={collectionRate}
          tone="success"
          footer={dashboardLoading ? undefined : `${collectionRate.toFixed(0)}% collection rate`}
        />
        <AdminKpiCard
          title="Outstanding balance"
          value={dashboardLoading ? "—" : fmt(outstandingBalance)}
          icon={FileText}
          progressPercent={pct(outstandingBalance, totalBilled)}
          tone="warning"
          footer={dashboardLoading ? undefined : `${pct(outstandingBalance, totalBilled).toFixed(0)}% unpaid`}
        />
        <AdminKpiCard
          title="Overdue fees"
          value={dashboardLoading ? "—" : fmt(overdueFees)}
          icon={AlertCircle}
          progressPercent={pct(overdueFees, totalBilled)}
          tone="danger"
          footer={dashboardLoading ? undefined : `${defaulterCount} defaulter${defaulterCount === 1 ? "" : "s"}`}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <CollectionsOverviewChart
            data={collectionsByMonth}
            currency={currency}
            loading={dashboardLoading}
          />
        </div>
        <div className="lg:col-span-2">
          <FeeCollectionDonutCard
            collected={totalCollected}
            outstanding={outstandingBalance}
            collectionRatePercent={collectionRate}
            defaulterCount={defaulterCount}
            currency={currency}
            loading={dashboardLoading}
          />
        </div>
      </div>

      <RevenueChart data={revenueByMonth} currency={currency} loading={dashboardLoading} />

      <Tabs defaultValue="method" className="space-y-5">
        <TabsList>
          <TabsTrigger value="method">By payment method</TabsTrigger>
          <TabsTrigger value="class">By class</TabsTrigger>
          <TabsTrigger value="status">Invoice status</TabsTrigger>
        </TabsList>

        <TabsContent value="method" className="mt-0">
          <DashboardChartCard
            title="Revenue by payment method"
            description="Paid transaction totals grouped by method"
          >
            <AnimatedBarChart
              data={methodChartData}
              categoryKey="method"
              series={[{ key: "amount", label: "Amount", color: PRIMARY_BAR }]}
              height={320}
              loading={loading}
              emptyMessage="No payment data yet"
              showLegend={false}
              valueFormatter={(v) => fmt(v)}
            />
          </DashboardChartCard>
        </TabsContent>

        <TabsContent value="class" className="mt-0">
          <DashboardChartCard
            title="Invoice status by class"
            description="Paid, pending, and overdue counts per class"
          >
            <AnimatedBarChart
              data={classChartData}
              categoryKey="name"
              layout="vertical"
              stacked
              height={Math.max(280, classChartData.length * 36)}
              loading={loading}
              emptyMessage="No invoice data by class yet"
              valueFormatter={(v) => String(v)}
              series={[
                { key: "paid", label: "Paid", color: PAID_COLOR },
                { key: "pending", label: "Pending", color: PENDING_COLOR },
                { key: "overdue", label: "Overdue", color: OVERDUE_COLOR },
              ]}
              yAxisWidth={88}
            />
          </DashboardChartCard>
        </TabsContent>

        <TabsContent value="status" className="mt-0">
          <PaymentStatusChart data={statusChartData} loading={loading} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
