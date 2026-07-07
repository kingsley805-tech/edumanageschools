import { useMemo } from "react";
import {
  AlertTriangle,
  ArrowDownUp,
  Box,
  ClipboardList,
  DollarSign,
  Package,
  PackageMinus,
  PackagePlus,
  ShoppingCart,
  Trash2,
  TrendingDown,
  Wrench,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ChartCard } from "@/components/charts/ChartCard";
import { StatCounter } from "@/components/charts/StatCounter";
import { AnimatedBarChart } from "@/components/charts/AnimatedBarChart";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { formatMoney } from "@/lib/currency";
import type { InventoryDashboardStats } from "@/modules/inventory/lib/types";

type Props = {
  stats: InventoryDashboardStats;
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
  icon: typeof Package;
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

export function InventoryDashboardPanel({ stats, currency, formatCurrency }: Props) {
  const money = formatCurrency ?? ((v: number) => formatMoney(v, currency));

  const stockChartData = useMemo(
    () => [
      { label: "Available", value: Math.max(0, stats.available_stock - stats.low_stock_items) },
      { label: "Low Stock", value: stats.low_stock_items },
      { label: "Out of Stock", value: stats.out_of_stock_items },
    ],
    [stats.available_stock, stats.low_stock_items, stats.out_of_stock_items],
  );

  const alerts = useMemo(() => {
    const list: { label: string; count: number; variant: "destructive" | "secondary" | "default" }[] = [];
    if (stats.low_stock_items > 0) list.push({ label: "Low stock items", count: stats.low_stock_items, variant: "destructive" });
    if (stats.out_of_stock_items > 0) list.push({ label: "Out of stock", count: stats.out_of_stock_items, variant: "destructive" });
    if (stats.pending_purchase_orders > 0) list.push({ label: "Pending purchase orders", count: stats.pending_purchase_orders, variant: "secondary" });
    if (stats.damaged_items > 0) list.push({ label: "Damaged assets", count: stats.damaged_items, variant: "secondary" });
    return list;
  }, [stats]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <KpiCard title="Total Inventory Items" value={stats.total_items} icon={Package} color="bg-blue-500/10 text-blue-600" />
        <KpiCard title="Total Assets" value={stats.total_assets} icon={Box} color="bg-violet-500/10 text-violet-600" delay={0.04} />
        <KpiCard title="Available Stock" value={stats.available_stock} icon={PackagePlus} color="bg-emerald-500/10 text-emerald-600" delay={0.08} />
        <KpiCard title="Low Stock Items" value={stats.low_stock_items} icon={TrendingDown} color="bg-amber-500/10 text-amber-600" delay={0.12} />
        <KpiCard title="Out-of-Stock Items" value={stats.out_of_stock_items} icon={PackageMinus} color="bg-red-500/10 text-red-600" delay={0.16} />
        <KpiCard title="Recently Added" value={stats.recently_added} icon={ClipboardList} color="bg-cyan-500/10 text-cyan-600" delay={0.2} />
        <KpiCard title="Total Inventory Value" value={stats.total_inventory_value} formatter={money} icon={DollarSign} color="bg-green-500/10 text-green-600" delay={0.24} />
        <KpiCard title="Items Issued Today" value={stats.issued_today} icon={ArrowDownUp} color="bg-indigo-500/10 text-indigo-600" delay={0.28} />
        <KpiCard title="Items Returned Today" value={stats.returned_today} icon={ArrowDownUp} color="bg-sky-500/10 text-sky-600" delay={0.32} />
        <KpiCard title="Pending Purchase Orders" value={stats.pending_purchase_orders} icon={ShoppingCart} color="bg-orange-500/10 text-orange-600" delay={0.36} />
        <KpiCard title="Damaged Items" value={stats.damaged_items} icon={Wrench} color="bg-rose-500/10 text-rose-600" delay={0.4} />
        <KpiCard title="Disposed Items" value={stats.disposed_items} icon={Trash2} color="bg-slate-500/10 text-slate-600" delay={0.44} />
      </div>

      {alerts.length > 0 ? (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="flex flex-wrap items-center gap-3 p-4">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <span className="text-sm font-medium">Active alerts</span>
            {alerts.map((a) => (
              <Badge key={a.label} variant={a.variant}>
                {a.label}: {a.count}
              </Badge>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {stats.total_items > 0 ? (
        <ChartCard
          title="Stock Health Overview"
          description="Distribution of stock levels across inventory items"
          icon={<Package className="h-4 w-4" />}
          className="dark:bg-[#0b0f0d]"
        >
          <AnimatedBarChart
            data={stockChartData}
            categoryKey="label"
            series={[{ key: "value", label: "Items", color: "hsl(var(--chart-1))" }]}
            height={220}
            showLegend={false}
            className="dark:bg-[#0b0f0d]"
          />
        </ChartCard>
      ) : null}
    </div>
  );
}
