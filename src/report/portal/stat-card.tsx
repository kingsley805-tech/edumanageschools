import { Card, CardContent } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "text-muted-foreground",
  trend,
  onClick,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: string;
  trend?: string;
  onClick?: () => void;
}) {
  return (
    <Card
      className={cn(
        "border-border bg-white shadow-sm transition hover:shadow-md",
        onClick && "cursor-pointer hover:-translate-y-0.5",
      )}
      onClick={onClick}
    >
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className={cn("mt-1 font-display text-3xl font-semibold animate-in fade-in", tone)}>{value}</p>
          {trend && <p className="mt-1 text-xs text-muted-foreground">{trend}</p>}
        </div>
        <Icon className={cn("h-8 w-8 opacity-80", tone)} />
      </CardContent>
    </Card>
  );
}
