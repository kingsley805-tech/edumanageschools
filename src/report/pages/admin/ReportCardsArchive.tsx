import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/report/hooks/use-auth";
import { PageHeader } from "@/report/portal/page-header";
import { ActiveTermBanner } from "@/report/portal/active-term-banner";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { statusBadgeVariant, statusLabel } from "@/report/lib/report-card-status";
import { fetchSchoolTerms, formatTermLabel } from "@/report/lib/terms";
import { TERM_REPORT_ARCHIVE_LIST_SELECT } from "@/report/lib/term-report";
import { useClientPagination } from "@/report/hooks/use-client-pagination";
import { TablePagination } from "@/report/portal/table-pagination";
import { Archive, ArrowLeft } from "lucide-react";

function ReportArchive() {
  const { profile } = useAuth();
  const schoolId = profile?.school_id ?? "";
  const [search, setSearch] = useState("");
  const [yearFilter, setYearFilter] = useState("all");
  const [termFilter, setTermFilter] = useState("all");
  const [classFilter, setClassFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: terms } = useQuery({
    queryKey: ["school-terms", schoolId],
    enabled: !!schoolId,
    queryFn: () => fetchSchoolTerms(schoolId),
  });

  const { data: reports, isLoading } = useQuery({
    queryKey: ["admin-report-archive", schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("term_report_cards")
        .select(`${TERM_REPORT_ARCHIVE_LIST_SELECT}, students(admission_number)`)
        .eq("school_id", schoolId)
        .neq("status", "draft")
        .order("academic_year", { ascending: false })
        .order("term_label", { ascending: false })
        .order("class_name", { ascending: true })
        .order("student_name", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        ...r,
        admission_number:
          (r.students as { admission_number: string | null } | null)?.admission_number ?? null,
      }));
    },
  });

  const years = useMemo(() => {
    const set = new Set<string>();
    for (const r of reports ?? []) if (r.academic_year) set.add(r.academic_year);
    return [...set].sort().reverse();
  }, [reports]);

  const classes = useMemo(() => {
    const set = new Set<string>();
    for (const r of reports ?? []) if (r.class_name) set.add(r.class_name);
    return [...set].sort();
  }, [reports]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (reports ?? []).filter((r) => {
      const matchSearch =
        !q ||
        r.student_name.toLowerCase().includes(q) ||
        (r.class_name ?? "").toLowerCase().includes(q) ||
        (r.admission_number ?? "").toLowerCase().includes(q) ||
        (r.term_label ?? "").toLowerCase().includes(q);
      const matchYear = yearFilter === "all" || r.academic_year === yearFilter;
      const matchTerm =
        termFilter === "all" || r.term_id === termFilter || r.term_label === termFilter;
      const matchClass = classFilter === "all" || r.class_name === classFilter;
      const matchStatus = statusFilter === "all" || r.status === statusFilter;
      return matchSearch && matchYear && matchTerm && matchClass && matchStatus;
    });
  }, [reports, search, yearFilter, termFilter, classFilter, statusFilter]);

  const pag = useClientPagination(filtered, {
    resetKey: `${search}-${yearFilter}-${termFilter}-${classFilter}-${statusFilter}`,
  });

  return (
    <>
      <PageHeader
        title="Report archive"
        description="Permanent history of all student reports by year, term, class, and student. Records are never overwritten."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/admin/report-cards">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Review queue
            </Link>
          </Button>
        }
      />
      <div className="space-y-6 p-6 md:p-8">
        <ActiveTermBanner />
        <div className="flex flex-wrap gap-3">
          <Input
            placeholder="Search name, admission #, class…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
          <Select value={yearFilter} onValueChange={setYearFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Academic year" />
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
            <SelectTrigger className="w-48">
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
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="pending_review">Pending</SelectItem>
              <SelectItem value="rejected">Returned</SelectItem>
            </SelectContent>
          </Select>
        </div>

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
                    <TableHead>Status</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead>Sent</TableHead>
                    <TableHead className="text-right">Open</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="py-10 text-center text-muted-foreground">
                        Loading archive…
                      </TableCell>
                    </TableRow>
                  ) : pag.slice.length ? (
                    pag.slice.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.student_name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {r.admission_number ?? "—"}
                        </TableCell>
                        <TableCell>{r.class_name}</TableCell>
                        <TableCell>{r.academic_year ?? "—"}</TableCell>
                        <TableCell>{r.term_label ?? "—"}</TableCell>
                        <TableCell>
                          <Badge variant={statusBadgeVariant(r.status)}>{statusLabel(r.status)}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(r.updated_at), "PP")}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {r.status === "published" ? "Sent" : "—"}
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button asChild size="sm" variant="outline">
                            <Link to={`/admin/report-cards/view?id=${encodeURIComponent(r.id)}`}>
                              View
                            </Link>
                          </Button>
                          <Button asChild size="sm" variant="ghost">
                            <Link to={`/admin/report-cards/versions?id=${encodeURIComponent(r.id)}`}>
                              <Archive className="h-3.5 w-3.5" />
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={9} className="py-10 text-center text-muted-foreground">
                        No archived reports match your filters.
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
      </div>
    </>
  );
}

import { withReportLayout } from "@/report/withReportLayout";
export default withReportLayout("admin", ReportArchive);
