import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/report/hooks/use-auth";
import { PageHeader } from "@/report/portal/page-header";
import { ActiveTermBanner } from "@/report/portal/active-term-banner";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { statusBadgeVariant, statusLabel } from "@/report/lib/report-card-status";
import { totalFromSubjects, fmtScore, formatRankLabel, type SubjectRow } from "@/report/lib/shepherd-grading";
import { useClientPagination } from "@/report/hooks/use-client-pagination";
import { TablePagination } from "@/report/portal/table-pagination";
import { fetchSchoolTerms, formatTermLabel } from "@/report/lib/terms";
import { TERM_REPORT_HISTORY_LIST_SELECT } from "@/report/lib/term-report";
import { useMemo, useState } from "react";

function TeacherReportHistory() {
  const { user, profile } = useAuth();
  const schoolId = profile?.school_id ?? "";
  const [search, setSearch] = useState("");
  const [yearFilter, setYearFilter] = useState("all");
  const [termFilter, setTermFilter] = useState("all");
  const [classFilter, setClassFilter] = useState("all");

  const { data: terms } = useQuery({
    queryKey: ["school-terms", schoolId],
    enabled: !!schoolId,
    queryFn: () => fetchSchoolTerms(schoolId),
  });

  const { data: reports } = useQuery({
    queryKey: ["term-reports-history", user?.id, schoolId],
    enabled: !!user?.id && !!schoolId,
    queryFn: async () => {
      const { data: assignments } = await supabase
        .from("class_subjects")
        .select("class_id, classes(name)")
        .eq("teacher_id", user!.id);
      const classIds = [...new Set((assignments ?? []).map((a) => a.class_id).filter(Boolean))];
      if (!classIds.length) return [];

      const { data, error } = await supabase
        .from("term_report_cards")
        .select(`${TERM_REPORT_HISTORY_LIST_SELECT}, students(admission_number)`)
        .eq("teacher_id", user!.id)
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

  const pag = useClientPagination(filtered, {
    resetKey: `${search}-${yearFilter}-${termFilter}-${classFilter}`,
  });

  return (
    <>
      <PageHeader
        title="Report history"
        description="Current and past term reports for your assigned classes only."
      />
      <div className="p-6 md:p-8 space-y-6">
        <ActiveTermBanner />
        <div className="flex flex-wrap gap-3">
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
                    <TableHead>Total</TableHead>
                    <TableHead>Position</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Sent</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
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
                        <TableCell>{fmtScore(r.displayTotal)}</TableCell>
                        <TableCell>{formatRankLabel(r.class_position)}</TableCell>
                        <TableCell>
                          <Badge variant={statusBadgeVariant(r.status)}>
                            {statusLabel(r.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {r.status === "published"
                            ? "Sent"
                            : r.status === "approved"
                              ? "Ready"
                              : "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(r.updated_at), "PP")}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button asChild size="sm" variant="outline">
                              <Link to={`/teacher/report-cards/view?id=${encodeURIComponent(r.id)}`}>
                                View
                              </Link>
                            </Button>
                            <Button asChild size="sm">
                              <Link to={`/teacher/report-cards/view?id=${encodeURIComponent(r.id)}&edit=1`}>
                                Edit report
                              </Link>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                        No reports submitted yet
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
export default withReportLayout("teacher", TeacherReportHistory);
