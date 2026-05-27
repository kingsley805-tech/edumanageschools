import { Link, useSearchParams } from "react-router-dom";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/report/portal/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ShepherdReportCard } from "@/report/components/shepherd-report-card";
import { ReportVersionTimeline, VersionCompareSummary } from "@/report/components/report-version-history";
import { fetchTermReportById, fetchReportVersions } from "@/report/lib/term-report";
import { statusBadgeVariant, statusLabel } from "@/report/lib/report-card-status";
import { ArrowLeft, History } from "lucide-react";

function AdminReportVersions() {
  const [searchParams] = useSearchParams();
  const id = searchParams.get("id") ?? "";
  const versionParam = searchParams.get("version");
  const [selectedVersion, setSelectedVersion] = useState<number | null>(
    versionParam ? Number(versionParam) : null,
  );

  const { data: report, isLoading: reportLoading } = useQuery({
    queryKey: ["term-report", id],
    enabled: !!id,
    queryFn: () => fetchTermReportById(id),
  });

  const { data: versions, isLoading: versionsLoading } = useQuery({
    queryKey: ["report-versions", id],
    enabled: !!id,
    queryFn: () => fetchReportVersions(id),
  });

  const activeVersion = useMemo(() => {
    if (!versions?.length) return null;
    if (selectedVersion != null) {
      return versions.find((v) => v.version === selectedVersion) ?? versions[0];
    }
    return versions[0];
  }, [versions, selectedVersion]);

  const currentVersionRow = versions?.find((v) => v.version === report?.version);
  const showCompare =
    activeVersion &&
    currentVersionRow &&
    activeVersion.version !== currentVersionRow.version;

  if (reportLoading || versionsLoading) {
    return <p className="p-8">Loading version history…</p>;
  }

  if (!report) {
    return <p className="p-8">Report not found.</p>;
  }

  return (
    <>
      <PageHeader
        title="Version history"
        description={`${report.student_name} · ${report.class_name} · ${report.term_label}`}
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to={`/admin/report-cards/view?id=${encodeURIComponent(id)}`}>
                <ArrowLeft className="mr-1 h-4 w-4" />
                Back to review
              </Link>
            </Button>
          </div>
        }
      />

      <div className="p-6 md:p-8">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Badge variant={statusBadgeVariant(report.status)}>{statusLabel(report.status)}</Badge>
          <span className="text-sm text-muted-foreground">
            Current version: v{report.version ?? 1}
          </span>
          <span className="text-sm text-muted-foreground">
            · {versions?.length ?? 0} snapshot{(versions?.length ?? 0) === 1 ? "" : "s"}
          </span>
        </div>

        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <Card className="no-print overflow-hidden">
            <CardContent className="p-0">
              <div className="border-b px-4 py-3 flex items-center gap-2 font-medium text-sm">
                <History className="h-4 w-4" />
                Timeline
              </div>
              <ReportVersionTimeline
                reportId={id}
                currentVersion={report.version ?? undefined}
                selectedVersion={activeVersion?.version ?? null}
                onSelectVersion={setSelectedVersion}
              />
            </CardContent>
          </Card>

          <div className="space-y-4 min-w-0">
            {showCompare && activeVersion && currentVersionRow && (
              <VersionCompareSummary current={currentVersionRow} selected={activeVersion} />
            )}

            {activeVersion ? (
              <div>
                <p className="no-print mb-3 text-sm text-muted-foreground">
                  Previewing snapshot <strong>v{activeVersion.version}</strong>
                  {activeVersion.change_note ? ` — ${activeVersion.change_note}` : ""}
                </p>
                <ShepherdReportCard
                  data={activeVersion.form_snapshot}
                  academicYear={activeVersion.form_snapshot.academicYear}
                  editable={false}
                  status={activeVersion.status}
                  showToolbar
                  toolbarTitle={`${report.student_name} — v${activeVersion.version}`}
                  schoolId={report.school_id}
                />
              </div>
            ) : (
              <Card>
                <CardContent className="py-16 text-center text-muted-foreground">
                  Select a version from the timeline to preview.
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

import { withReportLayout } from "@/report/withReportLayout";
export default withReportLayout("admin", AdminReportVersions);
