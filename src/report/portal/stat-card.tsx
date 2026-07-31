import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type TrendDirection = "up" | "down" | "neutral";

/**
 * Color-coded trend pill — mirrors the KpiCard/TrendPill pattern used on the
 * admin Reports & Analytics dashboard (src/pages/admin/Reports.tsx) so KPI
 * cards look and behave the same across the whole ERP, not just in Reports.
 * `invert` flips which direction counts as "good" (e.g. a rise in rejected
 * reports is bad, a rise in approved reports is good).
 */
export function TrendPill({
  direction,
  label,
  invert = false,
}: {
  direction: TrendDirection;
  label: string;
  invert?: boolean;
}) {
  const isFlat = direction === "neutral";
  const isUp = direction === "up";
  const good = isFlat ? null : invert ? !isUp : isUp;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-medium",
        isFlat
          ? "bg-muted text-muted-foreground"
          : good
            ? "bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]"
            : "bg-[hsl(var(--critical-bg))] text-[hsl(var(--critical))]",
      )}
    >
      {isFlat ? <Minus className="h-3 w-3" /> : isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {label}
    </span>
  );
}

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "text-muted-foreground",
  trend,
  trendDirection,
  invert,
  onClick,
  index = 0,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: string;
  /** Plain caption text shown under the value (legacy — still supported). */
  trend?: string;
  /** When set, renders a color-coded up/down/flat pill instead of plain text. */
  trendDirection?: TrendDirection;
  /** Flip which trend direction counts as "good" (e.g. rejections, failures). */
  invert?: boolean;
  onClick?: () => void;
  /** Stagger position for the entrance animation. */
  index?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.06 }}
    >
      <Card
        className={cn(
          "border-border transition-shadow hover:shadow-md",
          onClick && "cursor-pointer hover:-translate-y-0.5",
        )}
        onClick={onClick}
      >
        <CardContent className="flex items-center justify-between p-5">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className={cn("mt-1 truncate font-display text-3xl font-semibold tabular-nums", tone)}>{value}</p>
            {trendDirection && trend ? (
              <div className="mt-1.5">
                <TrendPill direction={trendDirection} label={trend} invert={invert} />
              </div>
            ) : trend ? (
              <p className="mt-1 text-xs text-muted-foreground">{trend}</p>
            ) : null}
          </div>
          <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10", tone)}>
            <Icon className="h-4.5 w-4.5" />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
