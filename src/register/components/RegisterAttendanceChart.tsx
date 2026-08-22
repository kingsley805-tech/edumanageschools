import { DashboardChartCard } from "@/components/metronic/DashboardStatCard";
import { AnimatedBarChart } from "@/components/charts/AnimatedBarChart";
import { StatCounter } from "@/components/charts/StatCounter";

export function RegisterAttendanceChart({
  percent,
  present,
  absent,
  late,
}: {
  percent: number;
  present: number;
  absent: number;
  late: number;
}) {
  const data = [{ name: "Term", present, absent, late }];

  return (
    <DashboardChartCard
      title="Term attendance summary"
      description={`${present} present · ${absent} absent · ${late} late`}
      action={
        <div className="text-right">
          <StatCounter
            value={percent}
            formatter={(v) => `${Math.round(v)}%`}
            className="text-2xl font-semibold text-mono tabular-nums text-foreground"
          />
          <p className="text-[11px] text-secondary-foreground">attendance rate</p>
        </div>
      }
    >
      <AnimatedBarChart
        data={data}
        categoryKey="name"
        height={200}
        showLegend
        series={[
          { key: "present", label: "Present", color: "#34d399" },
          { key: "absent", label: "Absent", color: "#f87171" },
          { key: "late", label: "Late", color: "#fbbf24" },
        ]}
      />
    </DashboardChartCard>
  );
}
