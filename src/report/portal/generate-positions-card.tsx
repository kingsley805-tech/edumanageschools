import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Trophy, CheckCircle2, AlertTriangle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import {
  checkClassPositionCoverage,
  type ClassScoringProgress,
  type PositionCoverageReport,
} from "@/report/lib/ranking";

type GeneratePositionsCardProps = {
  className?: string | null;
  classId?: string | null;
  termId?: string | null;
  progress?: ClassScoringProgress;
  progressPct: number;
  progressLoading?: boolean;
  isGenerating: boolean;
  onGenerate: () => void;
  compact?: boolean;
};

export function GeneratePositionsCard({
  className,
  classId,
  termId,
  progress,
  progressPct,
  progressLoading,
  isGenerating,
  onGenerate,
  compact,
}: GeneratePositionsCardProps) {
  const canRank = progress?.canRank ?? progress?.ready ?? false;
  const studentCount = progress?.studentCount ?? 0;

  const [checking, setChecking] = useState(false);
  const [report, setReport] = useState<PositionCoverageReport | null>(null);
  const [open, setOpen] = useState(false);

  const runCheck = async () => {
    if (!classId || !termId) {
      toast.error("Select a class and current term first.");
      return;
    }
    setChecking(true);
    try {
      const r = await checkClassPositionCoverage(classId, termId);
      setReport(r);
      setOpen(true);
      if (r.complete) {
        toast.success(
          `All ${r.studentCount} student${r.studentCount === 1 ? "" : "s"} have positions for every subject.`,
        );
      } else {
        const missing = r.missingSubjectPositions.length;
        toast.warning(
          `${missing} missing subject position${missing === 1 ? "" : "s"}` +
            (r.missingClassPosition.length
              ? `, ${r.missingClassPosition.length} missing class position${r.missingClassPosition.length === 1 ? "" : "s"}`
              : "") +
            ". Open details for the list.",
        );
      }
    } catch (e) {
      toast.error((e as Error).message || "Check failed.");
    } finally {
      setChecking(false);
    }
  };

  return (
    <Card>
      <CardHeader className={compact ? "pb-2" : "pb-3"}>
        <CardTitle className="flex items-center gap-2 text-base">
          {isGenerating ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <Trophy className="h-4 w-4 text-muted-foreground" />
          )}
          Student rankings{className ? ` — ${className}` : ""}
        </CardTitle>
        <CardDescription>
          Ranks every student in the class — with or without complete marks. Subject positions
          use entered scores only; class rank uses the sum of available subject totals. Ties share
          the same position (1st, 2nd, 2nd, 4th). Saved to results, report cards, PDF, and print.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {progressLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking marks…
          </div>
        ) : progress && progress.expected > 0 ? (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="text-muted-foreground">
                Marks: {progress.filled} / {progress.expected}
                {" · "}
                {progress.completedStudents ?? 0} / {studentCount} with all marks · all{" "}
                {studentCount} ranked
              </span>
              <span className="font-medium">{progressPct}%</span>
            </div>
            <Progress value={progressPct} className="h-2" />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Assign subjects to this class and enter marks before generating positions.
          </p>
        )}

        {progress && progress.expected > 0 && progress.filled < progress.expected && (
          <Alert>
            <AlertDescription>
              Some marks are still missing. You can generate positions now — every student in the
              class will receive a class rank; subject positions apply only where scores exist.
            </AlertDescription>
          </Alert>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            onClick={onGenerate}
            disabled={isGenerating || progressLoading || !canRank}
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating positions…
              </>
            ) : (
              "Generate Positions"
            )}
          </Button>
          <Button
            variant="outline"
            onClick={runCheck}
            disabled={checking || !classId || !termId}
          >
            {checking ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Checking…
              </>
            ) : (
              <>
                <ShieldCheck className="mr-2 h-4 w-4" />
                Check coverage
              </>
            )}
          </Button>
        </div>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {report?.complete ? (
                <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-muted-foreground" />
              )}
              Position coverage{className ? ` — ${className}` : ""}
            </DialogTitle>
            <DialogDescription>
              {report
                ? `${report.covered} / ${report.expected} subject positions filled across ${report.studentCount} student${report.studentCount === 1 ? "" : "s"} and ${report.subjectCount} subject${report.subjectCount === 1 ? "" : "s"}.`
                : ""}
            </DialogDescription>
          </DialogHeader>

          {report && (
            <ScrollArea className="max-h-[55vh] pr-3">
              {report.complete ? (
                <p className="text-sm text-muted-foreground">
                  Every student has a class position and a position for every subject. Nothing to fix.
                </p>
              ) : (
                <div className="space-y-4 text-sm">
                  {report.studentsWithoutReportCard.length > 0 && (
                    <section>
                      <h4 className="font-medium mb-1">
                        Students without a report card ({report.studentsWithoutReportCard.length})
                      </h4>
                      <ul className="list-disc pl-5 text-muted-foreground space-y-0.5">
                        {report.studentsWithoutReportCard.map((s) => (
                          <li key={s.studentId}>{s.studentName}</li>
                        ))}
                      </ul>
                    </section>
                  )}
                  {report.missingClassPosition.length > 0 && (
                    <section>
                      <h4 className="font-medium mb-1">
                        Missing class position ({report.missingClassPosition.length})
                      </h4>
                      <ul className="list-disc pl-5 text-muted-foreground space-y-0.5">
                        {report.missingClassPosition.map((s) => (
                          <li key={s.studentId}>{s.studentName}</li>
                        ))}
                      </ul>
                    </section>
                  )}
                  {report.missingSubjectPositions.length > 0 && (
                    <section>
                      <h4 className="font-medium mb-1">
                        Missing subject positions ({report.missingSubjectPositions.length})
                      </h4>
                      <ul className="list-disc pl-5 text-muted-foreground space-y-0.5">
                        {report.missingSubjectPositions.map((m, i) => (
                          <li key={`${m.studentId}-${m.subjectName}-${i}`}>
                            <span className="font-medium text-foreground">{m.studentName}</span>
                            {" — "}
                            {m.subjectName}
                          </li>
                        ))}
                      </ul>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Tip: enter the missing marks, then click <b>Generate Positions</b> to fill these in.
                      </p>
                    </section>
                  )}
                </div>
              )}
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
