import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import {
  Users,
  GraduationCap,
  Wallet,
} from "lucide-react";
import { AnimatedBarChart } from "@/components/charts/AnimatedBarChart";
import { InteractiveBarChart } from "@/components/charts/InteractiveBarChart";
import { ChartCard } from "@/components/charts/ChartCard";
import { useBillingAuth } from "@/billing/hooks/useBillingAuth";
import { useBillingDashboardData } from "@/billing/hooks/useBillingDashboardData";
import CollectionsOverviewChart from "@/billing/components/dashboard/CollectionsOverviewChart";
import {
  fetchSchoolAttendanceStats,
  fetchSchoolAttendanceTrend,
} from "@/lib/attendance-queries";
import { formatMoney } from "@/lib/currency";
import { supabase } from "@/integrations/supabase/client";

export default function AdminStats() {
  const { schoolId } = useBillingAuth();
  const billing = useBillingDashboardData();

  const [attendanceRate, setAttendanceRate] = useState(0);
  const [attendanceTrend, setAttendanceTrend] = useState<
    { date: string; present: number; absent: number }[]
  >([]);
  const [enrollmentByClass, setEnrollmentByClass] = useState<
    { grade: string; students: number }[]
  >([]);
  const [loadingEverything, setLoadingEverything] = useState(true);

  useEffect(() => {
    if (!schoolId) return;

    (async () => {
      setLoadingEverything(true);
      try {
        const [stats, trend, classesRes] = await Promise.all([
          fetchSchoolAttendanceStats(schoolId),
          fetchSchoolAttendanceTrend(schoolId, 14),
          supabase.from("classes").select("id, name").eq("school_id", schoolId),
        ]);

        setAttendanceRate(stats.rate);
        setAttendanceTrend(trend);

        const classes = classesRes.data ?? [];
        const distribution = await Promise.all(
          classes.map(async (cls: { id: string; name: string }) => {
            const { count } = await supabase
              .from("students")
              .select("id", { count: "exact", head: true })
              .eq("class_id", cls.id);
            return { grade: cls.name, students: count || 0 };
          }),
        );
        setEnrollmentByClass(
          distribution.sort((a, b) => b.students - a.students).slice(0, 10),
        );
      } finally {
        setLoadingEverything(false);
      }
    })();
  }, [schoolId]);

  const totalUsers =
    billing.totalStudents +
    billing.totalTeachers +
    billing.totalParents +
    billing.totalAccountants;

  const activeUsersData = [
    { role: "Students", count: billing.totalStudents },
    { role: "Teachers", count: billing.totalTeachers },
    { role: "Parents", count: billing.totalParents },
    { role: "Accountants", count: billing.totalAccountants },
  ];

  const financeBreakdown = [
    {
      label: "This term",
      collected: billing.totalCollected,
      outstanding: billing.outstandingBalance,
      overdue: billing.overdueFees,
    },
  ];

  return (
    <DashboardLayout role="admin">
      <div className="mingo-content space-y-4 md:space-y-6">
        <div className="mingo-page-head">
          <div>
            <h1>Statistics</h1>
            <p>A catchy, at-a-glance view of active users, finance, and everything happening in your school.</p>
          </div>
        </div>

        {/* KPI row */}
        <div className="mingo-kpi-row">
          <div className="mingo-kpi">
            <div className="label">Total Users</div>
            <div className="val mono">{totalUsers}</div>
          </div>
          <div className="mingo-kpi">
            <div className="label">Revenue Collected</div>
            <div className="val mono">
              {formatMoney(billing.totalCollected, billing.currency, { maximumFractionDigits: 0 })}
            </div>
          </div>
          <div className="mingo-kpi">
            <div className="label">Collection Rate</div>
            <div className="val mono">{Math.round(billing.collectionRate)}%</div>
          </div>
          <div className="mingo-kpi">
            <div className="label">Attendance Rate</div>
            <div className="val mono">{Math.round(attendanceRate)}%</div>
          </div>
        </div>

        {/* Active users */}
        <ChartCard
          title="Active users"
          description="Registered accounts by role across your school"
          icon={<Users className="h-4 w-4" />}
        >
          <AnimatedBarChart
            data={activeUsersData}
            categoryKey="role"
            layout="vertical"
            height={220}
            showLegend={false}
            loading={billing.loading}
            series={[
              { key: "count", label: "Users", color: "hsl(var(--primary))" },
            ]}
          />
        </ChartCard>

        {/* Finance */}
        <div className="grid gap-4 md:gap-6 lg:grid-cols-2">
          <div className="lg:col-span-1">
            <CollectionsOverviewChart
              data={billing.collectionsByMonth}
              currency={billing.currency}
              loading={billing.loading}
            />
          </div>
          <ChartCard
            title="Fees at a glance"
            description="Collected vs outstanding vs overdue this term"
            icon={<Wallet className="h-4 w-4" />}
            delay={0.05}
          >
            <AnimatedBarChart
              data={financeBreakdown}
              categoryKey="label"
              layout="vertical"
              height={220}
              loading={billing.loading}
              valueFormatter={(v) =>
                formatMoney(v, billing.currency, { maximumFractionDigits: 0 })
              }
              series={[
                {
                  key: "collected",
                  label: "Collected",
                  color: "hsl(160, 83%, 30%)",
                },
                {
                  key: "outstanding",
                  label: "Outstanding",
                  color: "hsl(38, 92%, 50%)",
                },
                { key: "overdue", label: "Overdue", color: "hsl(0, 84%, 60%)" },
              ]}
            />
          </ChartCard>
        </div>

        {/* Everything else */}
        <div className="grid gap-4 md:gap-6 lg:grid-cols-2">
          <InteractiveBarChart
            title="Daily attendance trend"
            description="Last 14 days — click a metric to focus it"
            data={attendanceTrend}
            categoryKey="date"
            height={240}
            loading={loadingEverything}
            metrics={[
              { key: "present", label: "Present", color: "hsl(142 71% 45%)" },
              { key: "absent", label: "Absent", color: "hsl(0 84% 60%)" },
            ]}
          />

          <ChartCard
            title="Enrollment by class"
            description="Students enrolled per class"
            icon={<GraduationCap className="h-4 w-4" />}
            delay={0.05}
          >
            <AnimatedBarChart
              data={enrollmentByClass}
              categoryKey="grade"
              layout="vertical"
              height={Math.max(220, enrollmentByClass.length * 36)}
              showLegend={false}
              loading={loadingEverything}
              series={[
                {
                  key: "students",
                  label: "Students",
                  color: "hsl(var(--accent))",
                },
              ]}
            />
          </ChartCard>
        </div>
      </div>
    </DashboardLayout>
  );
}
