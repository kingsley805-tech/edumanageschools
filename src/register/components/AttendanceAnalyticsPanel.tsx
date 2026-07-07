import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendComparisonChart } from "@/components/charts/TrendComparisonChart";
import { AnimatedBarChart } from "@/components/charts/AnimatedBarChart";
import { RegisterAttendanceChart } from "@/register/components/RegisterAttendanceChart";
import type { AttendanceSummary } from "@/register/lib/attendance";

type MonthlyPoint = {
  month: string;
  present: number;
  absent: number;
  late: number;
  rate: number;
};

type Props = {
  summary: AttendanceSummary | null | undefined;
  classSummary?: AttendanceSummary | null;
  monthlyTrend?: MonthlyPoint[];
  loading?: boolean;
  compact?: boolean;
};

export function AttendanceAnalyticsPanel({
  summary,
  classSummary,
  monthlyTrend = [],
  loading,
  compact,
}: Props) {
  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  const studentPct = summary?.attendance_percentage ?? 0;
  const classPct = classSummary?.attendance_percentage ?? 0;
  const present = summary?.present_count ?? 0;
  const absent = summary?.absent_count ?? 0;
  const late = summary?.late_count ?? 0;
  const excused = summary?.excused_count ?? 0;

  const compareData = [{ name: "Breakdown", present, absent, late, excused }];

  const rateComparison = [
    { label: "Student", rate: studentPct },
    { label: "Class", rate: classPct },
  ].filter((d) => d.rate > 0 || summary || classSummary);

  const monthlyTrendData = monthlyTrend.map((row, index, arr) => ({
    label: row.month,
    current: row.present,
    previous: index > 0 ? arr[index - 1]?.present ?? 0 : 0,
    secondary: row.absent,
  }));

  if (!summary && !classSummary && monthlyTrend.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Attendance statistics will appear here once teachers start recording
          attendance.
        </CardContent>
      </Card>
    );
  }

  return (
    <div
      className={`grid gap-4 ${compact ? "md:grid-cols-2" : "lg:grid-cols-2"}`}
    >
      <RegisterAttendanceChart
        percent={Math.round(studentPct)}
        present={present}
        absent={absent}
        late={late}
      />

      <div className="overflow-hidden rounded-xl border border-border/70 bg-card dark:border-white/10 dark:bg-[#0b0f0d]">
        <div className="border-b border-border/50 px-4 py-4 dark:border-white/10">
          <h3 className="text-sm font-semibold">Present vs absent vs late</h3>
          <p className="text-xs text-muted-foreground">Term breakdown</p>
        </div>
        <div className="p-4">
          <AnimatedBarChart
            data={compareData}
            categoryKey="name"
            height={200}
            stacked
            series={[
              { key: "present", label: "Present", color: "#34d399" },
              { key: "absent", label: "Absent", color: "#f87171" },
              { key: "late", label: "Late", color: "#fbbf24" },
              { key: "excused", label: "Excused", color: "#60a5fa" },
            ]}
          />
        </div>
      </div>

      {monthlyTrend.length > 0 ? (
        <div className="lg:col-span-2">
          <TrendComparisonChart
            title="Monthly attendance trend"
            subtitle="Present students — current month vs previous"
            data={monthlyTrendData}
            currentLabel="Present"
            previousLabel="Previous"
            secondaryLabel="Absent"
            valueFormatter={(v) => String(v)}
            height={280}
          />
        </div>
      ) : null}

      {rateComparison.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-border/70 bg-card lg:col-span-2 dark:border-white/10 dark:bg-[#0b0f0d]">
          <div className="border-b border-border/50 px-4 py-4 dark:border-white/10">
            <h3 className="text-sm font-semibold">Attendance percentage</h3>
            <p className="text-xs text-muted-foreground">Student vs class average</p>
          </div>
          <div className="p-4">
            <AnimatedBarChart
              data={rateComparison}
              categoryKey="label"
              layout="vertical"
              height={160}
              showLegend={false}
              valueFormatter={(v) => `${v}%`}
              series={[
                {
                  key: "rate",
                  label: "Attendance rate",
                  color: "#34d399",
                },
              ]}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
