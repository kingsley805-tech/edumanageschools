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
import { ActiveTermBanner } from "@/report/portal/active-term-banner";
import {
  DashboardChartCard,
  DashboardStatCard,
  DashboardStatGrid,
} from "@/components/metronic/DashboardStatCard";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMemo, useState } from "react";
import { format } from "date-fns";
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
  Search,
  ChevronRight,
  MoreHorizontal,
  ExternalLink,
  GraduationCap,
  Sparkles,
} from "lucide-react";
import { useClientPagination } from "@/report/hooks/use-client-pagination";
import { TablePagination } from "@/report/portal/table-pagination";
import { fetchSchoolTerms, formatTermLabel } from "@/report/lib/terms";
import { deliverClassReportsToParents } from "@/report/lib/report-delivery";
import { TERM_REPORT_ADMIN_LIST_SELECT } from "@/report/lib/term-report";
import { fetchAdminTermClassReports } from "@/report/lib/term-class-report";
import { toast } from "sonner";
import { exportGenericTableToExcel, exportGenericTableToPDF } from "@/lib/exportUtils";
import { exportTable } from "@/modules/lib/exportTable";
import { getDesktopAPI, isElectronDesktop, unwrapIpc } from "@/desktop/electronBridge";
import { EntityCellIdentity, EntityCardItem, getEntityStatusBadge } from "@/components/entities/EntityRow";
import { withReportLayout } from "@/report/withReportLayout";

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

  const { data: classReports = [] } = useQuery({
    queryKey: ["admin-term-class-reports", profile?.school_id],
    enabled: !!profile?.school_id,
    queryFn: () => fetchAdminTermClassReports(profile!.school_id!),
  });

  const pendingClassReports = useMemo(
    () => classReports.filter((r) => isPendingAdminAction(r.status) || r.status === "reviewed"),
    [classReports],
  );

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
    <div className="space-y-5 font-sans lg:space-y-7.5">
      {/* ── Standard Metronic Page Toolbar ────────────────────────────── */}
      <div className="flex flex-wrap items-center lg:items-end justify-between gap-4 pb-2 border-b border-border/40">
        <div className="flex min-w-0 flex-col justify-center gap-1.5">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Link to="/admin" className="hover:text-primary transition-colors">
              Dashboard
            </Link>
            <ChevronRight className="size-3 text-muted-foreground/60" />
            <span>Academics</span>
            <ChevronRight className="size-3 text-muted-foreground/60" />
            <span className="text-foreground font-semibold">Report Cards</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Report Card Review
            </h1>
            {pending > 0 && (
              <span className="kt-badge kt-badge-outline kt-badge-warning gap-1 py-1 px-2.5 text-xs font-semibold">
                <Clock className="size-3.5" />
                {pending} Pending
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Review, edit, approve, deliver to parents, and browse archived student reports.
          </p>
        </div>

        {/* Toolbar Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs font-medium border-border">
                <Download className="size-3.5 text-muted-foreground" />
                Export Data
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={handleExportPDF} disabled={exporting === "pdf"}>
                Export as PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportWord} disabled={exporting === "word"}>
                Export as Word
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportExcel} disabled={exporting === "excel"}>
                Export as Excel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportCsv} disabled={exporting === "csv"}>
                Export as CSV
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handlePrint} disabled={exporting === "print"}>
                <Printer className="mr-2 size-3.5" /> Print View
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button asChild variant="outline" size="sm" className="h-9 gap-1.5 text-xs font-medium border-border">
            <Link to="/admin/report-cards/archive">
              <Archive className="size-3.5 text-muted-foreground" />
              Report Archive
            </Link>
          </Button>
        </div>
      </div>

      {/* Active Term Notification */}
      <ActiveTermBanner />

      {/* ── Standard Stat Cards ───────────────────────────────────────── */}
      <DashboardStatGrid>
        <DashboardStatCard
          label="Pending Review"
          value={pending}
          description={pendingTrend.label || "Awaiting admin signoff"}
          icon={Clock}
          tone="amber"
        />
        <DashboardStatCard
          label="Approved / Ready"
          value={approved}
          description={approvedTrend.label || "Ready for distribution"}
          icon={CheckCircle}
          tone="emerald"
        />
        <DashboardStatCard
          label="Returned / Rejected"
          value={rejected}
          description={rejectedTrend.label || "Requires teacher update"}
          icon={XCircle}
          tone="rose"
        />
        <DashboardStatCard
          label="Total Submissions"
          value={totalSubmitted}
          description={totalTrend.label || "Across all registered classes"}
          icon={FileText}
          tone="primary"
        />
      </DashboardStatGrid>

      {/* ── Analytics Visualizations ──────────────────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-2 lg:gap-7.5 print:hidden">
        <DashboardChartCard
          title="Status Distribution"
          description="Proportion of review states in filtered set"
        >
          {statusChartData.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={statusChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={75}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                  isAnimationActive
                >
                  {statusChartData.map((entry) => (
                    <Cell key={entry.name} fill={STATUS_CHART_COLORS[entry.name] ?? "hsl(var(--muted-foreground))"} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="py-14 text-center text-sm text-secondary-foreground">No data for the current filters.</div>
          )}
        </DashboardChartCard>

        <DashboardChartCard
          title="Submissions by Class"
          description="Top classes by volume of submitted report cards"
        >
          {classChartData.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={classChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" fontSize={11} stroke="hsl(var(--muted-foreground))" />
                <YAxis fontSize={11} allowDecimals={false} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="value" name="Reports" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} isAnimationActive />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="py-14 text-center text-sm text-secondary-foreground">No data for the current filters.</div>
          )}
        </DashboardChartCard>
      </div>

      {/* ── Overall Class Reports pending review ──────────────────────── */}
      {pendingClassReports.length > 0 && (
        <div className="kt-card rounded-xl border border-border bg-card shadow-xs p-5 space-y-3 print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-lg bg-warning/10 text-warning flex items-center justify-center font-bold">
              <GraduationCap className="size-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Overall Class Reports awaiting review
              </h3>
              <p className="text-xs text-muted-foreground">
                Approve these before teachers can print or download (Excel, PDF, Word).
              </p>
            </div>
          </div>
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Class</TableHead>
                  <TableHead>Term</TableHead>
                  <TableHead>Students</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingClassReports.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.class_name ?? "—"}</TableCell>
                    <TableCell>
                      {row.term_label}
                      {row.academic_year ? ` · ${row.academic_year}` : ""}
                    </TableCell>
                    <TableCell>{row.student_count}</TableCell>
                    <TableCell>
                      <Badge variant={statusBadgeVariant(row.status)}>
                        {statusLabel(row.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="outline">
                        <Link to={`/admin/report-cards/class-view?id=${row.id}`}>
                          Review <ChevronRight className="ml-1 size-3.5" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* ── Bulk Delivery Action Card ─────────────────────────────────── */}
      <div className="kt-card rounded-xl border border-border bg-card shadow-xs p-5 space-y-4 print:hidden">
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
            <Send className="size-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Bulk Deliver Reports to Parents</h3>
            <p className="text-xs text-muted-foreground">
              Deliver all approved reports for an entire class. Already-sent reports will be skipped.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3 pt-1">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Class</Label>
            <Select value={bulkClassId} onValueChange={setBulkClassId}>
              <SelectTrigger className="w-48 h-9 text-xs">
                <SelectValue placeholder="Select class" />
              </SelectTrigger>
              <SelectContent>
                {(classRows ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id} className="text-xs">
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Term (optional)</Label>
            <Select value={bulkTermId || "__current__"} onValueChange={(v) => setBulkTermId(v === "__current__" ? "" : v)}>
              <SelectTrigger className="w-52 h-9 text-xs">
                <SelectValue placeholder="Active term" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__current__" className="text-xs">
                  {currentTerm ? formatTermLabel(currentTerm) : "Active term"}
                </SelectItem>
                {(terms ?? []).map((t) => (
                  <SelectItem key={t.id} value={t.id} className="text-xs">
                    {formatTermLabel(t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            size="sm"
            className="h-9 gap-1.5 text-xs font-medium"
            disabled={!bulkClassId || bulkSend.isPending}
            onClick={() => bulkSend.mutate()}
          >
            {bulkSend.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Send className="size-3.5" />
            )}
            Send Class Reports
          </Button>
        </div>
      </div>

      {/* ── Filter Toolbar ────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2.5 print:hidden">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search student, admission #, class…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>

        <Select value={yearFilter} onValueChange={setYearFilter}>
          <SelectTrigger className="w-36 h-9 text-xs">
            <SelectValue placeholder="Year" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">All years</SelectItem>
            {years.map((y) => (
              <SelectItem key={y} value={y} className="text-xs">
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={termFilter} onValueChange={setTermFilter}>
          <SelectTrigger className="w-40 h-9 text-xs">
            <SelectValue placeholder="Term" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">All terms</SelectItem>
            {(terms ?? []).map((t) => (
              <SelectItem key={t.id} value={t.id} className="text-xs">
                {formatTermLabel(t)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 h-9 text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">All statuses</SelectItem>
            <SelectItem value="pending_review" className="text-xs">Pending Review</SelectItem>
            <SelectItem value="reviewed" className="text-xs">Reviewed</SelectItem>
            <SelectItem value="approved" className="text-xs">Approved</SelectItem>
            <SelectItem value="published" className="text-xs">Published</SelectItem>
            <SelectItem value="rejected" className="text-xs">Rejected</SelectItem>
          </SelectContent>
        </Select>

        <Select value={classFilter} onValueChange={setClassFilter}>
          <SelectTrigger className="w-36 h-9 text-xs">
            <SelectValue placeholder="Class" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">All classes</SelectItem>
            {classes.map((c) => (
              <SelectItem key={c} value={c} className="text-xs">
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={teacherFilter} onValueChange={setTeacherFilter}>
          <SelectTrigger className="w-40 h-9 text-xs">
            <SelectValue placeholder="Teacher" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">All teachers</SelectItem>
            {teachers.map(([id, name]) => (
              <SelectItem key={id} value={id} className="text-xs">
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {activeFilterCount > 0 && (
          <Button variant="ghost" size="sm" className="h-9 gap-1.5 text-xs text-muted-foreground hover:text-foreground" onClick={clearFilters}>
            <FilterX className="size-3.5" />
            Clear ({activeFilterCount})
          </Button>
        )}

        <span className="ml-auto text-xs text-muted-foreground font-mono">
          {pag.total} {pag.total === 1 ? "report" : "reports"} found
        </span>
      </div>

      {/* ── Entity Table / View ────────────────────────────────────────── */}
      <div className="kt-card rounded-xl border border-border bg-card shadow-xs overflow-hidden">
        {/* Desktop / Tablet Table View */}
        <div className="hidden md:block overflow-x-auto">
          <Table className="kt-table min-w-full">
            <TableHeader>
              <TableRow className="border-b border-border/80 bg-muted/20">
                <TableHead className="min-w-[220px]">Student Entity</TableHead>
                <TableHead className="min-w-[120px]">Class</TableHead>
                <TableHead className="min-w-[130px]">Academic Term</TableHead>
                <TableHead className="min-w-[140px]">Teacher</TableHead>
                <TableHead className="text-right">Score</TableHead>
                <TableHead className="text-right">Position</TableHead>
                <TableHead className="min-w-[110px]">Status</TableHead>
                <TableHead className="min-w-[110px]">Submitted</TableHead>
                <TableHead className="text-right min-w-[130px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pag.slice.map((r) => {
                const statusBadge = getEntityStatusBadge(r.status);
                return (
                  <TableRow key={r.id} className="hover:bg-muted/30 transition-colors">
                    {/* Entity Identity (Name + Monogram + Admission No) */}
                    <TableCell>
                      <EntityCellIdentity
                        name={r.student_name}
                        code={r.admission_number ? `#${r.admission_number}` : undefined}
                        to={`/admin/report-cards/view?id=${encodeURIComponent(r.id)}`}
                        statusVariant={r.status}
                      />
                    </TableCell>

                    {/* Class */}
                    <TableCell>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-muted/60 text-foreground border border-border/60">
                        {r.class_name || "—"}
                      </span>
                    </TableCell>

                    {/* Academic Term */}
                    <TableCell className="text-xs">
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">{r.term_label || "—"}</span>
                        <span className="text-[11px] text-muted-foreground">{r.academic_year || "—"}</span>
                      </div>
                    </TableCell>

                    {/* Teacher */}
                    <TableCell className="text-xs text-muted-foreground">
                      {r.teacher_name || "—"}
                    </TableCell>

                    {/* Score */}
                    <TableCell className="text-right font-semibold text-xs tabular-nums text-foreground">
                      {fmtScore(r.displayTotal)}
                    </TableCell>

                    {/* Position */}
                    <TableCell className="text-right font-semibold text-xs tabular-nums text-primary">
                      {formatRankLabel(r.class_position)}
                    </TableCell>

                    {/* Status Badge */}
                    <TableCell>
                      <Badge variant={statusBadge.variant} className={statusBadge.className}>
                        <span className={`mr-1.5 size-1.5 rounded-full ${statusBadge.dotColor}`} />
                        {statusLabel(r.status)}
                      </Badge>
                    </TableCell>

                    {/* Submitted Date */}
                    <TableCell className="text-xs text-muted-foreground">
                      {r.submitted_at
                        ? format(new Date(r.submitted_at), "MMM d, yyyy")
                        : r.saved_at
                          ? format(new Date(r.saved_at), "MMM d, yyyy")
                          : "—"}
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="text-right">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        <Button asChild size="sm" variant="outline" className="h-8 px-2.5 text-xs">
                          <Link to={`/admin/report-cards/view?id=${encodeURIComponent(r.id)}`}>
                            Review
                          </Link>
                        </Button>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="size-8 p-0">
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44 text-xs">
                            <DropdownMenuItem asChild>
                              <Link to={`/admin/report-cards/versions?id=${encodeURIComponent(r.id)}`}>
                                <Clock className="mr-2 size-3.5" /> Version History
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link to={`/admin/report-cards/view?id=${encodeURIComponent(r.id)}`}>
                                <ExternalLink className="mr-2 size-3.5" /> Full Sheet
                              </Link>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}

              {!pag.total && (
                <TableRow>
                  <TableCell colSpan={9} className="py-12 text-center text-muted-foreground text-xs">
                    {activeFilterCount > 0 ? (
                      <div className="space-y-2">
                        <p>No report cards match your current search and filters.</p>
                        <Button variant="outline" size="sm" onClick={clearFilters} className="text-xs">
                          Clear Filters
                        </Button>
                      </div>
                    ) : (
                      "No submitted report cards yet."
                    )}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Mobile Entity Cards Layout (< md breakpoint) */}
        <div className="md:hidden p-3.5 space-y-3">
          {pag.slice.map((r) => (
            <EntityCardItem
              key={r.id}
              id={r.id}
              name={r.student_name}
              code={r.admission_number ? `#${r.admission_number}` : undefined}
              to={`/admin/report-cards/view?id=${encodeURIComponent(r.id)}`}
              statusVariant={r.status}
              metaTags={[
                { label: r.class_name || "Unassigned" },
                { label: `${r.term_label || "Term"} · ${r.academic_year || ""}` },
                { label: r.teacher_name ? `Teacher: ${r.teacher_name}` : "Teacher: —" },
              ]}
              metrics={[
                { label: "Total Score", value: fmtScore(r.displayTotal) },
                { label: "Class Position", value: formatRankLabel(r.class_position), highlight: true },
              ]}
              primaryAction={{
                label: "Review",
                to: `/admin/report-cards/view?id=${encodeURIComponent(r.id)}`,
              }}
              secondaryAction={{
                label: "History",
                to: `/admin/report-cards/versions?id=${encodeURIComponent(r.id)}`,
              }}
            />
          ))}

          {!pag.total && (
            <div className="py-10 text-center text-xs text-muted-foreground">
              {activeFilterCount > 0 ? (
                <div className="space-y-2">
                  <p>No report cards match your current filters.</p>
                  <Button variant="outline" size="sm" onClick={clearFilters} className="text-xs">
                    Clear Filters
                  </Button>
                </div>
              ) : (
                "No submitted reports yet."
              )}
            </div>
          )}
        </div>

        {/* Pagination Toolbar */}
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
      </div>
    </div>
  );
}

export default withReportLayout("admin", AdminReportReview);
