import { Link, useSearchParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  ArrowLeft,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Printer,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/report/portal/page-header";
import { ActiveTermBanner } from "@/report/portal/active-term-banner";
import { withReportLayout } from "@/report/withReportLayout";
import { useAuth } from "@/report/hooks/use-auth";
import { useSchool } from "@/report/hooks/use-school-data";
import { fetchTeacherAssignedClassIds } from "@/report/lib/teacher-assignments";
import {
  fetchTeacherTermClassReports,
  type TermClassReportRow,
} from "@/report/lib/term-class-report";
import {
  canExportClassReport,
  statusBadgeVariant,
  statusLabel,
} from "@/report/lib/report-card-status";
import { exportOverallClassReport } from "@/report/lib/overall-class-report-export";
import { OverallClassReport } from "@/report/components/overall-class-report";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useClientPagination } from "@/report/hooks/use-client-pagination";
import { TablePagination } from "@/report/portal/table-pagination";
import type { ExportFormat } from "@/modules/lib/exportTable";

function TeacherClassReportHistory() {
  const { user, profile } = useAuth();
  const schoolId = profile?.school_id ?? "";
  const { data: school } = useSchool(schoolId);
  const [searchParams, setSearchParams] = useSearchParams();
  const previewId = searchParams.get("preview") ?? "";

  const [search, setSearch] = useState("");
  const [yearFilter, setYearFilter] = useState("all");
  const [termFilter, setTermFilter] = useState("all");
  const [classFilter, setClassFilter] = useState("all");
  const [previewReport, setPreviewReport] = useState<TermClassReportRow | null>(null);
  const [studentPicker, setStudentPicker] = useState<TermClassReportRow | null>(null);

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["term-class-reports-history", user?.id, schoolId],
    enabled: !!user?.id && !!schoolId,
    queryFn: async () => {
      const classIds = await fetchTeacherAssignedClassIds(user!.id);
      return fetchTeacherTermClassReports(classIds);
    },
  });

  // Open preview from notification deep-link
  useEffect(() => {
    if (!previewId || !reports.length) return;
    const match = reports.find((r) => r.id === previewId);
    if (match) setPreviewReport(match);
  }, [previewId, reports]);

  const years = useMemo(() => {
    const set = new Set<string>();
    for (const r of reports) if (r.academic_year) set.add(r.academic_year);
    return [...set].sort().reverse();
  }, [reports]);

  const terms = useMemo(() => {
    const set = new Set<string>();
    for (const r of reports) if (r.term_label) set.add(r.term_label);
    return [...set].sort();
  }, [reports]);

  const classes = useMemo(() => {
    const set = new Set<string>();
    for (const r of reports) if (r.class_name) set.add(r.class_name);
    return [...set].sort();
  }, [reports]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return reports.filter((r) => {
      const matchSearch =
        !q ||
        (r.class_name ?? "").toLowerCase().includes(q) ||
        (r.term_label ?? "").toLowerCase().includes(q) ||
        (r.academic_year ?? "").toLowerCase().includes(q);
      const matchYear = yearFilter === "all" || r.academic_year === yearFilter;
      const matchTerm = termFilter === "all" || r.term_label === termFilter;
      const matchClass = classFilter === "all" || r.class_name === classFilter;
      return matchSearch && matchYear && matchTerm && matchClass;
    });
  }, [reports, search, yearFilter, termFilter, classFilter]);

  const pag = useClientPagination(filtered, { resetKey: `${yearFilter}-${termFilter}-${classFilter}-${search}` });

  const openPreview = (row: TermClassReportRow) => {
    setPreviewReport(row);
    const params = new URLSearchParams(searchParams);
    params.set("preview", row.id);
    setSearchParams(params, { replace: true });
  };

  const closePreview = () => {
    setPreviewReport(null);
    const params = new URLSearchParams(searchParams);
    params.delete("preview");
    setSearchParams(params, { replace: true });
  };

  const runExport = (row: TermClassReportRow, format: ExportFormat) => {
    if (!canExportClassReport(row.status)) {
      toast.message("This class report must be approved before download.");
      return;
    }
    if (!row.snapshot?.students?.length) {
      toast.error("No snapshot data on this report.");
      return;
    }
    try {
      exportOverallClassReport(row.snapshot, format);
      toast.success(
        format === "excel" ? "Excel downloaded" : format === "word" ? "Word downloaded" : "PDF downloaded",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    }
  };

  return (
    <>
      <PageHeader
        title="Class report history"
        description="Overall Class Performance & Position Reports by term. Preview, download, print, or open a student card from that term."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/teacher/report-cards?mode=class">
              <ArrowLeft className="mr-1 h-4 w-4" /> Back to reports
            </Link>
          </Button>
        }
      />

      <div className="min-w-0 space-y-4 p-4 md:p-6">
        <ActiveTermBanner />

        <Card>
          <CardContent className="flex flex-wrap gap-2 p-4">
            <Input
              placeholder="Search class or term…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs h-9"
            />
            <Select value={yearFilter} onValueChange={setYearFilter}>
              <SelectTrigger className="w-36 h-9">
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
              <SelectTrigger className="w-40 h-9">
                <SelectValue placeholder="Term" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All terms</SelectItem>
                {terms.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={classFilter} onValueChange={setClassFilter}>
              <SelectTrigger className="w-40 h-9">
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
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Class</TableHead>
                  <TableHead>Academic Year</TableHead>
                  <TableHead>Term</TableHead>
                  <TableHead>Students</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                      Loading…
                    </TableCell>
                  </TableRow>
                ) : pag.slice.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                      No class reports submitted yet. Open Overall Class Report and send one for
                      review.
                    </TableCell>
                  </TableRow>
                ) : (
                  pag.slice.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.class_name ?? "—"}</TableCell>
                      <TableCell>{row.academic_year ?? "—"}</TableCell>
                      <TableCell>{row.term_label ?? "—"}</TableCell>
                      <TableCell>{row.student_count}</TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariant(row.status)}>
                          {statusLabel(row.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                        {row.updated_at
                          ? format(new Date(row.updated_at), "dd MMM yyyy HH:mm")
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openPreview(row)}
                            title="Preview"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={!canExportClassReport(row.status)}
                                title="Download"
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => runExport(row, "pdf")}>
                                <FileText className="mr-2 h-4 w-4" /> PDF
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => runExport(row, "excel")}>
                                <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => runExport(row, "word")}>
                                <FileText className="mr-2 h-4 w-4" /> Word
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={!canExportClassReport(row.status)}
                            onClick={() => openPreview(row)}
                            title="Print (open preview, then Print)"
                          >
                            <Printer className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setStudentPicker(row)}
                            title="Select student"
                          >
                            <Users className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <div className="border-t p-3">
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
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!previewReport} onOpenChange={(o) => !o && closePreview()}>
        <DialogContent className="max-w-6xl max-h-[92vh] overflow-y-auto p-2 sm:p-4">
          <DialogHeader className="px-2 pt-2">
            <DialogTitle>
              Preview — {previewReport?.class_name} · {previewReport?.term_label}
            </DialogTitle>
            <DialogDescription>
              Snapshot submitted for this term. Print/download require approval.
            </DialogDescription>
          </DialogHeader>
          {previewReport?.snapshot && (
            <OverallClassReport
              data={previewReport.snapshot}
              schoolName={school?.name ?? school?.school_name}
              status={previewReport.status}
              onSelectStudent={(sid) => {
                closePreview();
                window.location.href = `/teacher/report-cards?mode=student&classId=${previewReport.class_id}&studentId=${sid}`;
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!studentPicker} onOpenChange={(o) => !o && setStudentPicker(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Select student — {studentPicker?.term_label}</DialogTitle>
            <DialogDescription>
              Open an individual report card for a student in {studentPicker?.class_name} (
              {studentPicker?.term_label}).
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-80 space-y-1 overflow-y-auto">
            {(studentPicker?.snapshot?.students ?? []).map((s) => (
              <Button
                key={s.studentId}
                variant="ghost"
                className="w-full justify-between"
                asChild
              >
                <Link
                  to={`/teacher/report-cards?mode=student&classId=${studentPicker!.class_id}&studentId=${s.studentId}`}
                  onClick={() => setStudentPicker(null)}
                >
                  <span>{s.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {s.overallRank != null ? `Pos. ${s.overallRank}` : "—"}
                  </span>
                </Link>
              </Button>
            ))}
            {!studentPicker?.snapshot?.students?.length && (
              <p className="py-6 text-center text-sm text-muted-foreground">No students in snapshot.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default withReportLayout("teacher", TeacherClassReportHistory);
