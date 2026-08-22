import { AlertCircle, AlertTriangle, Info } from "lucide-react";
import type { RegisterAlert } from "@/register/lib/types";
import { DashboardChartCard } from "@/components/metronic/DashboardStatCard";

export function RegisterAlertsPanel({ alerts }: { alerts: RegisterAlert[] }) {
  const icon = (severity: RegisterAlert["severity"]) => {
    if (severity === "error") return <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />;
    if (severity === "warning") return <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />;
    return <Info className="h-4 w-4 text-primary shrink-0" />;
  };

  return (
    <DashboardChartCard title="Alerts & activity">
      <div className="space-y-3">
        {alerts.length === 0 ? (
          <p className="text-sm text-secondary-foreground">No alerts right now.</p>
        ) : (
          alerts.map((a) => (
            <div key={a.id} className="flex gap-3 rounded-lg border border-border/60 bg-muted/20 p-3">
              {icon(a.severity)}
              <div>
                <p className="text-sm font-medium">{a.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{a.description}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </DashboardChartCard>
  );
}
