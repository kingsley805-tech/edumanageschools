import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GraduationCap, Users, Calendar, AlertTriangle, CheckCircle2 } from "lucide-react";

export function TimetableStatsCards({
  stats,
  conflictCount,
}: {
  stats: {
    totalClasses: number;
    totalTeachers: number;
    teachersAssigned: number;
    activeTimetables: number;
    drafts: number;
    published: number;
  };
  conflictCount: number;
}) {
  const items = [
    { label: "Total Classes", value: stats.totalClasses, sub: null, icon: GraduationCap, accent: "text-primary" },
    { label: "Teachers", value: stats.totalTeachers, sub: `${stats.teachersAssigned} assigned`, icon: Users, accent: "text-foreground" },
    { label: "Active Timetables", value: stats.activeTimetables, sub: `${stats.drafts} drafts`, icon: Calendar, accent: "text-primary" },
    { label: "Conflicts", value: conflictCount, sub: conflictCount ? "Needs review" : "All clear", icon: AlertTriangle, accent: conflictCount ? "text-warning" : "text-success" },
    { label: "Published", value: stats.published, sub: "Visible to all", icon: CheckCircle2, accent: "text-success" },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {items.map((item) => (
        <Card key={item.label} className="border-border/80 bg-card shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{item.label}</CardTitle>
            <item.icon className={`h-4 w-4 ${item.accent}`} />
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${item.accent}`}>{item.value}</p>
            {item.sub ? <p className="text-xs text-muted-foreground mt-1">{item.sub}</p> : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
