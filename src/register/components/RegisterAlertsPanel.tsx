import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, AlertTriangle, Info } from "lucide-react";
import type { RegisterAlert } from "@/register/lib/types";

export function RegisterAlertsPanel({ alerts }: { alerts: RegisterAlert[] }) {
  const icon = (severity: RegisterAlert["severity"]) => {
    if (severity === "error") return <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />;
    if (severity === "warning") return <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />;
    return <Info className="h-4 w-4 text-primary shrink-0" />;
  };

  return (
    <Card className="border-border/80">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Alerts & activity</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {alerts.map((a) => (
          <div key={a.id} className="flex gap-3 rounded-lg border border-border/60 bg-muted/20 p-3">
            {icon(a.severity)}
            <div>
              <p className="text-sm font-medium">{a.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{a.description}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
