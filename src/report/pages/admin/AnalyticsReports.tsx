import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/report/hooks/use-auth";
import { useCurrentTerm } from "@/report/hooks/use-school-data";
import { PageHeader } from "@/report/portal/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { rankStudents, subjectStats, passFailRatio, type ResultRow } from "@/report/lib/analytics";
import { gradeColor } from "@/report/lib/grading";
import { formatRankLabel } from "@/report/lib/shepherd-grading";
import { Trophy, TrendingDown } from "lucide-react";
import { useClientPagination } from "@/report/hooks/use-client-pagination";
import { TablePagination } from "@/report/portal/table-pagination";

function AdminReports() {
  const { profile } = useAuth();
  const [searchParams] = useSearchParams();
  const teacherId = searchParams.get("teacherId") ?? undefined;
  const classId = searchParams.get("classId") ?? undefined;
  const { data: term } = useCurrentTerm();

  const { data: teacher } = useQuery({
    queryKey: ["teacher-profile", teacherId],
    enabled: !!teacherId,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("full_name").eq("id", teacherId!).single();
      return data;
    },
  });

  const { data: classInfo } = useQuery({
    queryKey: ["class-info", classId],
    enabled: !!classId,
    queryFn: async () => {
      const { data } = await supabase.from("classes").select("name").eq("id", classId!).single();
      return data;
    },
  });

  const { data: reportData } = useQuery({
    queryKey: ["admin-reports", profile?.school_id, teacherId, classId, term?.id],
    enabled: !!profile?.school_id,
    queryFn: async () => {
      let studentIds: string[] = [];
      if (classId) {
        const { data: sts } = await supabase.from("students").select("id, full_name").eq("class_id", classId);
        studentIds = sts?.map((s) => s.id) ?? [];
      } else if (teacherId) {
        const { data: cs } = await supabase.from("class_subjects").select("class_id").eq("teacher_id", teacherId);
        const classIds = [...new Set(cs?.map((c) => c.class_id) ?? [])];
        if (classIds.length) {
          const { data: sts } = await supabase.from("students").select("id, full_name").in("class_id", classIds);
          studentIds = sts?.map((s) => s.id) ?? [];
        }
      } else {
        const { data: sts } = await supabase.from("students").select("id, full_name").eq("school_id", profile!.school_id!);
        studentIds = sts?.map((s) => s.id) ?? [];
      }

      if (!studentIds.length) return { results: [], students: [], rankings: [], subjects: [], passFail: { pass: 0, fail: 0, passRate: 0 } };

      let q = supabase
        .from("results")
        .select("*, students(full_name), subjects(name)")
        .in("student_id", studentIds)
        .eq("submitted", true);
      if (term?.id) q = q.eq("term_id", term.id);
      if (teacherId) q = q.eq("teacher_id", teacherId);

      const { data: results } = await q;
      const mapped: ResultRow[] = (results ?? []).map((r) => ({
        student_id: r.student_id,
        student_name: (r.students as { full_name: string })?.full_name,
        subject_id: r.subject_id,
        subject_name: (r.subjects as { name: string })?.name,
        ca_score: Number(r.ca_score),
        exam_score: Number(r.exam_score),
        total: Number(r.total),
        grade: r.grade,
        position: r.position,
      }));

      const students = [...new Map(mapped.map((r) => [r.student_id, { id: r.student_id, name: r.student_name || "Student" }])).values()];
      const rankings = rankStudents(students, mapped);
      const subjects = subjectStats(mapped);
      const passFail = passFailRatio(mapped);

      return { results: results ?? [], mapped, rankings, subjects, passFail, students };
    },
  });

  const title = teacherId
    ? `Reports — ${teacher?.full_name ?? "Teacher"}`
    : classId
      ? `Class reports — ${classInfo?.name ?? "Class"}`
      : "School reports";

  const top = reportData?.rankings?.slice(0, 5) ?? [];
  const weak = [...(reportData?.rankings ?? [])].reverse().slice(0, 5);

  const filterKey = `${teacherId ?? ""}-${classId ?? ""}-${term?.id ?? ""}`;
  const subjectsPag = useClientPagination(reportData?.subjects ?? [], { resetKey: `${filterKey}-subjects` });
  const resultsPag = useClientPagination(reportData?.results ?? [], { resetKey: `${filterKey}-results` });

  return (
    <>
      <PageHeader title={title} description="Academic analytics, rankings, and submitted results." />
      <div className="space-y-6 p-6 md:p-8">
        <div className="grid gap-4 md:grid-cols-4">
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Class average</p><p className="font-display text-2xl font-semibold">{reportData?.subjects?.length ? Math.round(reportData.subjects.reduce((a, s) => a + s.average, 0) / reportData.subjects.length) : 0}%</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Pass rate</p><p className="font-display text-2xl font-semibold text-success">{reportData?.passFail?.passRate ?? 0}%</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Submitted</p><p className="font-display text-2xl font-semibold">{reportData?.results?.length ?? 0}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Students</p><p className="font-display text-2xl font-semibold">{reportData?.students?.length ?? 0}</p></CardContent></Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="font-display flex items-center gap-2 text-success"><Trophy className="h-5 w-5" /> Top performers</CardTitle></CardHeader>
            <CardContent>
              <ol className="space-y-2">
                {top.map((s, i) => (
                  <li key={s.id} className="flex justify-between text-sm">
                    <span>{i + 1}. {s.name}</span>
                    <Badge>{s.average}%</Badge>
                  </li>
                ))}
                {!top.length && <p className="text-sm text-muted-foreground">No data yet</p>}
              </ol>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="font-display flex items-center gap-2 text-warning"><TrendingDown className="h-5 w-5" /> Needs support</CardTitle></CardHeader>
            <CardContent>
              <ol className="space-y-2">
                {weak.map((s, i) => (
                  <li key={s.id} className="flex justify-between text-sm">
                    <span>{s.name}</span>
                    <Badge variant="secondary">{s.average}%</Badge>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle className="font-display">Subject statistics</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="table-scroll">
            <Table>
              <TableHeader>
                <TableRow><TableHead>Subject</TableHead><TableHead>Average</TableHead><TableHead>Pass rate</TableHead><TableHead>Entries</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {subjectsPag.slice.map((s) => (
                  <TableRow key={s.subject_id}>
                    <TableCell>{s.subject_name}</TableCell>
                    <TableCell>{s.average}%</TableCell>
                    <TableCell>{s.pass_rate}%</TableCell>
                    <TableCell>{s.count}</TableCell>
                  </TableRow>
                ))}
                {!subjectsPag.total && (
                  <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No subject data yet</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
            </div>
            <TablePagination
              page={subjectsPag.page}
              totalPages={subjectsPag.totalPages}
              total={subjectsPag.total}
              from={subjectsPag.from}
              to={subjectsPag.to}
              pageSize={subjectsPag.pageSize}
              pageSizes={subjectsPag.pageSizes}
              onPageChange={subjectsPag.setPage}
              onPageSizeChange={subjectsPag.setPageSize}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="font-display">All submitted results</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="table-scroll">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead><TableHead>Subject</TableHead><TableHead>CA</TableHead><TableHead>Exam</TableHead><TableHead>Total</TableHead><TableHead>Grade</TableHead><TableHead>Position</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resultsPag.slice.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{(r.students as { full_name: string })?.full_name}</TableCell>
                    <TableCell>{(r.subjects as { name: string })?.name}</TableCell>
                    <TableCell>{r.ca_score}</TableCell>
                    <TableCell>{r.exam_score}</TableCell>
                    <TableCell className="font-semibold">{r.total}</TableCell>
                    <TableCell className={gradeColor(r.grade ?? "")}>{r.grade}</TableCell>
                    <TableCell>{r.position != null ? formatRankLabel(r.position) : "—"}</TableCell>
                  </TableRow>
                ))}
                {!resultsPag.total && (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No submitted results</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
            </div>
            <TablePagination
              page={resultsPag.page}
              totalPages={resultsPag.totalPages}
              total={resultsPag.total}
              from={resultsPag.from}
              to={resultsPag.to}
              pageSize={resultsPag.pageSize}
              pageSizes={resultsPag.pageSizes}
              onPageChange={resultsPag.setPage}
              onPageSizeChange={resultsPag.setPageSize}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}

import { withReportLayout } from "@/report/withReportLayout";
export default withReportLayout("admin", AdminReports);
