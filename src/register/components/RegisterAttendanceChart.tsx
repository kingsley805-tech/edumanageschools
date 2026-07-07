import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <Card className="card-interactive overflow-hidden border-border/80 dark:border-white/10 dark:bg-[#0b0f0d]">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">Term attendance summary</CardTitle>
        <div className="text-right">
          <StatCounter
            value={percent}
            formatter={(v) => `${Math.round(v)}%`}
            className="text-2xl font-bold text-emerald-400 tabular-nums"
          />
          <p className="text-[11px] text-muted-foreground">attendance rate</p>
        </div>
      </CardHeader>
      <CardContent>
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
        <p className="mt-2 text-center text-sm text-muted-foreground">
          {present} present · {absent} absent · {late} late
        </p>
      </CardContent>
    </Card>
  );
}
