import { Link } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/report/hooks/use-auth";
import { useSchool, useCurrentTerm } from "@/report/hooks/use-school-data";
import { PageHeader } from "@/report/portal/page-header";
import { ActiveTermBanner } from "@/report/portal/active-term-banner";
import { ChartCard } from "@/report/portal/chart-card";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { StatCard } from "@/report/portal/stat-card";
import { trendFor, sortTermsChronologically } from "@/report/lib/trend";
import { isPendingAdminAction, statusBadgeVariant, statusLabel } from "@/report/lib/report-card-status";
import { totalFromSubjects, fmtScore, formatRankLabel, type SubjectRow } from "@/report/lib/shepherd-grading";
import {
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  Archive,
  Send,
  Loader2,
  Download,
  Printer,
  FilterX,
} from "lucide-react";
import { useClientPagination } from "@/report/hooks/use-client-pagination";
import { TablePagination } from "@/report/portal/table-pagination";
import { fetchSchoolTerms, formatTermLabel } from "@/report/lib/terms";
import { deliverClassReportsToParents } from "@/report/lib/report-delivery";
import { TERM_REPORT_ADMIN_LIST_SELECT } from "@/report/lib/term-report";
import { toast } from "sonner";
import { exportGenericTableToExcel, exportGenericTableToPDF } from "@/lib/exportUtils";
import { exportTable } from "@/modules/lib/exportTable";
import { getDesktopAPI, isElectronDesktop, unwrapIpc } from "@/desktop/electronBridge";
const STATUS_CHART_COLORS: Record<string, string> = {
  "Pending Review": "hsl(var(--warning))",
  Reviewed: "hsl(var(--primary))",
  Approved: "hsl(var(--success))",
  Published: "hsl(var(--success))",
  Rejected: "hsl(var(--critical))",
};

