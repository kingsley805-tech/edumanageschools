import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Eye, RefreshCw, TrendingDown, TrendingUp, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ChartCard } from "@/components/charts/ChartCard";
import { StatCounter } from "@/components/charts/StatCounter";
import { AnimatedBarChart } from "@/components/charts/AnimatedBarChart";
import { CHART_CURRENT_SOLID } from "@/components/charts/chartTheme";
import { useSchoolInfo } from "@/hooks/useSchoolInfo";
import { useModuleAccess } from "@/modules/lib/useModuleAccess";
import { ModuleAccessDenied } from "@/modules/lib/ModuleAccessDenied";
import { ExportMenu } from "@/modules/lib/ExportMenu";
import {
  computePerformanceStats,
  fetchPerformanceFilterOptions,
  fetchPerformanceRows,
} from "@/modules/performance/lib/api";
import type {
  PerformanceDashboardStats,
  PerformanceFilters,
  PerformanceRow,
} from "@/modules/performance/lib/types";
import { toast } from "sonner";

const EMPTY_STATS: PerformanceDashboardStats = {
  total_ranked: 0,
  avg_score: 0,
  top_avg: 0,
  low_count: 0,
  attendance_issues: 0,
};

export default function StudentPerformancePage() {
  const { currentSchool } = useSchoolInfo();
  const schoolId = currentSchool?.id ?? null;
  const access = useModuleAccess("student_performance");

  const [filters, setFilters] = useState<PerformanceFilters>({
    academicYear: "",
    termLabel: "",
    className: "",
    search: "",
  });
  const [options, setOptions] = useState<{ years: string[]; terms: string[]; classes: string[] }>({
    years: [],
    terms: [],
    classes: [],
  });
  const [rows, setRows] = useState<PerformanceRow[]>([]);
  const [loading, setLoading] = useState(false);

  const stats = useMemo(() => computePerformanceStats(rows), [rows]);

  const topStudents = useMemo(
    () => [...rows].sort((a, b) => b.total_score - a.total_score).slice(0, 20),
    [rows],
  );

  const lowStudents = useMemo(
    () =>
      [...rows]
        .filter(
          (r) =>
            r.total_score < 50 ||
            r.failed_subjects > 0 ||
            (r.attendance_rate != null && r.attendance_rate < 80),
        )
        .sort((a, b) => a.total_score - b.total_score)
        .slice(0, 50),
    [rows],
  );

  const chartData = useMemo(() => {
    const buckets = [
      { label: "90+", min: 90, max: 1000 },
      { label: "80-89", min: 80, max: 89.99 },
      { label: "70-79", min: 70, max: 79.99 },
      { label: "60-69", min: 60, max: 69.99 },
      { label: "50-59", min: 50, max: 59.99 },
      { label: "<50", min: 0, max: 49.99 },
    ];
    return buckets.map((b) => ({
      label: b.label,
      value: rows.filter((r) => r.total_score >= b.min && r.total_score <= b.max).length,
    }));
  }, [rows]);

  const load = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const [opts, data] = await Promise.all([
        fetchPerformanceFilterOptions(schoolId),
        fetchPerformanceRows(schoolId, filters),
      ]);
      setOptions(opts);
      setRows(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load performance data");
    } finally {
      setLoading(false);
    }
  }, [schoolId, filters]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!access.canView) return <ModuleAccessDenied label="Student Performance" />;

  const performanceHeaders = [
    "Rank context",
    "Student",
    "Admission",
    "Class",
    "Score",
    "Position",
    "Attendance %",
    "Failed subjects",
    "Awards",
    "Conduct",
    "Intervention",
  ];
  const toExportRows = (list: PerformanceRow[]) =>
    list.map((r, i) => [
      i + 1,
      r.student_name,
      r.admission_number,
      r.class_name,
      r.total_score,
      r.class_position,
      r.attendance_rate,
      r.failed_subjects,
      r.awards_count,
      r.conduct,
      interventionFor(r),
    ]);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2 text-primary">
            <TrendingUp className="h-5 w-5" />
            <span className="text-xs font-semibold uppercase tracking-wider">Students</span>
          </div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Performance dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Rankings, GPA/score trends, attendance issues, and intervention signals from report cards.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`mr-1.5 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-4">
          <Input
            placeholder="Search student…"
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
          />
          <Select
            value={filters.academicYear || "all"}
            onValueChange={(v) => setFilters((f) => ({ ...f, academicYear: v === "all" ? "" : v }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Academic year" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All years</SelectItem>
              {options.years.map((y) => (
                <SelectItem key={y} value={y}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filters.termLabel || "all"}
            onValueChange={(v) => setFilters((f) => ({ ...f, termLabel: v === "all" ? "" : v }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Term" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All terms</SelectItem>
              {options.terms.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filters.className || "all"}
            onValueChange={(v) => setFilters((f) => ({ ...f, className: v === "all" ? "" : v }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Class" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All classes</SelectItem>
              {options.classes.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi title="Students ranked" value={stats.total_ranked || EMPTY_STATS.total_ranked} icon={Users} />
        <Kpi title="Average score" value={stats.avg_score} icon={TrendingUp} />
        <Kpi title="Top 10 avg" value={stats.top_avg} icon={TrendingUp} />
        <Kpi title="At risk" value={stats.low_count} icon={TrendingDown} />
        <Kpi title="Attendance issues" value={stats.attendance_issues} icon={AlertTriangle} />
      </div>

      <ChartCard title="Score distribution" description="How students cluster by total score">
        <AnimatedBarChart
          data={chartData}
          categoryKey="label"
          series={[{ key: "value", label: "Students", color: CHART_CURRENT_SOLID }]}
          loading={loading}
          showLegend={false}
        />
      </ChartCard>

      <Tabs defaultValue="top">
        <TabsList>
          <TabsTrigger value="top">Top students</TabsTrigger>
          <TabsTrigger value="low">Lowest performing</TabsTrigger>
        </TabsList>

        <TabsContent value="top" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Top students</CardTitle>
                <CardDescription>Highest total scores for the selected period</CardDescription>
              </div>
              {access.canExport ? (
                <ExportMenu
                  filename="top-students"
                  title="Top Students"
                  headers={performanceHeaders}
                  rows={toExportRows(topStudents)}
                />
              ) : null}
            </CardHeader>
            <CardContent>
              <PerformanceTable rows={topStudents} showIntervention={false} empty="No report-card data yet." />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="low" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Lowest performing / at risk</CardTitle>
                <CardDescription>
                  Low scores, failed subjects, attendance under 80% — with intervention suggestions
                </CardDescription>
              </div>
              {access.canExport ? (
                <ExportMenu
                  filename="at-risk-students"
                  title="Lowest Performing / At Risk"
                  headers={performanceHeaders}
                  rows={toExportRows(lowStudents)}
                />
              ) : null}
            </CardHeader>
            <CardContent>
              <PerformanceTable rows={lowStudents} showIntervention empty="No at-risk students for this filter." />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function interventionFor(r: PerformanceRow): string {
  const tips: string[] = [];
  if (r.total_score < 50) tips.push("Academic tutoring");
  if (r.failed_subjects > 0) tips.push(`Remedial for ${r.failed_subjects} subject(s)`);
  if (r.attendance_rate != null && r.attendance_rate < 80) tips.push("Attendance counseling + parent notice");
  if ((r.conduct ?? "").toLowerCase().includes("poor")) tips.push("Behavior intervention");
  return tips.join("; ") || "Monitor progress";
}

function Kpi({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: number;
  icon: typeof Users;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{title}</p>
          <StatCounter value={value} className="text-xl font-bold tabular-nums" />
        </div>
      </CardContent>
    </Card>
  );
}

function PerformanceTable({
  rows,
  showIntervention,
  empty,
}: {
  rows: PerformanceRow[];
  showIntervention: boolean;
  empty: string;
}) {
  const [viewRow, setViewRow] = useState<PerformanceRow | null>(null);

  if (rows.length === 0) {
    return <div className="py-10 text-center text-sm text-muted-foreground">{empty}</div>;
  }
  return (
    <>
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>Student</TableHead>
              <TableHead>Class</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Position</TableHead>
              <TableHead>Attendance</TableHead>
              <TableHead>Failed</TableHead>
              <TableHead>Awards</TableHead>
              {showIntervention ? <TableHead>Intervention</TableHead> : null}
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={`${r.student_id}-${r.report_id}-${i}`}>
                <TableCell className="tabular-nums text-muted-foreground">{i + 1}</TableCell>
                <TableCell>
                  <div className="font-medium">{r.student_name}</div>
                  <div className="text-xs text-muted-foreground">{r.admission_number}</div>
                </TableCell>
                <TableCell>{r.class_name}</TableCell>
                <TableCell className="font-semibold tabular-nums">
                  {Number.isFinite(r.total_score) ? r.total_score : "—"}
                </TableCell>
                <TableCell>
                  {r.class_position != null && Number.isFinite(r.class_position)
                    ? r.class_position
                    : "—"}
                </TableCell>
                <TableCell>
                  {r.attendance_rate != null && Number.isFinite(r.attendance_rate) ? (
                    <Badge variant={r.attendance_rate < 80 ? "destructive" : "success"}>
                      {r.attendance_rate}%
                    </Badge>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell>
                  {r.failed_subjects > 0 ? (
                    <Badge variant="warning">{r.failed_subjects}</Badge>
                  ) : (
                    "0"
                  )}
                </TableCell>
                <TableCell>{Number.isFinite(r.awards_count) ? r.awards_count : 0}</TableCell>
                {showIntervention ? (
                  <TableCell className="max-w-[260px] text-xs text-muted-foreground">
                    {interventionFor(r)}
                  </TableCell>
                ) : null}
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => setViewRow(r)} title="View performance record">
                    <Eye className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!viewRow} onOpenChange={(v) => !v && setViewRow(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-2 pr-6">
              <span>{viewRow?.student_name}</span>
              {viewRow?.class_position ? (
                <Badge variant="outline">Position: {viewRow.class_position}</Badge>
              ) : null}
            </DialogTitle>
          </DialogHeader>
          {viewRow ? (
            <dl className="grid gap-2.5 text-sm sm:grid-cols-2 py-2">
              <div className="rounded-md border bg-muted/20 p-2">
                <dt className="text-xs text-muted-foreground">Admission #</dt>
                <dd className="font-medium mt-0.5">{viewRow.admission_number}</dd>
              </div>
              <div className="rounded-md border bg-muted/20 p-2">
                <dt className="text-xs text-muted-foreground">Class</dt>
                <dd className="font-medium mt-0.5">{viewRow.class_name}</dd>
              </div>
              <div className="rounded-md border bg-muted/20 p-2">
                <dt className="text-xs text-muted-foreground">Total / Avg Score</dt>
                <dd className="text-base font-bold text-primary mt-0.5">{viewRow.total_score}</dd>
              </div>
              <div className="rounded-md border bg-muted/20 p-2">
                <dt className="text-xs text-muted-foreground">Class Position</dt>
                <dd className="font-medium mt-0.5">{viewRow.class_position ?? "—"}</dd>
              </div>
              <div className="rounded-md border bg-muted/20 p-2">
                <dt className="text-xs text-muted-foreground">Attendance Rate</dt>
                <dd className="font-medium mt-0.5">{viewRow.attendance_rate != null ? `${viewRow.attendance_rate}%` : "—"}</dd>
              </div>
              <div className="rounded-md border bg-muted/20 p-2">
                <dt className="text-xs text-muted-foreground">Failed Subjects</dt>
                <dd className="font-medium mt-0.5">{viewRow.failed_subjects}</dd>
              </div>
              <div className="rounded-md border bg-muted/20 p-2">
                <dt className="text-xs text-muted-foreground">Awards Earned</dt>
                <dd className="font-medium mt-0.5">{viewRow.awards_count}</dd>
              </div>
              <div className="rounded-md border bg-muted/20 p-2">
                <dt className="text-xs text-muted-foreground">Intervention Note</dt>
                <dd className="text-xs mt-0.5">{interventionFor(viewRow)}</dd>
              </div>
            </dl>
          ) : null}
          <div className="flex justify-end pt-2 border-t">
            <Button type="button" variant="outline" onClick={() => setViewRow(null)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
