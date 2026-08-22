import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type Props = {
  icon?: ReactNode;
  keenIcon?: string;
  badge?: ReactNode;
  value: ReactNode;
  label: string;
  description?: string;
  className?: string;
};

/** Dashboard-style Metronic KPI / metric card with channel-stats background. */
export function MetronicStatCard({
  icon,
  keenIcon,
  badge,
  value,
  label,
  description,
  className,
}: Props) {
  return (
    <div
      className={cn(
        "kt-card channel-stats-bg p-5 flex flex-col justify-between",
        "shadow-sm hover:shadow-md transition-shadow",
        "border border-border/60 dark:border-white/10",
        "bg-card/80 dark:bg-card/60",
        className,
      )}
    >
      <div className="flex items-center justify-between mb-4">
        <span className="text-foreground">
          {icon ??
            (keenIcon ? <i className={cn("ki-filled text-xl", keenIcon)} /> : null)}
        </span>
        {badge != null ? (
          typeof badge === "string" || typeof badge === "number" ? (
            <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/30">
              {badge}
            </span>
          ) : (
            badge
          )
        ) : null}
      </div>
      <div>
        <div className="text-[1.375rem] font-medium tracking-tight text-foreground leading-none">
          {value}
        </div>
        <div className="text-sm font-semibold text-foreground mt-1.5">{label}</div>
        {description ? (
          <div className="text-xs text-muted-foreground mt-0.5">{description}</div>
        ) : null}
      </div>
    </div>
  );
}
