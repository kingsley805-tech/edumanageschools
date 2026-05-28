import { cn } from "@/lib/utils";
import { type LucideIcon } from "lucide-react";

const accents: Record<string, string> = {
  emerald: "bg-emerald-500/15 text-emerald-700",
  sky: "bg-sky-500/15 text-sky-700",
  rose: "bg-rose-500/15 text-rose-600",
  slate: "bg-slate-400/15 text-slate-600",
};

interface Props {
  label: string;
  value: string;
  icon: LucideIcon;
  accent: keyof typeof accents;
}

export default function AdminUserCountCard({ label, value, icon: Icon, accent }: Props) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card px-4 py-3.5 shadow-sm shadow-black/[0.03]">
      <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", accents[accent])}>
        <Icon className="h-5 w-5" strokeWidth={2} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="text-lg font-bold tabular-nums text-card-foreground">{value}</p>
      </div>
    </div>
  );
}
