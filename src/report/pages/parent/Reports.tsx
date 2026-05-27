import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/report/hooks/use-auth";
import { PageHeader } from "@/report/portal/page-header";
import { ShepherdReportCard } from "@/report/components/shepherd-report-card";
import { useGradingFormat } from "@/report/hooks/use-school-data";
import { fetchPublishedTermReport, fetchPublishedTermReports, rowToFormWithTermDates } from "@/report/lib/term-report";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { ReportMetaPanel } from "@/report/components/report-meta-panel";
import { useMemo } from "react";
import { useReportSignatures } from "@/report/hooks/use-report-signatures";

function ParentReports() {
  const { user } = useAuth();
  const gradingFormat = useGradingFormat();
  const [searchParams] = useSearchParams();
  const search = {
    studentId: searchParams.get("studentId") ?? undefined,
    reportId: searchParams.get("reportId") ?? undefined,
    teacherId: searchParams.get("teacherId") ?? undefined,
    classId: searchParams.get("classId") ?? undefined,
    version: searchParams.get("version") ?? undefined,
    edit: searchParams.get("edit") ?? undefined,
  };
  const [studentId, setStudentId] = useState(search.studentId ?? "");
  const [reportId, setReportId] = useState(search.reportId ?? "");
  const [yearFilter, setYearFilter] = useState("all");

  useEffect(() => {
    if (search.studentId) setStudentId(search.studentId);
    if (search.reportId) setReportId(search.reportId);
  }, [search.studentId, search.reportId]);

  const { data: children } = useQuery({
    queryKey: ["parent-children", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("parent_students")
        .select("student_id, students(id, full_name)")
        .eq("parent_id", user!.id);
      return (data ?? []).map((l) => ({
        id: (l.students as { id: string; full_name: string }).id,
        name: (l.students as { full_name: string }).full_name,
      }));
    },
  });

  const activeStudentId = studentId || children?.[0]?.id;

  const { data: publishedList } = useQuery({
    queryKey: ["parent-published-reports", activeStudentId],
    enabled: !!activeStudentId,
    queryFn: () => fetchPublishedTermReports(activeStudentId!),
  });

  const reportsForPickerEarly = useMemo(() => {
    if (yearFilter === "all") return publishedList ?? [];
    return (publishedList ?? []).filter((r: { academic_year: string | null }) => r.academic_year === yearFilter);
  }, [publishedList, yearFilter]);

  const activeReportId =
    (reportId && reportsForPickerEarly.some((r: { id: string }) => r.id === reportId) ? reportId : null) ||
    reportsForPickerEarly[0]?.id;

  const { data: report, isLoading: reportLoading } = useQuery({
    queryKey: ["parent-published-report", activeStudentId, activeReportId],
    enabled: !!activeStudentId && !!activeReportId,
    queryFn: () => fetchPublishedTermReport(activeStudentId!, activeReportId),
  });

  const { data: form, isLoading: formLoading } = useQuery({
    queryKey: ["parent-report-form", report?.id, gradingFormat],
    enabled: !!report,
    queryFn: () => rowToFormWithTermDates(report!, gradingFormat),
  });

  const isLoading = reportLoading || formLoading;

  const { teacherSignatureUrl, headSignatureUrl } = useReportSignatures({
    schoolId: report?.school_id ?? "",
    teacherId: report?.teacher_id,
    enabled: !!report,
  });

  const { data: sentByProfile } = useQuery({
    queryKey: ["parent-report-sender", report?.sent_to_parents_by],
    enabled: !!report?.sent_to_parents_by,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", report!.sent_to_parents_by!)
        .single();
      return data;
    },
  });

  const years = useMemo(
    () => [...new Set((publishedList ?? []).map((r: { academic_year: string | null }) => r.academic_year).filter(Boolean))] as string[],
    [publishedList],
  );

  const reportsForPicker = reportsForPickerEarly;

  return (
    <>
      <PageHeader
        title="Report cards"
        description="Official term reports published by the school."
        actions={
          <div className="flex flex-wrap gap-2 no-print">
            <Button asChild variant="ghost" size="sm">
              <Link to="/parent"><ArrowLeft className="mr-1 h-4 w-4" /> Dashboard</Link>
            </Button>
            {children && children.length > 1 && (
              <Select
                value={activeStudentId}
                onValueChange={(v) => {
                  setStudentId(v);
                  setReportId("");
                }}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Child" />
                </SelectTrigger>
                <SelectContent>
                  {children.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {years.length > 1 && (
              <Select value={yearFilter} onValueChange={(v) => { setYearFilter(v); setReportId(""); }}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All years</SelectItem>
                  {years.map((y) => (
                    <SelectItem key={y} value={y}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {reportsForPicker.length > 1 && (
              <Select value={activeReportId} onValueChange={setReportId}>
                <SelectTrigger className="w-56">
                  <SelectValue placeholder="Term" />
                </SelectTrigger>
                <SelectContent>
                  {reportsForPicker.map((r: { id: string; term_label: string | null; academic_year: string | null }) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.term_label ?? "Term"} — {r.academic_year ?? ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        }
      />
      <div className="p-6 md:p-8">
        {isLoading ? (
          <Skeleton className="h-[800px] w-full max-w-[860px] mx-auto" />
        ) : form && report ? (
          <div className="space-y-4 max-w-[860px] mx-auto">
            <ReportMetaPanel
              report={report}
              sentBy={
                sentByProfile?.full_name
                  ? { name: sentByProfile.full_name }
                  : undefined
              }
            />
            <ShepherdReportCard
              data={form}
              academicYear={form.academicYear || report.academic_year || undefined}
              editable={false}
              showToolbar
              toolbarTitle={`${form.studentName} — ${form.term}`}
              status={report.status}
              schoolId={report.school_id}
              teacherSignatureUrl={teacherSignatureUrl}
              headSignatureUrl={headSignatureUrl}
            />
          </div>
        ) : (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              <p>No published report card yet for this child.</p>
              <p className="text-sm mt-2">
                Reports appear here after the class teacher saves and the school admin publishes them.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}

import { withReportLayout } from "@/report/withReportLayout";
export default withReportLayout("parent", ParentReports);
