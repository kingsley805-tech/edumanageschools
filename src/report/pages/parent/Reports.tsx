import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/report/hooks/use-auth";
import { PageHeader } from "@/report/portal/page-header";
import { ShepherdReportCard } from "@/report/components/shepherd-report-card";
import { useGradingFormat } from "@/report/hooks/use-school-data";
import { fetchPublishedTermReport, fetchPublishedTermReports, rowToFormWithTermDates } from "@/report/lib/term-report";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ArrowLeft, AlertTriangle, AlertCircle, GraduationCap } from "lucide-react";
import { ReportMetaPanel } from "@/report/components/report-meta-panel";
import { ReportStatsStrip } from "@/report/components/report-stats-strip";
import { useReportSignatures } from "@/report/hooks/use-report-signatures";
import { Badge } from "@/components/ui/badge";
import { fetchAttendanceSummary } from "@/register/lib/attendance";

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

  const activeStudentId = useMemo(() => {
    if (!children?.length) return undefined;
    if (studentId && children.some((c) => c.id === studentId)) return studentId;
    return children[0]?.id;
  }, [children, studentId]);

  useEffect(() => {
    if (!children?.length || !studentId) return;
    if (!children.some((c) => c.id === studentId)) {
      setStudentId(children[0].id);
    }
  }, [children, studentId]);

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

  // Full (unfiltered, newest-first) list — used to find the term
  // immediately before the one currently on screen for the trend strip,
  // independent of whatever year filter is applied to the picker.
  const previousReport = useMemo(() => {
    if (!publishedList?.length || !report) return null;
    const idx = publishedList.findIndex((r) => r.id === report.id);
    return idx >= 0 ? publishedList[idx + 1] ?? null : null;
  }, [publishedList, report]);

  // Query academic recommendations for active child and term
  const { data: parentRecommendations } = useQuery({
    queryKey: ["parent-academic-recommendations", activeStudentId, report?.term_id],
    enabled: !!activeStudentId && !!report?.term_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("academic_recommendations")
        .select(`
          id,
          recommendation_type,
          suggestions,
          strengths,
          weaknesses,
          threshold_alert,
          created_at,
          teacher:teachers(
            profiles(
              full_name
            )
          )
        `)
        .eq("student_id", activeStudentId!)
        .eq("term_id", report!.term_id!);
      if (error) throw error;
      return data ?? [];
    }
  });

  // Term attendance from precomputed summaries
  const { data: attendanceSummary } = useQuery({
    queryKey: ["parent-student-attendance", activeStudentId, report?.term_id],
    enabled: !!activeStudentId && !!report?.term_id,
    queryFn: () => fetchAttendanceSummary(activeStudentId!, report!.term_id!),
  });

  const studentAttendanceRate = useMemo(() => {
    if (attendanceSummary && attendanceSummary.total_days > 0) {
      return Math.round(attendanceSummary.attendance_percentage);
    }
    return 100;
  }, [attendanceSummary]);

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
          <div className="space-y-6 max-w-[860px] mx-auto">
            {/* Warning Banners Section */}
            {(studentAttendanceRate < 80 || (report.total_score != null && report.total_score < 50) || parentRecommendations?.some(r => r.threshold_alert)) && (
              <div className="space-y-3 no-print">
                {studentAttendanceRate < 80 && (
                  <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3.5 rounded-xl flex items-start gap-3 shadow-sm">
                    <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-sm">Attendance Warning Flagged</p>
                      <p className="text-xs opacity-90">{form.studentName} has a term attendance rate of {studentAttendanceRate}%, which is below the minimum required 80% threshold.</p>
                    </div>
                  </div>
                )}
                {report.total_score != null && report.total_score < 50 && (
                  <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3.5 rounded-xl flex items-start gap-3 shadow-sm">
                    <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-sm">Performance Alert Flagged</p>
                      <p className="text-xs opacity-90">{form.studentName}'s term aggregate score is {report.total_score}%, indicating they are struggling academically this term.</p>
                    </div>
                  </div>
                )}
                {parentRecommendations?.some(r => r.threshold_alert) && (
                  <div className="bg-red-100 border border-red-300 text-red-900 px-4 py-3.5 rounded-xl flex items-start gap-3 shadow-sm">
                    <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5 animate-bounce" />
                    <div>
                      <p className="font-bold text-sm">Urgent Teacher Intervention Alert</p>
                      <p className="text-xs opacity-95">The class advisor has flagged one or more urgent academic recommendations. Please review the advisor recommendations below.</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            <ReportStatsStrip current={report} previous={previousReport} />

            {/* Official Report Card */}
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

            {/* Academic Recommendations Cards Section */}
            {parentRecommendations && parentRecommendations.length > 0 && (
              <Card className="no-print border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent shadow-md">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2 text-primary font-bold">
                    <GraduationCap className="h-5 w-5" />
                    Class Advisor Recommendations & Interventions
                  </CardTitle>
                  <CardDescription>
                    Tailored study plans and suggestions sent by the class teacher to help support your child's learning.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {parentRecommendations.map((rec) => {
                    const teacherName = (rec.teacher as any)?.profiles?.full_name || "Class Teacher";
                    return (
                      <div key={rec.id} className="p-4 rounded-xl border bg-background hover:shadow-md transition-all space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="px-2.5 py-0.5 font-semibold">
                              {rec.recommendation_type.replace("_", " ").toUpperCase()}
                            </Badge>
                            {rec.threshold_alert && (
                              <Badge variant="destructive" className="flex items-center gap-1 animate-pulse">
                                <AlertTriangle className="h-3 w-3" /> URGENT ALERT
                              </Badge>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            Sent by {teacherName} on {new Date(rec.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        
                        <div className="space-y-2 text-sm">
                          <div>
                            <span className="font-semibold block text-xs uppercase tracking-wider text-muted-foreground mb-1">Teacher Suggestions & study plans:</span>
                            <p className="text-foreground mt-1 whitespace-pre-line font-medium">{rec.suggestions}</p>
                          </div>
                          
                          {(rec.strengths || rec.weaknesses) && (
                            <div className="grid md:grid-cols-2 gap-4 pt-3 border-t text-xs">
                              {rec.strengths && (
                                <div>
                                  <span className="font-bold text-green-600 block mb-1">Key Strengths:</span>
                                  <p className="text-muted-foreground font-medium">{rec.strengths}</p>
                                </div>
                              )}
                              {rec.weaknesses && (
                                <div>
                                  <span className="font-bold text-red-600 block mb-1">Weaknesses / Areas of Improvement:</span>
                                  <p className="text-muted-foreground font-medium">{rec.weaknesses}</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}
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
