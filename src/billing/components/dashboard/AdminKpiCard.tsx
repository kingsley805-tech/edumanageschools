import { cn } from "@/lib/utils";
import { type LucideIcon } from "lucide-react";

type Tone = "success" | "warning" | "danger" | "neutral";

const toneBar: Record<Tone, string> = {
  success: "bg-[hsl(152,60%,38%)]",
  warning: "bg-[hsl(38,92%,50%)]",
  danger: "bg-[hsl(0,72%,51%)]",
  neutral: "bg-[hsl(160,84%,18%)]",
};

const toneIcon: Record<Tone, string> = {
  success: "bg-emerald-500/15 text-emerald-700",
  warning: "bg-amber-500/15 text-amber-700",
  danger: "bg-red-500/15 text-red-600",
  neutral: "bg-primary/10 text-primary",
};

interface AdminKpiCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  progressPercent: number;
  tone: Tone;
  footer?: string;
}

export default function AdminKpiCard({ title, value, icon: Icon, progressPercent, tone, footer }: AdminKpiCardProps) {
  const pct = Math.min(100, Math.max(0, progressPercent));
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm shadow-black/[0.03]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", toneIcon[tone])}>
          <Icon className="h-5 w-5" strokeWidth={2} />
        </div>
      </div>
      <p className="mt-3 text-2xl font-bold tracking-tight text-card-foreground">{value}</p>
      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full transition-all duration-500", toneBar[tone])} style={{ width: `${pct}%` }} />
      </div>
      {footer ? <p className="mt-3 text-xs font-medium text-muted-foreground">{footer}</p> : null}
    </div>
  );
}
