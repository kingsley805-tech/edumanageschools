import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  XAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type InteractiveBarMetric = {
  key: string;
  label: string;
  color: string;
};

type TooltipPayloadEntry = {
  dataKey: string | number;
  name?: string;
  value?: number;
  color?: string;
  fill?: string;
};

function TooltipContent({
  active,
  payload,
  label,
  valueFormatter,
  labelFormatter,
}: {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
  valueFormatter?: (v: number) => string;
  labelFormatter?: (v: string) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-[150px] rounded-lg border border-border/70 bg-popover/95 px-3 py-2 text-xs shadow-xl backdrop-blur-sm">
      {label ? (
        <p className="mb-1 font-semibold text-popover-foreground">
          {labelFormatter ? labelFormatter(label) : label}
        </p>
      ) : null}
      <div className="space-y-1">
        {payload.map((entry) => (
          <div key={String(entry.dataKey)} className="flex items-center gap-2">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: entry.color || entry.fill }}
            />
            <span className="text-muted-foreground">{entry.name}:</span>
            <span className="font-semibold tabular-nums text-popover-foreground">
              {typeof entry.value === "number"
                ? valueFormatter
                  ? valueFormatter(entry.value)
                  : entry.value.toLocaleString()
                : entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

type InteractiveBarChartProps = {
  title: string;
  description?: string;
  data: Record<string, string | number>[];
  categoryKey: string;
  metrics: InteractiveBarMetric[];
  height?: number;
  loading?: boolean;
  emptyMessage?: string;
  valueFormatter?: (value: number) => string;
  categoryFormatter?: (value: string) => string;
  className?: string;
};

/**
 * Interactive trend bar chart: click a metric in the header to switch which
 * series is plotted, while seeing the running total for each. Mirrors the
 * shadcn "Bar Chart - Interactive" pattern using the shared Chart primitives.
 */
export function InteractiveBarChart({
  title,
  description,
  data,
  categoryKey,
  metrics,
  height = 250,
  loading = false,
  emptyMessage = "No data available yet",
  valueFormatter,
  categoryFormatter,
  className,
}: InteractiveBarChartProps) {
  const [activeMetric, setActiveMetric] = useState(metrics[0]?.key);

  const totals = useMemo(() => {
    const result: Record<string, number> = {};
    for (const m of metrics) {
      result[m.key] = data.reduce(
        (sum, row) => sum + (Number(row[m.key]) || 0),
        0,
      );
    }
    return result;
  }, [data, metrics]);

  const config = useMemo<ChartConfig>(
    () =>
      metrics.reduce((acc, m) => {
        acc[m.key] = { label: m.label, color: m.color };
        return acc;
      }, {} as ChartConfig),
    [metrics],
  );

  const isEmpty =
    !data.length ||
    data.every((row) => metrics.every((m) => !Number(row[m.key])));

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
    >
      <Card className={cn("card-interactive overflow-hidden py-0", className)}>
        <CardHeader className="flex flex-col items-stretch !p-0 border-b sm:flex-row">
          <div className="flex flex-1 flex-col justify-center gap-1 px-6 pt-4 pb-3 sm:!py-0">
            <CardTitle>{title}</CardTitle>
            {description ? (
              <CardDescription>{description}</CardDescription>
            ) : null}
          </div>
          <div className="flex">
            {metrics.map((metric) => (
              <button
                key={metric.key}
                type="button"
                data-active={activeMetric === metric.key}
                onClick={() => setActiveMetric(metric.key)}
                className="relative z-30 flex flex-1 flex-col justify-center gap-1 border-t px-6 py-3 text-left transition-colors even:border-l data-[active=true]:bg-muted/60 sm:border-t-0 sm:border-l sm:px-6 sm:py-4"
              >
                <span className="text-xs text-muted-foreground">
                  {metric.label}
                </span>
                <span
                  className="text-lg font-semibold leading-none tabular-nums sm:text-2xl"
                  style={{ color: metric.color }}
                >
                  {valueFormatter
                    ? valueFormatter(totals[metric.key] ?? 0)
                    : (totals[metric.key] ?? 0).toLocaleString()}
                </span>
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="px-2 pb-4 pt-4 sm:p-6">
          {loading ? (
            <Skeleton className="w-full rounded-xl" style={{ height }} />
          ) : isEmpty ? (
            <div
              className="flex w-full items-center justify-center rounded-xl border border-dashed border-border/70 bg-muted/20 text-sm text-muted-foreground"
              style={{ height }}
            >
              {emptyMessage}
            </div>
          ) : (
            <ChartContainer
              config={config}
              className="aspect-auto w-full"
              style={{ height }}
            >
              <RechartsBarChart
                accessibilityLayer
                data={data}
                margin={{ left: 12, right: 12 }}
              >
                <CartesianGrid
                  vertical={false}
                  stroke="hsl(var(--border))"
                  strokeOpacity={0.4}
                />
                <XAxis
                  dataKey={categoryKey}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={32}
                  tickFormatter={categoryFormatter}
                />
                <ChartTooltip
                  cursor={{
                    fill: "hsl(var(--muted))",
                    opacity: 0.35,
                    radius: 6,
                  }}
                  content={
                    <TooltipContent
                      valueFormatter={valueFormatter}
                      labelFormatter={categoryFormatter}
                    />
                  }
                />
                <Bar
                  dataKey={activeMetric}
                  fill={`var(--color-${activeMetric})`}
                  radius={[6, 6, 0, 0]}
                  maxBarSize={44}
                  isAnimationActive
                  animationDuration={700}
                  animationEasing="ease-out"
                />
              </RechartsBarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
