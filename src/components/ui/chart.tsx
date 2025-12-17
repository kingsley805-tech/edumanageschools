import * as React from "react";
import * as RechartsPrimitive from "recharts";
import { cn } from "@/lib/utils";

/* ----------------------------------
   THEMES & MARKET COLOR TOKENS
----------------------------------- */

const THEMES = {
  light: "",
  dark: ".dark",
} as const;

const MARKET_COLORS = {
  bull: {
    light: "#16a34a",
    dark: "#22c55e",
  },
  bear: {
    light: "#dc2626",
    dark: "#ef4444",
  },
  neutral: {
    light: "#64748b",
    dark: "#94a3b8",
  },
  volume: {
    light: "#0ea5e9",
    dark: "#38bdf8",
  },
};

/* ----------------------------------
   TYPES
----------------------------------- */

export type ChartConfig = {
  [k in string]: {
    label?: React.ReactNode;
    icon?: React.ComponentType;
  } & (
    | { color?: string; theme?: never }
    | { color?: never; theme: Record<keyof typeof THEMES, string> }
  );
};

type ChartContextProps = {
  config: ChartConfig;
};

const ChartContext = React.createContext<ChartContextProps | null>(null);

function useChart() {
  const context = React.useContext(ChartContext);
  if (!context) {
    throw new Error("useChart must be used within a <ChartContainer />");
  }
  return context;
}

/* ----------------------------------
   CHART CONTAINER
----------------------------------- */

const ChartContainer = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    config: ChartConfig;
    children: React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>["children"];
  }
>(({ id, className, children, config, ...props }, ref) => {
  const uniqueId = React.useId();
  const chartId = `chart-${id || uniqueId.replace(/:/g, "")}`;

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        ref={ref}
        data-chart={chartId}
        className={cn(
          "flex aspect-video justify-center text-[11px] font-medium",

          // axes
          "[&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground",
          "[&_.recharts-cartesian-axis-line]:stroke-border/30",
          "[&_.recharts-cartesian-axis-tick-line]:stroke-border/30",

          // grid
          "[&_.recharts-cartesian-grid_line]:stroke-border/20",
          "[&_.recharts-cartesian-grid_horizontal]:stroke-border/30",

          // lines & areas
          "[&_.recharts-line-curve]:stroke-[2px]",
          "[&_.recharts-area-area]:fill-opacity-20",

          // market-style crosshair
          "[&_.recharts-tooltip-cursor]:stroke-border",
          "[&_.recharts-tooltip-cursor]:stroke-dasharray-3_3",

          // remove dots
          "[&_.recharts-dot]:opacity-0",

          // surface cleanup
          "[&_.recharts-surface]:outline-none",

          className
        )}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        <RechartsPrimitive.ResponsiveContainer>
          {children}
        </RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
});
ChartContainer.displayName = "Chart";

/* ----------------------------------
   CHART STYLE (CSS VARIABLES)
----------------------------------- */

const ChartStyle = ({ id, config }: { id: string; config: ChartConfig }) => {
  const colorConfig = Object.entries(config).filter(
    ([_, c]) => c.color || c.theme
  );

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: Object.entries(THEMES)
          .map(
            ([theme, prefix]) => `
${prefix} [data-chart=${id}] {
  --chart-bull: ${MARKET_COLORS.bull[theme as "light" | "dark"]};
  --chart-bear: ${MARKET_COLORS.bear[theme as "light" | "dark"]};
  --chart-neutral: ${MARKET_COLORS.neutral[theme as "light" | "dark"]};
  --chart-volume: ${MARKET_COLORS.volume[theme as "light" | "dark"]};

${colorConfig
  .map(([key, item]) => {
    const color = item.theme?.[theme as keyof typeof item.theme] || item.color;
    return color ? `--color-${key}: ${color};` : "";
  })
  .join("\n")}
}
`
          )
          .join("\n"),
      }}
    />
  );
};

/* ----------------------------------
   TOOLTIP
----------------------------------- */

const ChartTooltip = (props: React.ComponentProps<typeof RechartsPrimitive.Tooltip>) => (
  <RechartsPrimitive.Tooltip
    cursor={{ strokeDasharray: "3 3" }}
    wrapperStyle={{ outline: "none" }}
    {...props}
  />
);

/* ----------------------------------
   TOOLTIP CONTENT
----------------------------------- */

const ChartTooltipContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> &
    React.ComponentProps<typeof RechartsPrimitive.Tooltip>
>(({ active, payload, className }, ref) => {
  if (!active || !payload?.length) return null;

  return (
    <div
      ref={ref}
      className={cn(
        "rounded-md border border-border/50 bg-background px-2 py-1.5 text-xs shadow-xl",
        className
      )}
    >
      {payload.map((item) => (
        <div
          key={item.dataKey}
          className="flex items-center justify-between gap-3"
        >
          <span className="text-muted-foreground">{item.name}</span>
          <span className="font-mono tabular-nums text-foreground">
            {Number(item.value).toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
});
ChartTooltipContent.displayName = "ChartTooltipContent";

/* ----------------------------------
   LEGEND
----------------------------------- */

const ChartLegend = RechartsPrimitive.Legend;

const ChartLegendContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> &
    Pick<RechartsPrimitive.LegendProps, "payload">
>(({ payload, className }, ref) => {
  if (!payload?.length) return null;

  return (
    <div
      ref={ref}
      className={cn("flex items-center justify-center gap-4 text-xs", className)}
    >
      {payload.map((item) => (
        <div key={item.value} className="flex items-center gap-1.5">
          <span
            className="h-2 w-2 rounded-sm"
            style={{ backgroundColor: item.color }}
          />
          <span className="text-muted-foreground">{item.value}</span>
        </div>
      ))}
    </div>
  );
});
ChartLegendContent.displayName = "ChartLegendContent";

/* ----------------------------------
   EXPORTS
----------------------------------- */

export {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  ChartStyle,
};
