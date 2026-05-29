import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import type { TimetableConflict } from "@/timetable/lib/types";

export function ConflictAlertsPanel({
  conflicts,
  onFix,
}: {
  conflicts: TimetableConflict[];
  onFix?: (conflict: TimetableConflict) => void;
}) {
  return (
    <Card className="border-border/80 bg-card h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-warning" />
          Conflict Alerts
          {conflicts.length > 0 ? (
            <span className="text-xs font-normal text-muted-foreground">({conflicts.length} issues)</span>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {conflicts.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No scheduling conflicts detected.</p>
        ) : (
          conflicts.slice(0, 6).map((c) => (
            <div key={c.id} className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-2">
              <p className="text-sm font-semibold text-destructive">{c.title}</p>
              <p className="text-xs text-muted-foreground">{c.description}</p>
              {onFix ? (
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onFix(c)}>
                  {c.type === "teacher_overlap" ? "Fix conflict" : "Review"}
                </Button>
              ) : null}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
