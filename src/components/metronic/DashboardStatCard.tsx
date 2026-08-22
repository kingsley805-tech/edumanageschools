import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export type DashboardStatTone = "amber" | "emerald" | "rose" | "primary" | "sky" | "violet" | "slate";

const TONE: Record<DashboardStatTone, { box: string; hover: string }> = {
  amber: {
    box: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    hover: "hover:border-amber-500/40",
  },
  emerald: {
    box: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    hover: "hover:border-emerald-500/40",
  },
  rose: {
    box: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    hover: "hover:border-rose-500/40",
  },
  primary: {
    box: "bg-primary/10 text-primary",
    hover: "hover:border-primary/40",
  },
  sky: {
    box: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
    hover: "hover:border-sky-500/40",
  },
  violet: {
    box: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    hover: "hover:border-violet-500/40",
  },
  slate: {
    box: "bg-slate-500/10 text-slate-600 dark:text-slate-300",
    hover: "hover:border-slate-500/40",
  },
};

type DashboardStatCardProps = {
  label: string;
  value: ReactNode;
  description?: ReactNode;
  icon: LucideIcon;
  tone?: DashboardStatTone;
  className?: string;
};

/**
 * Dashboard KPI card — same strip used on Admin Dashboard / report-cards.
 * Uses `channel-stats-bg` (bg-3.png) for the Metronic background image.
 */
export function DashboardStatCard({
  label,
  value,
  description,
  icon: Icon,
  tone = "primary",
  className,
}: DashboardStatCardProps) {
  const t = TONE[tone];
  return (
    <div
      className={cn(
        "kt-card channel-stats-bg flex flex-col justify-between rounded-xl border border-border/60 p-4 shadow-sm",
        "bg-card/80 dark:bg-card/60 dark:border-white/10",
        "transition-shadow hover:shadow-md",
        t.hover,
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <div className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", t.box)}>
          <Icon className="size-4" />
        </div>
      </div>
      <div className="mt-3">
        <div className="text-2xl font-bold tabular-nums text-foreground leading-none">{value}</div>
        {description != null && description !== "" ? (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
    </div>
  );
}

type DashboardStatGridProps = {
  children: ReactNode;
  className?: string;
};

export function DashboardStatGrid({ children, className }: DashboardStatGridProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4 lg:gap-7.5",
        className,
      )}
    >
      {children}
    </div>
  );
}

type DashboardChartCardProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
};

/** Chart / panel shell matching Admin & Teacher dashboard `kt-card` format. */
export function DashboardChartCard({
  title,
  description,
  action,
  children,
  className,
}: DashboardChartCardProps) {
  return (
    <div className={cn("kt-card", className)}>
      <div className="kt-card-header flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="kt-card-title">{title}</h3>
          {description ? (
            <p className="mt-0.5 text-xs text-secondary-foreground">{description}</p>
          ) : null}
        </div>
        {action}
      </div>
      <div className="kt-card-content p-5 lg:p-7.5">{children}</div>
    </div>
  );
}
