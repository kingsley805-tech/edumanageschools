import { Card, CardContent } from "@/components/ui/card";
import { TrendingDown, TrendingUp } from "lucide-react";
import type { RegisterDashboardStats } from "@/register/lib/types";

export function RegisterStatsCards({ stats }: { stats: RegisterDashboardStats }) {
  const items = [
    {
      label: "Today's attendance",
      value: `${stats.attendanceTodayPercent}%`,
      sub:
        stats.attendanceTrend >= 0
          ? `↑ ${stats.attendanceTrend}% vs yesterday`
          : `↓ ${Math.abs(stats.attendanceTrend)}% vs yesterday`,
      trendUp: stats.attendanceTrend >= 0,
    },
    {
      label: "Registers submitted",
      value: `${stats.registersSubmitted} / ${stats.registersExpected}`,
      sub: `${Math.max(0, stats.registersExpected - stats.registersSubmitted)} pending submission`,
    },
    {
      label: "Pending approval",
      value: String(stats.pendingApproval),
      sub: "Awaiting admin review",
    },
    {
      label: "Absent today",
      value: String(stats.absentToday),
      sub: `Across ${stats.totalClasses} classes`,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <Card key={item.label} className="border-border/80 shadow-sm">
          <CardContent className="pt-5 pb-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{item.label}</p>
            <p className="text-2xl font-bold mt-1">{item.value}</p>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              {item.trendUp !== undefined &&
                (item.trendUp ? (
                  <TrendingUp className="h-3 w-3 text-emerald-500" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-amber-500" />
                ))}
              {item.sub}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
