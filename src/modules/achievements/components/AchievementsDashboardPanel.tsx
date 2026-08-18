import { useMemo } from "react";
import { Award, CheckCircle2, Clock, FileBadge, Medal, Trophy } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ChartCard } from "@/components/charts/ChartCard";
import { StatCounter } from "@/components/charts/StatCounter";
import { AnimatedBarChart } from "@/components/charts/AnimatedBarChart";
import { CHART_CURRENT_SOLID } from "@/components/charts/chartTheme";
import type { AchievementsDashboardStats } from "@/modules/achievements/lib/types";

type Props = { stats: AchievementsDashboardStats };

function Kpi({
  title,
  value,
  icon: Icon,
  color,
}: {
  title: string;
  value: number;
  icon: typeof Award;
  color: string;
}) {
  return (
    <Card className="card-interactive overflow-hidden">
      <CardContent className="flex items-center gap-4 p-4 md:p-5">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-muted-foreground">{title}</p>
          <StatCounter value={value} className="text-xl font-bold tabular-nums md:text-2xl" />
        </div>
      </CardContent>
    </Card>
  );
}

export function AchievementsDashboardPanel({ stats }: Props) {
  const chartData = useMemo(
    () => [
      { label: "Awards", value: stats.awards },
      { label: "Certificates", value: stats.certificates },
      { label: "Competitions", value: stats.competitions },
      { label: "Pending", value: stats.pending },
    ],
    [stats],
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Kpi title="Total" value={stats.total} icon={Trophy} color="bg-primary/10 text-primary" />
        <Kpi title="Published" value={stats.published} icon={CheckCircle2} color="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" />
        <Kpi title="Pending approval" value={stats.pending} icon={Clock} color="bg-amber-500/10 text-amber-700 dark:text-amber-400" />
        <Kpi title="Approved" value={stats.approved} icon={Medal} color="bg-sky-500/10 text-sky-700 dark:text-sky-400" />
        <Kpi title="Awards" value={stats.awards} icon={Award} color="bg-violet-500/10 text-violet-700 dark:text-violet-400" />
        <Kpi title="Certificates" value={stats.certificates} icon={FileBadge} color="bg-rose-500/10 text-rose-700 dark:text-rose-400" />
      </div>
      <ChartCard title="Achievement mix" description="Breakdown by type and pipeline status">
        <AnimatedBarChart
          data={chartData}
          categoryKey="label"
          series={[{ key: "value", label: "Count", color: CHART_CURRENT_SOLID }]}
          showLegend={false}
        />
      </ChartCard>
    </div>
  );
}
