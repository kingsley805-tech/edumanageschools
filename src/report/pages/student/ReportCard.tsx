import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/report/hooks/use-auth";
import { PageHeader } from "@/report/portal/page-header";
import { ShepherdReportCard } from "@/report/components/shepherd-report-card";
import { ReportStatsStrip } from "@/report/components/report-stats-strip";
import { useGradingFormat } from "@/report/hooks/use-school-data";
import { fetchPublishedTermReport, fetchPublishedTermReports, rowToFormWithTermDates } from "@/report/lib/term-report";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMemo, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { useReportSignatures } from "@/report/hooks/use-report-signatures";

function StudentReportCard() {
  const { user } = useAuth();
  const gradingFormat = useGradingFormat();
  const [reportId, setReportId] = useState("");

  const { data: student } = useQuery({
    queryKey: ["my-student", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      let { data } = await supabase.from("students").select("id").eq("profile_id", user!.id).maybeSingle();
      if (!data) {
        ({ data } = await supabase.from("students").select("id").eq("user_id", user!.id).maybeSingle());
      }
      return data;
    },
  });

  const { data: publishedList } = useQuery({
    queryKey: ["published-term-reports", student?.id],
    enabled: !!student?.id,
    queryFn: () => fetchPublishedTermReports(student!.id),
  });

  const activeReportId = reportId || publishedList?.[0]?.id;

  const { data: report, isLoading: reportLoading } = useQuery({
    queryKey: ["published-term-report", student?.id, activeReportId],
    enabled: !!student?.id && !!activeReportId,
    queryFn: () => fetchPublishedTermReport(student!.id, activeReportId),
  });

  const { data: form, isLoading: formLoading } = useQuery({
    queryKey: ["student-report-form", report?.id, gradingFormat],
    enabled: !!report,
    queryFn: () => rowToFormWithTermDates(report!, gradingFormat),
  });

  const isLoading = reportLoading || formLoading;

  // Newest-first published list — used to find the term immediately before
  // the one on screen for the KPI trend strip.
  const previousReport = useMemo(() => {
    if (!publishedList?.length || !report) return null;
    const idx = publishedList.findIndex((r) => r.id === report.id);
    return idx >= 0 ? publishedList[idx + 1] ?? null : null;
  }, [publishedList, report]);

  const { teacherSignatureUrl, headSignatureUrl } = useReportSignatures({
    schoolId: report?.school_id ?? "",
    teacherId: report?.teacher_id,
    enabled: !!report,
  });

  return (
    <>
      <PageHeader
        title="Report card"
        description="Official term report published by your school."
        actions={
          publishedList && publishedList.length > 1 ? (
            <Select value={activeReportId} onValueChange={setReportId}>
              <SelectTrigger className="w-56 no-print">
                <SelectValue placeholder="Select term" />
              </SelectTrigger>
              <SelectContent>
                {publishedList.map((r: { id: string; term_label: string | null; academic_year: string | null }) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.term_label ?? "Term"} — {r.academic_year ?? ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null
        }
      />
      <div className="p-6 md:p-8">
        {isLoading ? (
          <Skeleton className="h-[800px] w-full max-w-[860px] mx-auto" />
        ) : form ? (
          <div className="mx-auto max-w-[860px] space-y-6">
            {report && <ReportStatsStrip current={report} previous={previousReport} />}
            <ShepherdReportCard
              data={form}
              academicYear={form.academicYear}
              editable={false}
              showToolbar
              toolbarTitle={`${form.studentName} — ${form.term}`}
              schoolId={report?.school_id}
              teacherSignatureUrl={teacherSignatureUrl}
              headSignatureUrl={headSignatureUrl}
            />
          </div>
        ) : (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              <p>Your report card will appear here after your teacher saves it and the school publishes it.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}

import { withReportLayout } from "@/report/withReportLayout";
export default withReportLayout("student", StudentReportCard);
