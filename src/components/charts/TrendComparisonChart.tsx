import { useId, useMemo } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import {
  CHART_AXIS,
  CHART_CURRENT_GRADIENT,
  CHART_CURRENT_SOLID,
  CHART_GRID,
  CHART_PERIOD_OPTIONS,
  CHART_PREVIOUS_LINE,
} from "@/components/charts/chartTheme";

export type TrendComparisonPoint = {
  label: string;
  current: number;
  previous?: number;
  secondary?: number;
};

type PeriodOption = { value: number; label: string };

type TooltipEntry = {
  dataKey?: string | number;
  name?: string;
  value?: number;
  color?: string;
};

function TrendTooltip({
  active,
  payload,
  label,
  currentLabel,
  previousLabel,
  secondaryLabel,
  valueFormatter,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string;
  currentLabel: string;
  previousLabel: string;
  secondaryLabel?: string;
  valueFormatter: (value: number) => string;
}) {
  if (!active || !payload?.length) return null;

  const byKey = Object.fromEntries(
    payload.map((entry) => [String(entry.dataKey), entry]),
  );

  return (
    <div className="min-w-[160px] rounded-lg border border-border/60 bg-popover/95 px-3 py-2.5 text-xs shadow-2xl backdrop-blur-md">
      {label ? <p className="mb-2 font-medium text-foreground">{label}</p> : null}
      <div className="space-y-1.5">
        {byKey.current ? (
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-2 text-muted-foreground">
              <span className="h-2.5 w-2.5 rounded-sm bg-emerald-400" />
              {currentLabel}
            </span>
            <span className="font-semibold tabular-nums text-foreground">
              {valueFormatter(Number(byKey.current.value) || 0)}
            </span>
          </div>
        ) : null}
        {byKey.previous ? (
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-2 text-muted-foreground">
              <span className="h-2.5 w-2.5 rounded-full border border-white/80" />
              {previousLabel}
            </span>
            <span className="font-semibold tabular-nums text-foreground">
              {valueFormatter(Number(byKey.previous.value) || 0)}
            </span>
          </div>
        ) : null}
        {secondaryLabel && byKey.secondary ? (
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-2 text-muted-foreground">
              <span className="h-2.5 w-2.5 rounded-sm bg-slate-400/80" />
              {secondaryLabel}
            </span>
            <span className="font-semibold tabular-nums text-foreground">
              {valueFormatter(Number(byKey.secondary.value) || 0)}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

type TrendComparisonChartProps = {
  title: string;
  subtitle?: string;
  data: TrendComparisonPoint[];
  currentLabel?: string;
  previousLabel?: string;
  secondaryLabel?: string;
  valueFormatter?: (value: number) => string;
  height?: number;
  loading?: boolean;
  emptyMessage?: string;
  className?: string;
  periodDays?: number;
  onPeriodChange?: (days: number) => void;
  periodOptions?: PeriodOption[];
  currentTotal?: number;
  previousTotal?: number;
  showPeriodSelector?: boolean;
};

export function TrendComparisonChart({
  title,
  subtitle = "Current period vs previous",
  data,
  currentLabel = "Current",
  previousLabel = "Previous",
  secondaryLabel,
  valueFormatter = (v) => v.toLocaleString(),
  height = 280,
  loading = false,
  emptyMessage = "No data available yet",
  className,
  periodDays,
  onPeriodChange,
  periodOptions = [...CHART_PERIOD_OPTIONS],
  currentTotal,
  previousTotal,
  showPeriodSelector = false,
}: TrendComparisonChartProps) {
  const gradientId = useId().replace(/:/g, "");

  const totals = useMemo(() => {
    const current =
      currentTotal ??
      data.reduce((sum, row) => sum + (Number(row.current) || 0), 0);
    const previous =
      previousTotal ??
      data.reduce((sum, row) => sum + (Number(row.previous) || 0), 0);
    return { current, previous };
  }, [currentTotal, previousTotal, data]);

  const isEmpty =
    !data.length || data.every((row) => !row.current && !row.previous && !row.secondary);

  const hasPrevious = data.some((row) => Number(row.previous) > 0);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm dark:border-white/10 dark:bg-[#0b0f0d]",
        className,
      )}
    >
      <div className="flex flex-col gap-3 border-b border-border/50 px-4 py-4 sm:flex-row sm:items-start sm:justify-between dark:border-white/10">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        {showPeriodSelector && onPeriodChange && periodDays ? (
          <div className="flex flex-wrap gap-1 rounded-lg border border-border/60 bg-muted/30 p-1 dark:border-white/10 dark:bg-white/5">
            {periodOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onPeriodChange(option.value)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  periodDays === option.value
                    ? "bg-background text-foreground shadow-sm dark:bg-white/10"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="px-2 pb-2 pt-4 sm:px-4">
        {loading ? (
          <Skeleton className="w-full rounded-lg" style={{ height }} />
        ) : isEmpty ? (
          <div
            className="flex items-center justify-center rounded-lg border border-dashed border-border/60 text-sm text-muted-foreground dark:border-white/10"
            style={{ height }}
          >
            {emptyMessage}
          </div>
        ) : (
          <ChartContainer
            config={{
              current: { label: currentLabel, color: CHART_CURRENT_SOLID },
              previous: { label: previousLabel, color: CHART_PREVIOUS_LINE },
              secondary: { label: secondaryLabel ?? "Secondary", color: "#94a3b8" },
            }}
            className="aspect-auto w-full [&_.recharts-dot]:opacity-100"
            style={{ height }}
          >
            <ComposedChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="1" x2="0" y2="0">
                  <stop offset="0%" stopColor={CHART_CURRENT_GRADIENT.start} />
                  <stop offset="100%" stopColor={CHART_CURRENT_GRADIENT.end} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke={CHART_GRID} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fill: CHART_AXIS, fontSize: 11 }}
                tickMargin={10}
                minTickGap={24}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fill: CHART_AXIS, fontSize: 11 }}
                width={36}
                allowDecimals={false}
              />
              <ChartTooltip
                cursor={{ fill: "rgba(16, 185, 129, 0.08)" }}
                content={
                  <TrendTooltip
                    currentLabel={currentLabel}
                    previousLabel={previousLabel}
                    secondaryLabel={secondaryLabel}
                    valueFormatter={valueFormatter}
                  />
                }
              />
              <Bar
                dataKey="current"
                name={currentLabel}
                fill={`url(#${gradientId})`}
                radius={[6, 6, 0, 0]}
                maxBarSize={42}
                animationDuration={800}
              />
              {hasPrevious ? (
                <Line
                  type="monotone"
                  dataKey="previous"
                  name={previousLabel}
                  stroke={CHART_PREVIOUS_LINE}
                  strokeWidth={2}
                  dot={{ r: 3, fill: CHART_PREVIOUS_LINE, strokeWidth: 0 }}
                  activeDot={{ r: 4, fill: CHART_PREVIOUS_LINE }}
                  animationDuration={900}
                />
              ) : null}
              {secondaryLabel ? (
                <Line
                  type="monotone"
                  dataKey="secondary"
                  name={secondaryLabel}
                  stroke="#64748b"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  dot={false}
                  animationDuration={900}
                />
              ) : null}
            </ComposedChart>
          </ChartContainer>
        )}
      </div>

      {!loading && !isEmpty ? (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-border/50 px-4 py-3 text-xs dark:border-white/10">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="h-2.5 w-2.5 rounded-sm bg-emerald-400" />
              {currentLabel}
            </span>
            {hasPrevious ? (
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span className="h-2.5 w-2.5 rounded-full border border-white/70 dark:border-white/80" />
                {previousLabel}
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
            <span>
              This period{" "}
              <strong className="text-foreground">{valueFormatter(totals.current)}</strong>
            </span>
            {hasPrevious ? (
              <span>
                Prev <strong className="text-foreground">{valueFormatter(totals.previous)}</strong>
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
