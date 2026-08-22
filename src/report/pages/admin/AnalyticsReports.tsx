// @ts-nocheck
import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/report/hooks/use-auth";
import { useCurrentTerm } from "@/report/hooks/use-school-data";
import { PageHeader } from "@/report/portal/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { rankStudents, subjectStats, passFailRatio, type ResultRow } from "@/report/lib/analytics";
import { gradeColor } from "@/report/lib/grading";
import { formatRankLabel } from "@/report/lib/shepherd-grading";
import { Trophy, TrendingDown, Percent, FileCheck2, Users, BarChart3 } from "lucide-react";
import {
  DashboardChartCard,
  DashboardStatCard,
  DashboardStatGrid,
} from "@/components/metronic/DashboardStatCard";
import { useClientPagination } from "@/report/hooks/use-client-pagination";
import { TablePagination } from "@/report/portal/table-pagination";

const tooltipStyle = {
  background: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  fontSize: 12,
};

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

  const classAverage = reportData?.subjects?.length
    ? Math.round(reportData.subjects.reduce((a, s) => a + s.average, 0) / reportData.subjects.length)
    : 0;
  const passRate = reportData?.passFail?.passRate ?? 0;
  const submittedCount = reportData?.results?.length ?? 0;
  const studentCount = reportData?.students?.length ?? 0;
  const termLabel = term?.name ? `Current term: ${term.name}` : "All submitted results";

  const passFailChart = useMemo(
    () => [
      { name: "Passed", value: reportData?.passFail?.pass ?? 0, color: "hsl(152, 60%, 42%)" },
      { name: "Failed", value: reportData?.passFail?.fail ?? 0, color: "hsl(0, 72%, 51%)" },
    ],
    [reportData?.passFail],
  );

  const subjectChart = useMemo(
    () =>
      (reportData?.subjects ?? [])
        .slice(0, 8)
        .map((s) => ({ name: s.subject_name?.slice(0, 12) || "Subject", average: s.average })),
    [reportData?.subjects],
  );

  return (
    <>
      <PageHeader title={title} description="Academic analytics, rankings, and submitted results." />
      <div className="space-y-5 p-6 md:p-8 lg:space-y-7.5">
        <DashboardStatGrid>
          <DashboardStatCard
            label="Class Average"
            value={`${classAverage}%`}
            description={termLabel}
            icon={BarChart3}
            tone="primary"
          />
          <DashboardStatCard
            label="Pass Rate"
            value={`${passRate}%`}
            description={`${reportData?.passFail?.pass ?? 0} passed · ${reportData?.passFail?.fail ?? 0} failed`}
            icon={Percent}
            tone="emerald"
          />
          <DashboardStatCard
            label="Submitted"
            value={submittedCount}
            description="Result entries submitted"
            icon={FileCheck2}
            tone="sky"
          />
          <DashboardStatCard
            label="Students"
            value={studentCount}
            description="With submitted results"
            icon={Users}
            tone="amber"
          />
        </DashboardStatGrid>

        <div className="grid gap-5 lg:grid-cols-2 lg:gap-7.5">
          <DashboardChartCard title="Pass / Fail" description="Submitted results outcome">
            {passFailChart.some((d) => d.value > 0) ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={passFailChart}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {passFailChart.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-14 text-center text-sm text-secondary-foreground">No data yet</p>
            )}
          </DashboardChartCard>

          <DashboardChartCard title="Subject averages" description="Top subjects by average score">
            {subjectChart.length ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={subjectChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" fontSize={11} stroke="hsl(var(--muted-foreground))" />
                  <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" domain={[0, 100]} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="average" name="Average %" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-14 text-center text-sm text-secondary-foreground">No subject data yet</p>
            )}
          </DashboardChartCard>
        </div>

        <div className="grid gap-5 lg:grid-cols-2 lg:gap-7.5">
          <DashboardChartCard
            title="Top performers"
            description="Highest averages in this filter"
            action={<Trophy className="size-4 text-emerald-600" />}
          >
            <ol className="space-y-2">
              {top.map((s, i) => (
                <li key={s.id} className="flex justify-between text-sm">
                  <span>
                    {i + 1}. {s.name}
                  </span>
                  <Badge>{s.average}%</Badge>
                </li>
              ))}
              {!top.length && <p className="text-sm text-secondary-foreground">No data yet</p>}
            </ol>
          </DashboardChartCard>
          <DashboardChartCard
            title="Needs support"
            description="Lowest averages in this filter"
            action={<TrendingDown className="size-4 text-amber-600" />}
          >
            <ol className="space-y-2">
              {weak.map((s) => (
                <li key={s.id} className="flex justify-between text-sm">
                  <span>{s.name}</span>
                  <Badge variant="secondary">{s.average}%</Badge>
                </li>
              ))}
              {!weak.length && <p className="text-sm text-secondary-foreground">No data yet</p>}
            </ol>
          </DashboardChartCard>
        </div>

        <div className="kt-card">
          <div className="kt-card-header">
            <h3 className="kt-card-title">Subject statistics</h3>
          </div>
          <div className="kt-card-content p-0">
            <div className="table-scroll">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subject</TableHead>
                    <TableHead>Average</TableHead>
                    <TableHead>Pass rate</TableHead>
                    <TableHead>Entries</TableHead>
                  </TableRow>
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
                    <TableRow>
                      <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                        No subject data yet
                      </TableCell>
                    </TableRow>
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
          </div>
        </div>

        <div className="kt-card">
          <div className="kt-card-header">
            <h3 className="kt-card-title">All submitted results</h3>
          </div>
          <div className="kt-card-content p-0">
            <div className="table-scroll">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>CA</TableHead>
                    <TableHead>Exam</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead>Position</TableHead>
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
                    <TableRow>
                      <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                        No submitted results
                      </TableCell>
                    </TableRow>
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
          </div>
        </div>
      </div>
    </>
  );
}

import { withReportLayout } from "@/report/withReportLayout";
export default withReportLayout("admin", AdminReports);
