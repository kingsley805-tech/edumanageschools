import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { RegisterCompletionItem } from "@/register/lib/types";
import { RegisterStatusBadge } from "@/register/components/RegisterStatusBadge";

export function RegisterCompletionGrid({
  title,
  subtitle,
  items,
}: {
  title: string;
  subtitle: string;
  items: RegisterCompletionItem[];
}) {
  const barColor = (status: RegisterCompletionItem["status"]) => {
    if (status === "approved") return "bg-emerald-500";
    if (status === "submitted") return "bg-amber-500";
    if (status === "rejected") return "bg-red-500";
    return "bg-muted-foreground/40";
  };

  return (
    <Card className="border-border/80">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{subtitle}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground col-span-full">No registers for this day yet.</p>
        ) : (
          items.map((item) => (
            <div key={item.registerId} className="space-y-2 rounded-lg border border-border/60 p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium line-clamp-2">{item.label}</p>
                <RegisterStatusBadge status={item.status} />
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div className={`h-full rounded-full transition-all ${barColor(item.status)}`} style={{ width: `${item.percent}%` }} />
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
