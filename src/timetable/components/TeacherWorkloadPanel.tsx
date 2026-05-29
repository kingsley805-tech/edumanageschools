import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { TeacherWorkload } from "@/timetable/lib/types";

const STATUS_CLASS: Record<TeacherWorkload["status"], string> = {
  low: "bg-info/20 text-info border-info/30",
  ok: "bg-success/15 text-success border-success/30",
  high: "bg-primary/15 text-primary border-primary/30",
  overload: "bg-destructive/15 text-destructive border-destructive/30",
};

export function TeacherWorkloadPanel({ workloads }: { workloads: TeacherWorkload[] }) {
  return (
    <Card className="border-border/80 bg-card h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Teacher Workload</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {workloads.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No teacher assignments yet.</p>
        ) : (
          workloads.slice(0, 8).map((w) => {
            const initials = w.teacherName
              .split(" ")
              .map((n) => n[0])
              .join("")
              .slice(0, 2)
              .toUpperCase();
            return (
              <div key={w.teacherId} className="flex items-center gap-3">
                <Avatar className="h-9 w-9 border border-border">
                  <AvatarFallback className="text-xs bg-muted">{initials}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium truncate">{w.teacherName}</p>
                    <Badge variant="outline" className={`text-[10px] capitalize ${STATUS_CLASS[w.status]}`}>
                      {w.status}
                    </Badge>
                  </div>
                  <Progress value={w.percent} className="h-1.5" />
                  <p className="text-[10px] text-muted-foreground">
                    {w.periodsPerWeek} periods/week · {w.percent}%
                  </p>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
