import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/report/hooks/use-auth";
import { useSchool, useCurrentTerm } from "@/report/hooks/use-school-data";
import { PageHeader } from "@/report/portal/page-header";
import { ActiveTermBanner } from "@/report/portal/active-term-banner";
import { StatCard } from "@/report/portal/stat-card";
import { trendFor, sortTermsChronologically } from "@/report/lib/trend";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { isPendingAdminAction, statusBadgeVariant, statusLabel } from "@/report/lib/report-card-status";
import { totalFromSubjects, fmtScore, formatRankLabel, type SubjectRow } from "@/report/lib/shepherd-grading";
import { useClientPagination } from "@/report/hooks/use-client-pagination";
import { TablePagination } from "@/report/portal/table-pagination";
import { fetchSchoolTerms, formatTermLabel } from "@/report/lib/terms";
import { TERM_REPORT_HISTORY_LIST_SELECT } from "@/report/lib/term-report";
import { fetchTeacherAssignedClassIds } from "@/report/lib/teacher-assignments";
import { useMemo, useState } from "react";
import { FileText, Clock, CheckCircle, XCircle, Download, Printer, FilterX } from "lucide-react";
import { toast } from "sonner";
import { exportGenericTableToExcel, exportGenericTableToPDF } from "@/lib/exportUtils";
import { exportTable } from "@/modules/lib/exportTable";
import { getDesktopAPI, isElectronDesktop, unwrapIpc } from "@/desktop/electronBridge";
function TeacherReportHistory() {
  const { user, profile } = useAuth();
  const schoolId = profile?.school_id ?? "";
  const { data: school } = useSchool(schoolId);
  const { data: currentTerm } = useCurrentTerm();
  const [search, setSearch] = useState("");
  const [yearFilter, setYearFilter] = useState("all");
  const [termFilter, setTermFilter] = useState("all");
  const [classFilter, setClassFilter] = useState("all");
  const [exporting, setExporting] = useState<"pdf" | "excel" | "word" | "csv" | "print" | null>(null);

  const { data: terms } = useQuery({
    queryKey: ["school-terms", schoolId],
    enabled: !!schoolId,
    queryFn: () => fetchSchoolTerms(schoolId),
  });

  const { data: reports } = useQuery({
    queryKey: ["term-reports-history", user?.id, schoolId],
    enabled: !!user?.id && !!schoolId,
    queryFn: async () => {
      const classIds = await fetchTeacherAssignedClassIds(user!.id);
      if (!classIds.length) return [];

      const { data, error } = await supabase
        .from("term_report_cards")
        .select(`${TERM_REPORT_HISTORY_LIST_SELECT}, students(admission_number)`)
        .in("class_id", classIds)
        .neq("status", "draft")
        .order("academic_year", { ascending: false })
        .order("term_label", { ascending: false })
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => {
        const subs = (Array.isArray(r.subjects) ? r.subjects : []) as unknown as SubjectRow[];
        const computed = totalFromSubjects(subs);
        return {
          ...r,
          admission_number:
            (r.students as { admission_number: string | null } | null)?.admission_number ?? null,
          displayTotal: computed > 0 ? computed : (r.total_score ?? 0),
        };
      });
    },
  });

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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (reports ?? []).filter((r) => {
      const matchSearch =
        !q ||
        r.student_name.toLowerCase().includes(q) ||
        (r.class_name ?? "").toLowerCase().includes(q) ||
        (r.admission_number ?? "").toLowerCase().includes(q);
      const matchYear = yearFilter === "all" || r.academic_year === yearFilter;
      const matchTerm = termFilter === "all" || r.term_id === termFilter;
      const matchClass = classFilter === "all" || r.class_name === classFilter;
      return matchSearch && matchYear && matchTerm && matchClass;
    });
  }, [reports, search, yearFilter, termFilter, classFilter]);

  const activeFilterCount = [
    search.trim() ? 1 : 0,
    yearFilter !== "all",
    termFilter !== "all",
    classFilter !== "all",
  ].filter(Boolean).length;

  const clearFilters = () => {
    setSearch("");
    setYearFilter("all");
    setTermFilter("all");
    setClassFilter("all");
  };

  const pag = useClientPagination(filtered, {
    resetKey: `${search}-${yearFilter}-${termFilter}-${classFilter}`,
  });

  const total = reports?.length ?? 0;
  const approved = reports?.filter((r) => r.status === "approved" || r.status === "published").length ?? 0;
  const pending = reports?.filter((r) => isPendingAdminAction(r.status)).length ?? 0;
  const rejected = reports?.filter((r) => r.status === "rejected").length ?? 0;

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

  const totalTrend = trendFor(currentTermReports.length, previousTermReports.length, hasPreviousTerm);
  const approvedTrend = trendFor(
    currentTermReports.filter((r) => r.status === "approved" || r.status === "published").length,
    previousTermReports.filter((r) => r.status === "approved" || r.status === "published").length,
    hasPreviousTerm,
  );
  const pendingTrend = trendFor(
    currentTermReports.filter((r) => isPendingAdminAction(r.status)).length,
    previousTermReports.filter((r) => isPendingAdminAction(r.status)).length,
    hasPreviousTerm,
  );
  const rejectedTrend = trendFor(
    currentTermReports.filter((r) => r.status === "rejected").length,
    previousTermReports.filter((r) => r.status === "rejected").length,
    hasPreviousTerm,
  );

  const activeExport = useMemo(
    () => ({
      title: "My Report Card History",
      subtitle: `${school?.name ?? school?.school_name ?? "School"} · ${filtered.length} of ${total} reports shown`,
      summary: [
        { label: "Total", value: String(total) },
        { label: "Approved", value: String(approved) },
        { label: "Pending review", value: String(pending) },
        { label: "Returned", value: String(rejected) },
      ],
      headers: ["Student", "Admission #", "Class", "Year", "Term", "Total", "Position", "Status", "Updated"],
      rows: filtered.map((r) => [
        r.student_name,
        r.admission_number ?? "—",
        r.class_name ?? "—",
        r.academic_year ?? "—",
        r.term_label || "—",
        fmtScore(r.displayTotal),
        formatRankLabel(r.class_position),
        statusLabel(r.status),
        format(new Date(r.updated_at), "PP"),
      ]),
    }),
    [filtered, total, approved, pending, rejected, school],
  );

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
        filename: "report-history",
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
        filename: "report-history",
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
        title="Report history"
        description="Current and past term reports for your assigned classes only."
        actions={
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
        }
      />
      <div className="p-6 md:p-8 space-y-6 print:space-y-4">
        <ActiveTermBanner />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard index={0} label="Total reports" value={total} icon={FileText} trend={totalTrend.label} trendDirection={totalTrend.direction} />
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
            label="Pending review"
            value={pending}
            icon={Clock}
            tone="text-[hsl(var(--warning))]"
            trend={pendingTrend.label}
            trendDirection={pendingTrend.direction}
            invert
          />
          <StatCard
            index={3}
            label="Returned"
            value={rejected}
            icon={XCircle}
            tone="text-[hsl(var(--critical))]"
            trend={rejectedTrend.label}
            trendDirection={rejectedTrend.direction}
            invert
          />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex flex-wrap items-center gap-3 print:hidden"
        >
          <Input
            placeholder="Search student, admission #…"
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
            Showing {pag.total} of {total} reports
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
                      <TableHead numeric>Total</TableHead>
                      <TableHead numeric>Position</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Sent</TableHead>
                      <TableHead>Updated</TableHead>
                      <TableHead actions>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="[&>tr:nth-child(even)]:bg-muted/20">
                    {pag.total ? (
                      pag.slice.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium">{r.student_name}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {r.admission_number ?? "—"}
                          </TableCell>
                          <TableCell>{r.class_name}</TableCell>
                          <TableCell className="text-sm">{r.academic_year ?? "—"}</TableCell>
                          <TableCell>{r.term_label || "—"}</TableCell>
                          <TableCell numeric className="tabular-nums">{fmtScore(r.displayTotal)}</TableCell>
                          <TableCell numeric className="tabular-nums">{formatRankLabel(r.class_position)}</TableCell>
                          <TableCell>
                            <Badge variant={statusBadgeVariant(r.status)}>
                              {statusLabel(r.status)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {r.status === "published" ? "Sent" : r.status === "approved" ? "Ready" : "—"}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {format(new Date(r.updated_at), "MMM d, yyyy")}
                          </TableCell>
                          <TableCell actions>
                            <div className="inline-flex items-center gap-1">
                              <Button asChild size="sm" variant="outline">
                                <Link to={`/teacher/report-cards/view?id=${encodeURIComponent(r.id)}`}>View</Link>
                              </Button>
                              <Button asChild size="sm">
                                <Link to={`/teacher/report-cards/view?id=${encodeURIComponent(r.id)}&edit=1`}>Edit report</Link>
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                          {activeFilterCount > 0 ? (
                            <div className="space-y-2">
                              <p>No reports match your current filters.</p>
                              <Button variant="outline" size="sm" onClick={clearFilters}>
                                Clear filters
                              </Button>
                            </div>
                          ) : (
                            "No reports submitted yet"
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
export default withReportLayout("teacher", TeacherReportHistory);
