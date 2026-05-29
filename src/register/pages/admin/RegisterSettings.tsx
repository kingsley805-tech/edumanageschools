// @ts-nocheck
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fetchAttendanceStatusTypes } from "@/register/lib/api";

export function RegisterSettings({ schoolId, embedded }: { schoolId: string; embedded?: boolean }) {
  const [statuses, setStatuses] = useState([]);

  useEffect(() => {
    void fetchAttendanceStatusTypes(schoolId).then(setStatuses);
  }, [schoolId]);

  return (
    <Card className={embedded ? "border-border/80" : ""}>
      <CardHeader>
        <CardTitle>Attendance status types</CardTitle>
        <CardDescription>Customize labels and colors for register marking (defaults shown).</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {statuses.map((s) => (
          <Badge
            key={s.id}
            variant="outline"
            style={{ borderColor: s.color, color: s.color, backgroundColor: `${s.color}15` }}
          >
            {s.label}
          </Badge>
        ))}
      </CardContent>
    </Card>
  );
}
