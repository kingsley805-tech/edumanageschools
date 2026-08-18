import { useMemo, useId } from "react";
import { motion } from "framer-motion";
import {
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CHART_AXIS,
  CHART_CURRENT_GRADIENT,
  CHART_GRID,
} from "@/components/charts/chartTheme";
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart";

export type BarSeries = {
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

type CustomTooltipProps = {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
  valueFormatter?: (value: number) => string;
};

function CustomTooltipContent({
  active,
  payload,
  label,
  valueFormatter,
}: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border/70 bg-popover/95 px-3 py-2 text-xs shadow-xl backdrop-blur-sm">
      {label ? (
        <p className="mb-1 font-semibold text-popover-foreground">{label}</p>
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

type AnimatedBarChartProps = {
  data?: Record<string, string | number>[];
  categoryKey?: string;
  series?: BarSeries[];
  height?: number;
  layout?: "horizontal" | "vertical";
  stacked?: boolean;
  loading?: boolean;
  emptyMessage?: string;
  showLegend?: boolean;
  valueFormatter?: (value: number) => string;
  barSize?: number;
  className?: string;
  yAxisWidth?: number;
};

/**
 * Professional, animated bar chart used across dashboards & stats pages.
 * Built on the shadcn `ChartContainer`/`ChartTooltip` primitives (same
 * theming pipeline as the rest of the design system) + Recharts + Framer
 * Motion for entrance animation and smooth hover feedback.
 */
export function AnimatedBarChart({
  data = [],
  categoryKey = "label",
  series = [],
  height = 280,
  layout = "horizontal",
  stacked = false,
  loading = false,
  emptyMessage = "No data available yet",
  showLegend = true,
  valueFormatter,
  barSize,
  className,
  yAxisWidth = 42,
}: AnimatedBarChartProps) {
  const gradientId = useId().replace(/:/g, "");
  const isEmpty = useMemo(
    () =>
      !data.length ||
      !series.length ||
      data.every((row) => series.every((s) => !Number(row[s.key]))),
    [data, series],
  );

  const config = useMemo<ChartConfig>(
    () =>
      series.reduce((acc, s) => {
        acc[s.key] = { label: s.label, color: s.color };
        return acc;
      }, {} as ChartConfig),
    [series],
  );

  if (loading) {
    return (
      <Skeleton
        className={cn("w-full rounded-xl", className)}
        style={{ height }}
      />
    );
  }

  if (isEmpty) {
    return (
      <div
        className={cn(
          "flex w-full items-center justify-center rounded-xl border border-dashed border-border/70 bg-muted/20 text-sm text-muted-foreground",
          className,
        )}
        style={{ height }}
      >
        {emptyMessage}
      </div>
    );
  }

  const isVertical = layout === "vertical";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      className={cn("w-full rounded-xl dark:bg-[#0b0f0d] dark:border-white/10", className)}
    >
      <ChartContainer
        config={config}
        className="aspect-auto w-full"
        style={{ height }}
      >
        <RechartsBarChart
          accessibilityLayer
          data={data}
          layout={isVertical ? "vertical" : "horizontal"}
          margin={{ top: 8, right: 12, left: isVertical ? 0 : -12, bottom: 0 }}
          barGap={4}
          barCategoryGap={stacked ? "20%" : "24%"}
        >
          <defs>
            {series.map((s, i) => (
              <linearGradient key={s.key} id={`${gradientId}-${s.key}`} x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor={CHART_CURRENT_GRADIENT.start} stopOpacity={stacked ? 1 - i * 0.15 : 1} />
                <stop offset="100%" stopColor={s.color || CHART_CURRENT_GRADIENT.end} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid
            stroke={CHART_GRID}
            strokeOpacity={1}
            horizontal={!isVertical}
            vertical={isVertical}
          />

          {isVertical ? (
            <>
              <XAxis
                type="number"
                tickLine={false}
                axisLine={false}
                tick={{ fill: CHART_AXIS, fontSize: 11 }}
                tickFormatter={valueFormatter}
              />
              <YAxis
                type="category"
                dataKey={categoryKey}
                width={yAxisWidth}
                tickLine={false}
                axisLine={false}
                tick={{ fill: CHART_AXIS, fontSize: 11 }}
              />
            </>
          ) : (
            <>
              <XAxis
                dataKey={categoryKey}
                tickLine={false}
                axisLine={false}
                tick={{ fill: CHART_AXIS, fontSize: 11 }}
                tickMargin={8}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={yAxisWidth}
                tick={{ fill: CHART_AXIS, fontSize: 11 }}
                tickFormatter={valueFormatter}
              />
            </>
          )}

          <ChartTooltip
            cursor={{ fill: "rgba(16, 185, 129, 0.08)" }}
            content={<CustomTooltipContent valueFormatter={valueFormatter} />}
          />

          {series.map((s, i) => {
            const isTopOfStack = !stacked || i === series.length - 1;
            const radius: [number, number, number, number] = isVertical
              ? isTopOfStack
                ? [0, 6, 6, 0]
                : [0, 0, 0, 0]
              : isTopOfStack
                ? [6, 6, 0, 0]
                : [0, 0, 0, 0];

            return (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.label}
                fill={`url(#${gradientId}-${s.key})`}
                stackId={stacked ? "stack" : undefined}
                radius={radius}
                maxBarSize={barSize ?? 42}
                isAnimationActive
                animationDuration={900}
                animationEasing="ease-out"
                animationBegin={i * 120}
                activeBar={{
                  fillOpacity: 1,
                  stroke: s.color,
                  strokeWidth: 1.5,
                }}
              />
            );
          })}
        </RechartsBarChart>
      </ChartContainer>
      {showLegend && series.length > 1 ? (
        <div className="mt-2 flex flex-wrap items-center justify-center gap-4 text-xs">
          {series.map((s) => (
            <div key={s.key} className="flex items-center gap-1.5">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: s.color }}
              />
              <span className="text-muted-foreground">{s.label}</span>
            </div>
          ))}
        </div>
      ) : null}
    </motion.div>
  );
}
