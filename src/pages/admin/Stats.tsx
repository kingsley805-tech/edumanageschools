import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { PortalPageHeader } from "@/components/PortalPageHeader";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import {
  Users,
  DollarSign,
  CalendarCheck,
  TrendingUp,
  GraduationCap,
  Wallet,
} from "lucide-react";
import { AnimatedBarChart } from "@/components/charts/AnimatedBarChart";
import { InteractiveBarChart } from "@/components/charts/InteractiveBarChart";
import { ChartCard } from "@/components/charts/ChartCard";
import { StatCounter } from "@/components/charts/StatCounter";
import { useBillingAuth } from "@/billing/hooks/useBillingAuth";
import { useBillingDashboardData } from "@/billing/hooks/useBillingDashboardData";
import CollectionsOverviewChart from "@/billing/components/dashboard/CollectionsOverviewChart";
import {
  fetchSchoolAttendanceStats,
  fetchSchoolAttendanceTrend,
} from "@/lib/attendance-queries";
import { formatMoney } from "@/lib/currency";
import { supabase } from "@/integrations/supabase/client";

function KpiCard({
  title,
  value,
  formatter,
  icon: Icon,
  color,
  delay = 0,
}: {
  title: string;
  value: number;
  formatter?: (v: number) => string;
  icon: typeof Users;
  color: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.4, 0, 0.2, 1] }}
    >
      <Card className="card-interactive overflow-hidden">
        <CardContent className="flex items-center gap-4 p-4 md:p-5">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${color}`}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-muted-foreground md:text-sm">
              {title}
            </p>
            <StatCounter
              value={value}
              formatter={formatter}
              className="text-xl font-bold tabular-nums md:text-2xl"
            />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

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
      <div className="space-y-4 md:space-y-6">
        <PortalPageHeader
          title="Statistics"
          description="A catchy, at-a-glance view of active users, finance, and everything happening in your school."
        />

        {/* KPI row */}
        <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
          <KpiCard
            title="Total users"
            value={totalUsers}
            icon={Users}
            color="bg-primary/10 text-primary"
            delay={0}
          />
          <KpiCard
            title="Revenue collected"
            value={billing.totalCollected}
            formatter={(v) =>
              formatMoney(v, billing.currency, { maximumFractionDigits: 0 })
            }
            icon={DollarSign}
            color="bg-success/10 text-success"
            delay={0.05}
          />
          <KpiCard
            title="Collection rate"
            value={billing.collectionRate}
            formatter={(v) => `${Math.round(v)}%`}
            icon={TrendingUp}
            color="bg-info/10 text-info"
            delay={0.1}
          />
          <KpiCard
            title="Attendance rate"
            value={attendanceRate}
            formatter={(v) => `${Math.round(v)}%`}
            icon={CalendarCheck}
            color="bg-warning/10 text-warning"
            delay={0.15}
          />
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
