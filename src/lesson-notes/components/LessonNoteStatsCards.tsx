import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Clock, CheckCircle2, XCircle, Pencil } from "lucide-react";

export function LessonNoteStatsCards({
  stats,
}: {
  stats: { total: number; draft: number; pending: number; approved: number; rejected: number };
}) {
  const items = [
    { label: "Total", value: stats.total, icon: FileText, color: "text-foreground" },
    { label: "Draft", value: stats.draft, icon: Pencil, color: "text-slate-600" },
    { label: "Pending", value: stats.pending, icon: Clock, color: "text-amber-700" },
    { label: "Approved", value: stats.approved, icon: CheckCircle2, color: "text-emerald-700" },
    { label: "Needs action", value: stats.rejected, icon: XCircle, color: "text-red-700" },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {items.map((item) => (
        <Card key={item.label}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{item.label}</CardTitle>
            <item.icon className={`h-4 w-4 ${item.color}`} />
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
