import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { fetchReportVersions, type ReportVersionRow } from "@/report/lib/term-report";
import { statusBadgeVariant, statusLabel } from "@/report/lib/report-card-status";
import { totalFromSubjects } from "@/report/lib/shepherd-grading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Clock, GitCompare, User } from "lucide-react";

type Props = {
  reportId: string;
  currentVersion?: number;
  selectedVersion: number | null;
  onSelectVersion: (version: number) => void;
  compact?: boolean;
};

export function ReportVersionTimeline({
  reportId,
  currentVersion,
  selectedVersion,
  onSelectVersion,
  compact = false,
}: Props) {
  const { data: versions, isLoading } = useQuery({
    queryKey: ["report-versions", reportId],
    enabled: !!reportId,
    queryFn: () => fetchReportVersions(reportId),
  });

  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
      </div>
    );
  }

  if (!versions?.length) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        <GitCompare className="mx-auto mb-2 h-8 w-8 opacity-40" />
        <p>No version history yet.</p>
        <p className="mt-1 text-xs">Snapshots are saved when status changes or on manual save.</p>
      </div>
    );
  }

  return (
    <ScrollArea className={compact ? "h-[420px]" : "h-[calc(100vh-12rem)]"}>
      <div className="space-y-2 p-3">
        {versions.map((v, idx) => {
          const prev = versions[idx + 1];
          const total = totalFromSubjects(v.form_snapshot.subjects);
          const prevTotal = prev ? totalFromSubjects(prev.form_snapshot.subjects) : null;
          const delta = prevTotal != null ? total - prevTotal : null;
          const isCurrent = v.version === currentVersion;
          const selected = selectedVersion === v.version;

          return (
            <button
              key={v.id}
              type="button"
              onClick={() => onSelectVersion(v.version)}
              className={cn(
                "w-full rounded-lg border p-3 text-left transition-colors",
                selected ? "border-foreground bg-muted/50" : "border-border hover:bg-accent",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-display font-semibold">v{v.version}</span>
                <div className="flex items-center gap-1">
                  {isCurrent && <Badge variant="outline" className="text-xs">Current</Badge>}
                  <Badge variant={statusBadgeVariant(v.status)} className="text-xs">
                    {statusLabel(v.status)}
                  </Badge>
                </div>
              </div>
              <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {format(new Date(v.created_at), "PPp")}
              </p>
              {v.changer_name && (
                <p className="mt-0.5 text-xs text-muted-foreground flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {v.changer_name}
                </p>
              )}
              {v.change_note && (
                <p className="mt-1 text-xs italic text-muted-foreground line-clamp-2">{v.change_note}</p>
              )}
              <div className="mt-2 flex items-baseline gap-2 text-sm">
                <span className="font-medium">Total: {total.toFixed(1)}</span>
                {delta != null && delta !== 0 && (
                  <span className={delta > 0 ? "text-foreground" : "text-muted-foreground"}>
                    {delta > 0 ? "+" : ""}{delta.toFixed(1)}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </ScrollArea>
  );
}

export function VersionCompareSummary({ current, selected }: { current: ReportVersionRow; selected: ReportVersionRow }) {
  const curTotal = totalFromSubjects(current.form_snapshot.subjects);
  const selTotal = totalFromSubjects(selected.form_snapshot.subjects);

  return (
    <Card className="no-print border-dashed">
      <CardHeader className="py-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <GitCompare className="h-4 w-4" />
          Comparing v{selected.version} → v{current.version}
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-3 pt-0 text-sm text-muted-foreground">
        <p>Total score: {selTotal.toFixed(1)} → {curTotal.toFixed(1)} ({curTotal - selTotal >= 0 ? "+" : ""}{(curTotal - selTotal).toFixed(1)})</p>
      </CardContent>
    </Card>
  );
}