function AdminReportReview() {
  const { profile, user } = useAuth();
  const schoolId = profile?.school_id ?? "";
  const { data: currentTerm } = useCurrentTerm();
  const { data: school } = useSchool(schoolId);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [teacherFilter, setTeacherFilter] = useState("all");
  const [classFilter, setClassFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [termFilter, setTermFilter] = useState("all");
  const [bulkClassId, setBulkClassId] = useState("");
  const [bulkTermId, setBulkTermId] = useState("");
  const [exporting, setExporting] = useState<"pdf" | "excel" | "word" | "csv" | "print" | null>(null);

  const { data: terms } = useQuery({
    queryKey: ["school-terms", schoolId],
    enabled: !!schoolId,
    queryFn: () => fetchSchoolTerms(schoolId),
  });

  const { data: classRows } = useQuery({
    queryKey: ["admin-classes-bulk", schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes")
        .select("id, name")
        .eq("school_id", schoolId)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: reports, refetch } = useQuery({
    queryKey: ["admin-term-reports", profile?.school_id],
    enabled: !!profile?.school_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("term_report_cards")
        .select(`${TERM_REPORT_ADMIN_LIST_SELECT}, students(admission_number)`)
        .eq("school_id", profile!.school_id!)
        .neq("status", "draft")
        .order("academic_year", { ascending: false })
        .order("term_label", { ascending: false })
        .order("updated_at", { ascending: false });
      if (error) throw error;
      const rows = data ?? [];
      const teacherIds = [...new Set(rows.map((r) => r.teacher_id).filter(Boolean) as string[])];
      const nameMap = new Map<string, string>();
      if (teacherIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", teacherIds);
        for (const p of profs ?? []) nameMap.set(p.id, p.full_name);
      }
      return rows.map((r) => {
        const subs = (Array.isArray(r.subjects) ? r.subjects : []) as unknown as SubjectRow[];
        const computed = totalFromSubjects(subs);
        return {
          ...r,
          admission_number:
            (r.students as { admission_number: string | null } | null)?.admission_number ?? null,
          teacher_name: r.teacher_id ? nameMap.get(r.teacher_id) ?? null : null,
          displayTotal: computed > 0 ? computed : (r.total_score ?? 0),
        };
      });
    },
  });

  const bulkSend = useMutation({
    mutationFn: async () => {
      if (!bulkClassId) throw new Error("Select a class");
      return deliverClassReportsToParents({
        schoolId,
        classId: bulkClassId,
        termId: bulkTermId || currentTerm?.id || null,
        senderId: user!.id,
        senderRole: "admin",
      });
    },
    onSuccess: (r) => {
      toast.success(`Sent ${r.sent} report${r.sent === 1 ? "" : "s"} to parents (${r.skipped} skipped).`);
      refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const teachers = useMemo(() => {
    const set = new Map<string, string>();
    for (const r of reports ?? []) {
      if (r.teacher_id && r.teacher_name) set.set(r.teacher_id, r.teacher_name);
    }
    return [...set.entries()];
  }, [reports]);

  const classes = useMemo(() => {
    const set = new Set<string>();
    for (const r of reports ?? []) if (r.class_name) set.add(r.class_name);
    return [...set].sort();
  }, [reports]);

  const years = useMemo(() => {
    const set = new Set<string>();
    for (const r of reports ?? []) if (r.academic_year) set.add(r.academic_year);
    return [...set].sort().reverse();
  }, [reports]);

  const filtered = useMemo(
    () =>
      (reports ?? []).filter((r) => {
        const q = search.toLowerCase();
        const matchSearch =
          !q ||
          r.student_name.toLowerCase().includes(q) ||
          (r.class_name ?? "").toLowerCase().includes(q) ||
          (r.admission_number ?? "").toLowerCase().includes(q) ||
          (r.term_label ?? "").toLowerCase().includes(q);
        const matchStatus = statusFilter === "all" || r.status === statusFilter;
        const matchTeacher = teacherFilter === "all" || r.teacher_id === teacherFilter;
        const matchClass = classFilter === "all" || r.class_name === classFilter;
        const matchYear = yearFilter === "all" || r.academic_year === yearFilter;
        const matchTerm =
          termFilter === "all" || r.term_id === termFilter || r.term_label === termFilter;
        return matchSearch && matchStatus && matchTeacher && matchClass && matchYear && matchTerm;
      }),
    [reports, search, statusFilter, teacherFilter, classFilter, yearFilter, termFilter],
  );

  const activeFilterCount = [
    search.trim() ? 1 : 0,
    statusFilter !== "all",
    teacherFilter !== "all",
    classFilter !== "all",
    yearFilter !== "all",
    termFilter !== "all",
  ].filter(Boolean).length;

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setTeacherFilter("all");
    setClassFilter("all");
    setYearFilter("all");
    setTermFilter("all");
  };

  const pag = useClientPagination(filtered ?? [], {
    resetKey: `${search}-${statusFilter}-${teacherFilter}-${classFilter}-${yearFilter}-${termFilter}`,
  });

  const pending = reports?.filter((r) => isPendingAdminAction(r.status)).length ?? 0;
  const approved = reports?.filter((r) => r.status === "approved" || r.status === "published").length ?? 0;
  const rejected = reports?.filter((r) => r.status === "rejected").length ?? 0;
  const totalSubmitted = reports?.length ?? 0;

  // --- Term-over-term trend (this term's submissions vs the term before it) ---
  const sortedTerms = useMemo(() => sortTermsChronologically(terms ?? []), [terms]);

  const previousTerm = useMemo(() => {
    if (!currentTerm) return null;
    const idx = sortedTerms.findIndex((t) => t.id === currentTerm.id);
    return idx > 0 ? sortedTerms[idx - 1] : null;
  }, [sortedTerms, currentTerm]);

  const currentTermReports = useMemo(
    () => (reports ?? []).filter((r) => r.term_id === currentTerm?.id),
    [reports, currentTerm],
  );
  const previousTermReports = useMemo(
    () => (previousTerm ? (reports ?? []).filter((r) => r.term_id === previousTerm.id) : []),
    [reports, previousTerm],
  );

  const hasPreviousTerm = !!previousTerm;
  const pendingTrend = trendFor(
    currentTermReports.filter((r) => isPendingAdminAction(r.status)).length,
    previousTermReports.filter((r) => isPendingAdminAction(r.status)).length,
    hasPreviousTerm,
  );
  const approvedTrend = trendFor(
    currentTermReports.filter((r) => r.status === "approved" || r.status === "published").length,
    previousTermReports.filter((r) => r.status === "approved" || r.status === "published").length,
    hasPreviousTerm,
  );
  const rejectedTrend = trendFor(
    currentTermReports.filter((r) => r.status === "rejected").length,
    previousTermReports.filter((r) => r.status === "rejected").length,
    hasPreviousTerm,
  );
  const totalTrend = trendFor(currentTermReports.length, previousTermReports.length, hasPreviousTerm);

  // --- Chart data (derived from the currently filtered set — no extra queries) ---
  const statusChartData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of filtered) {
      const label = statusLabel(r.status);
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return [...counts.entries()].map(([name, value]) => ({ name, value }));
  }, [filtered]);

  const classChartData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of filtered) {
      const label = r.class_name || "Unassigned";
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [filtered]);

  // --- Export (PDF / Excel / Print) — same Electron-aware pattern as the
  // admin Reports & Analytics dashboard, so silent/preview printing and PDF
  // export behave identically across the app. ---
  const activeExport = useMemo(() => {
    const summary = [
      { label: "Pending review", value: String(pending) },
      { label: "Approved", value: String(approved) },
      { label: "Returned", value: String(rejected) },
      { label: "Total submitted", value: String(totalSubmitted) },
    ];
    return {
      title: "Report Card Review",
      subtitle: `${school?.name ?? school?.school_name ?? "School"} · ${filtered.length} of ${reports?.length ?? 0} reports shown`,
      summary,
      headers: [
        "Student",
        "Admission #",
        "Class",
        "Year",
        "Term",
        "Teacher",
        "Total",
        "Position",
        "Status",
        "Submitted",
      ],
      rows: filtered.map((r) => [
        r.student_name,
        r.admission_number ?? "—",
        r.class_name ?? "—",
        r.academic_year ?? "—",
        r.term_label || "—",
        r.teacher_name ?? "—",
        fmtScore(r.displayTotal),
        formatRankLabel(r.class_position),
        statusLabel(r.status),
        r.submitted_at ? format(new Date(r.submitted_at), "PP") : r.saved_at ? format(new Date(r.saved_at), "PP") : "—",
      ]),
    };
  }, [filtered, pending, approved, rejected, totalSubmitted, school, reports]);

  const handleExportExcel = () => {
    setExporting("excel");
    try {
      exportGenericTableToExcel(activeExport);
      toast.success(`${activeExport.title}.xlsx downloaded`);
    } finally {
      setExporting(null);
    }
  };

  const handleExportCsv = () => {
    setExporting("csv");
    try {
      exportTable({
        filename: "report-card-review",
        title: activeExport.title,
        headers: activeExport.headers,
        rows: activeExport.rows,
        format: "csv",
      });
      toast.success(`${activeExport.title}.csv downloaded`);
    } finally {
      setExporting(null);
    }
  };

  const handleExportWord = () => {
    setExporting("word");
    try {
      exportTable({
        filename: "report-card-review",
        title: activeExport.title,
        headers: activeExport.headers,
        rows: activeExport.rows,
        format: "word",
      });
      toast.success(`${activeExport.title}.doc downloaded`);
    } finally {
      setExporting(null);
    }
  };

  const handleExportPDF = async () => {
    setExporting("pdf");
    try {
      if (isElectronDesktop()) {
        const api = getDesktopAPI()!;
        const result = await unwrapIpc(
          api.printer.report(
            "custom",
            {
              schoolName: school?.name ?? school?.school_name,
              title: activeExport.title,
              subtitle: activeExport.subtitle,
              headers: activeExport.headers,
              rows: activeExport.rows.map((r) => ({ cells: r })),
            },
            { toPdf: true },
          ),
        );
        toast.success((result as { path?: string })?.path || "PDF saved to exports folder");
      } else {
        await exportGenericTableToPDF(activeExport);
        toast.success(`${activeExport.title}.pdf downloaded`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "PDF export failed");
    } finally {
      setExporting(null);
    }
  };

  const handlePrint = async () => {
    setExporting("print");
    try {
      if (isElectronDesktop()) {
        const api = getDesktopAPI()!;
        await unwrapIpc(
          api.printer.report(
            "custom",
            {
              schoolName: school?.name ?? school?.school_name,
              title: activeExport.title,
              subtitle: activeExport.subtitle,
              headers: activeExport.headers,
              rows: activeExport.rows.map((r) => ({ cells: r })),
            },
            { preview: true },
          ),
        );
      } else {
        window.print();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Print failed");
    } finally {
      setExporting(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Report card review"
        description="Review, edit, approve, deliver to parents, and browse archived reports."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="default" size="sm" className="gap-1.5">
                  <Download className="h-3.5 w-3.5" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExportPDF} disabled={exporting === "pdf"}>
                  PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportWord} disabled={exporting === "word"}>
                  Word doc
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportExcel} disabled={exporting === "excel"}>
                  Excel
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportCsv} disabled={exporting === "csv"}>
                  CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handlePrint} disabled={exporting === "print"}>
                  <Printer className="mr-2 h-4 w-4" /> Print
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button asChild variant="outline" size="sm">
              <Link to="/admin/report-cards/archive">
                <Archive className="mr-1 h-4 w-4" />
                Archive
              </Link>
            </Button>
          </div>
        }
      />
      <div className="space-y-6 p-6 md:p-8 print:space-y-4">
        <ActiveTermBanner />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            index={0}
            label="Pending review"
            value={pending}
            icon={Clock}
            tone="text-[hsl(var(--warning))]"
            trend={pendingTrend.label}
            trendDirection={pendingTrend.direction}
            invert
          />
          <StatCard
            index={1}
            label="Approved"
            value={approved}
            icon={CheckCircle}
            tone="text-[hsl(var(--success))]"
            trend={approvedTrend.label}
            trendDirection={approvedTrend.direction}
          />
          <StatCard
            index={2}
            label="Returned"
            value={rejected}
            icon={XCircle}
            tone="text-[hsl(var(--critical))]"
            trend={rejectedTrend.label}
            trendDirection={rejectedTrend.direction}
            invert
          />
          <StatCard
            index={3}
            label="Total submitted"
            value={totalSubmitted}
            icon={FileText}
            trend={totalTrend.label}
            trendDirection={totalTrend.direction}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2 print:hidden">
          <ChartCard title="Status distribution" subtitle="Current filter selection">
            {statusChartData.length ? (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={statusChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={85}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                    isAnimationActive
                  >
                    {statusChartData.map((entry) => (
                      <Cell key={entry.name} fill={STATUS_CHART_COLORS[entry.name] ?? "hsl(var(--muted-foreground))"} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-16 text-center text-sm text-muted-foreground">No data for the current filters.</p>
            )}
          </ChartCard>

          <ChartCard title="Submissions by class" subtitle="Top classes in the current filter selection">
            {classChartData.length ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={classChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" fontSize={11} stroke="hsl(var(--muted-foreground))" />
                  <YAxis fontSize={11} allowDecimals={false} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
                  <Bar dataKey="value" name="Reports" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} isAnimationActive />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-16 text-center text-sm text-muted-foreground">No data for the current filters.</p>
            )}
          </ChartCard>
        </div>

        <Card className="print:hidden">
          <CardHeader>
            <CardTitle className="font-display text-base">Bulk send to parents</CardTitle>
            <CardDescription>
              Deliver all approved reports for a class. Already-sent reports are skipped.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label>Class</Label>
              <Select value={bulkClassId} onValueChange={setBulkClassId}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent>
                  {(classRows ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Term (optional)</Label>
              <Select value={bulkTermId || "__current__"} onValueChange={(v) => setBulkTermId(v === "__current__" ? "" : v)}>
                <SelectTrigger className="w-52">
                  <SelectValue placeholder="Active term" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__current__">
                    {currentTerm ? formatTermLabel(currentTerm) : "Active term"}
                  </SelectItem>
                  {(terms ?? []).map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {formatTermLabel(t)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button disabled={!bulkClassId || bulkSend.isPending} onClick={() => bulkSend.mutate()}>
              {bulkSend.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Send className="mr-1 h-4 w-4" />}
              Send class reports
            </Button>
          </CardContent>
        </Card>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex flex-wrap items-center gap-3 print:hidden"
        >
          <Input
            placeholder="Search student, admission #, class…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <Select value={yearFilter} onValueChange={setYearFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All years</SelectItem>
              {years.map((y) => (
                <SelectItem key={y} value={y}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={termFilter} onValueChange={setTermFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Term" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All terms</SelectItem>
              {(terms ?? []).map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {formatTermLabel(t)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="pending_review">Pending Review</SelectItem>
              <SelectItem value="reviewed">Reviewed</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
          <Select value={teacherFilter} onValueChange={setTeacherFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Teacher" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All teachers</SelectItem>
              {teachers.map(([id, name]) => (
                <SelectItem key={id} value={id}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={classFilter} onValueChange={setClassFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Class" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All classes</SelectItem>
              {classes.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {activeFilterCount > 0 && (
            <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={clearFilters}>
              <FilterX className="h-3.5 w-3.5" />
              Clear filters ({activeFilterCount})
            </Button>
          )}
          <span className="ml-auto text-xs text-muted-foreground" aria-live="polite">
            Showing {pag.total} of {reports?.length ?? 0} reports
          </span>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
          <Card>
            <CardContent className="p-0">
              <div className="table-scroll">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Admission #</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead>Year</TableHead>
                      <TableHead>Term</TableHead>
                      <TableHead>Teacher</TableHead>
                      <TableHead numeric>Total</TableHead>
                      <TableHead numeric>Position</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead actions>Open</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="[&>tr:nth-child(even)]:bg-muted/20">
                    {pag.slice.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.student_name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {r.admission_number ?? "—"}
                        </TableCell>
                        <TableCell>{r.class_name}</TableCell>
                        <TableCell className="text-sm">{r.academic_year ?? "—"}</TableCell>
                        <TableCell>{r.term_label || "—"}</TableCell>
                        <TableCell>{r.teacher_name ?? "—"}</TableCell>
                        <TableCell numeric className="tabular-nums">{fmtScore(r.displayTotal)}</TableCell>
                        <TableCell numeric className="tabular-nums">{formatRankLabel(r.class_position)}</TableCell>
                        <TableCell>
                          <Badge variant={statusBadgeVariant(r.status)}>
                            {statusLabel(r.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {r.submitted_at
                            ? format(new Date(r.submitted_at), "MMM d, yyyy")
                            : r.saved_at
                              ? format(new Date(r.saved_at), "MMM d, yyyy")
                              : "—"}
                        </TableCell>
                        <TableCell actions>
                          <div className="inline-flex items-center gap-1">
                            <Button asChild size="sm" variant="outline">
                              <Link to={`/admin/report-cards/view?id=${encodeURIComponent(r.id)}`}>Review</Link>
                            </Button>
                            <Button asChild size="sm" variant="ghost">
                              <Link to={`/admin/report-cards/versions?id=${encodeURIComponent(r.id)}`}>History</Link>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!pag.total && (
                      <TableRow>
                        <TableCell colSpan={11} className="py-10 text-center text-muted-foreground">
                          {activeFilterCount > 0 ? (
                            <div className="space-y-2">
                              <p>No reports match your current filters.</p>
                              <Button variant="outline" size="sm" onClick={clearFilters}>
                                Clear filters
                              </Button>
                            </div>
                          ) : (
                            "No submitted reports yet."
                          )}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              <TablePagination
                page={pag.page}
                totalPages={pag.totalPages}
                total={pag.total}
                from={pag.from}
                to={pag.to}
                pageSize={pag.pageSize}
                pageSizes={pag.pageSizes}
                onPageChange={pag.setPage}
                onPageSizeChange={pag.setPageSize}
              />
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </>
  );
}

import { withReportLayout } from "@/report/withReportLayout";
export default withReportLayout("admin", AdminReportReview);
