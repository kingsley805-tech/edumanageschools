import { useMemo } from "react";
import {
  BedDouble,
  Building2,
  DoorOpen,
  DollarSign,
  TrendingUp,
  Users,
  UserRound,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ChartCard } from "@/components/charts/ChartCard";
import { StatCounter } from "@/components/charts/StatCounter";
import { AnimatedBarChart } from "@/components/charts/AnimatedBarChart";
import { motion } from "framer-motion";
import { formatMoney } from "@/lib/currency";
import type { HostelDashboardStats } from "@/modules/hostel/lib/types";

type Props = {
  stats: HostelDashboardStats;
  currency?: string | null;
  formatCurrency?: (amount: number) => string;
};

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
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${color}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-muted-foreground md:text-sm">{title}</p>
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

export function HostelDashboardPanel({ stats, currency, formatCurrency }: Props) {
  const money = formatCurrency ?? ((v: number) => formatMoney(v, currency));

  const occupancyChartData = useMemo(
    () => [
      { label: "Occupied", value: stats.occupied_beds },
      { label: "Available", value: stats.available_beds },
    ],
    [stats.occupied_beds, stats.available_beds],
  );

  const hasOccupancy = stats.total_bed_capacity > 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <KpiCard title="Total Hostels" value={stats.total_hostels} icon={Building2} color="bg-blue-500/10 text-blue-600" delay={0} />
        <KpiCard title="Total Rooms" value={stats.total_rooms} icon={DoorOpen} color="bg-violet-500/10 text-violet-600" delay={0.04} />
        <KpiCard title="Total Bed Capacity" value={stats.total_bed_capacity} icon={BedDouble} color="bg-indigo-500/10 text-indigo-600" delay={0.08} />
        <KpiCard title="Occupied Beds" value={stats.occupied_beds} icon={Users} color="bg-amber-500/10 text-amber-600" delay={0.12} />
        <KpiCard title="Available Beds" value={stats.available_beds} icon={BedDouble} color="bg-emerald-500/10 text-emerald-600" delay={0.16} />
        <KpiCard title="Total Hostel Students" value={stats.total_students} icon={Users} color="bg-cyan-500/10 text-cyan-600" delay={0.2} />
        <KpiCard title="Male Students" value={stats.male_students} icon={UserRound} color="bg-sky-500/10 text-sky-600" delay={0.24} />
        <KpiCard title="Female Students" value={stats.female_students} icon={UserRound} color="bg-pink-500/10 text-pink-600" delay={0.28} />
        <KpiCard title="Fee Collection" value={stats.fee_collected} formatter={money} icon={DollarSign} color="bg-green-500/10 text-green-600" delay={0.32} />
        <KpiCard title="Outstanding" value={stats.outstanding_fees} formatter={money} icon={TrendingUp} color="bg-red-500/10 text-red-600" delay={0.36} />
      </div>

      {hasOccupancy ? (
        <ChartCard
          title="Occupancy Overview"
          description={`${stats.occupancy_rate.toFixed(1)}% occupancy rate across all hostels`}
          icon={<BedDouble className="h-4 w-4" />}
          className="dark:bg-[#0b0f0d]"
        >
          <AnimatedBarChart
            data={occupancyChartData}
            categoryKey="label"
            series={[
              { key: "value", label: "Beds", color: "hsl(var(--chart-1))" },
            ]}
            height={220}
            showLegend={false}
            className="dark:bg-[#0b0f0d]"
          />
        </ChartCard>
      ) : null}
    </div>
  );
}
