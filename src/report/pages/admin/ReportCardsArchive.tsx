import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/report/hooks/use-auth";
import { ActiveTermBanner } from "@/report/portal/active-term-banner";
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
import {
  Archive,
  ArrowLeft,
  Search,
  FilterX,
  ChevronRight,
  Clock,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";
import { EntityCellIdentity, EntityCardItem, getEntityStatusBadge } from "@/components/entities/EntityRow";
import { withReportLayout } from "@/report/withReportLayout";

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

  const activeFilterCount = [
    search.trim() ? 1 : 0,
    yearFilter !== "all",
    termFilter !== "all",
    classFilter !== "all",
    statusFilter !== "all",
  ].filter(Boolean).length;

  const clearFilters = () => {
    setSearch("");
    setYearFilter("all");
    setTermFilter("all");
    setClassFilter("all");
    setStatusFilter("all");
  };

  const pag = useClientPagination(filtered, {
    resetKey: `${search}-${yearFilter}-${termFilter}-${classFilter}-${statusFilter}`,
  });

  return (
    <div className="space-y-6 font-sans">
      {/* ── Standard Metronic Page Toolbar ────────────────────────────── */}
      <div className="flex flex-wrap items-center lg:items-end justify-between gap-4 pb-2 border-b border-border/40">
        <div className="flex min-w-0 flex-col justify-center gap-1.5">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Link to="/admin" className="hover:text-primary transition-colors">
              Dashboard
            </Link>
            <ChevronRight className="size-3 text-muted-foreground/60" />
            <Link to="/admin/report-cards" className="hover:text-primary transition-colors">
              Report Cards
            </Link>
            <ChevronRight className="size-3 text-muted-foreground/60" />
            <span className="text-foreground font-semibold">Archive</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Report Card Archive
            </h1>
            <span className="kt-badge kt-badge-outline kt-badge-info gap-1 py-1 px-2.5 text-xs font-semibold">
              <Archive className="size-3.5" />
              Permanent Storage
            </span>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Permanent, tamper-proof repository of all generated and published student report cards across all academic terms.
          </p>
        </div>

        {/* Action Button */}
        <div className="flex items-center gap-2.5">
          <Button asChild variant="outline" size="sm" className="h-9 gap-1.5 text-xs font-medium border-border">
            <Link to="/admin/report-cards">
              <ArrowLeft className="size-3.5 text-muted-foreground" />
              Review Queue
            </Link>
          </Button>
        </div>
      </div>

      {/* Active Term Notification */}
      <ActiveTermBanner />

      {/* ── Filter Toolbar ────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2.5">
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
            <SelectValue placeholder="Academic Year" />
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

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 h-9 text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">All statuses</SelectItem>
            <SelectItem value="approved" className="text-xs">Approved</SelectItem>
            <SelectItem value="published" className="text-xs">Published</SelectItem>
            <SelectItem value="pending_review" className="text-xs">Pending</SelectItem>
            <SelectItem value="rejected" className="text-xs">Returned</SelectItem>
          </SelectContent>
        </Select>

        {activeFilterCount > 0 && (
          <Button variant="ghost" size="sm" className="h-9 gap-1.5 text-xs text-muted-foreground hover:text-foreground" onClick={clearFilters}>
            <FilterX className="size-3.5" />
            Clear ({activeFilterCount})
          </Button>
        )}

        <span className="ml-auto text-xs text-muted-foreground font-mono">
          {pag.total} {pag.total === 1 ? "record" : "records"} archived
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
                <TableHead className="min-w-[120px]">Academic Year</TableHead>
                <TableHead className="min-w-[130px]">Term</TableHead>
                <TableHead className="min-w-[110px]">Status</TableHead>
                <TableHead className="min-w-[110px]">Last Updated</TableHead>
                <TableHead className="min-w-[100px]">Parent Sent</TableHead>
                <TableHead className="text-right min-w-[120px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-12 text-center text-muted-foreground text-xs">
                    Loading archived reports…
                  </TableCell>
                </TableRow>
              ) : pag.slice.length ? (
                pag.slice.map((r) => {
                  const statusBadge = getEntityStatusBadge(r.status);
                  return (
                    <TableRow key={r.id} className="hover:bg-muted/30 transition-colors">
                      {/* Entity Identity */}
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

                      {/* Year */}
                      <TableCell className="text-xs font-mono text-muted-foreground">
                        {r.academic_year || "—"}
                      </TableCell>

                      {/* Term */}
                      <TableCell className="text-xs font-medium text-foreground">
                        {r.term_label || "—"}
                      </TableCell>

                      {/* Status */}
                      <TableCell>
                        <Badge variant={statusBadge.variant} className={statusBadge.className}>
                          <span className={`mr-1.5 size-1.5 rounded-full ${statusBadge.dotColor}`} />
                          {statusLabel(r.status)}
                        </Badge>
                      </TableCell>

                      {/* Updated At */}
                      <TableCell className="text-xs text-muted-foreground">
                        {r.updated_at ? format(new Date(r.updated_at), "MMM d, yyyy") : "—"}
                      </TableCell>

                      {/* Parent Sent Status */}
                      <TableCell>
                        {r.status === "published" ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                            <ShieldCheck className="size-3.5" /> Sent
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <Button asChild size="sm" variant="outline" className="h-8 px-2.5 text-xs">
                            <Link to={`/admin/report-cards/view?id=${encodeURIComponent(r.id)}`}>
                              View
                            </Link>
                          </Button>
                          <Button asChild size="sm" variant="ghost" className="size-8 p-0" title="Version History">
                            <Link to={`/admin/report-cards/versions?id=${encodeURIComponent(r.id)}`}>
                              <Clock className="size-3.5" />
                            </Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className="py-12 text-center text-muted-foreground text-xs">
                    {activeFilterCount > 0 ? (
                      <div className="space-y-2">
                        <p>No archived reports match your current filters.</p>
                        <Button variant="outline" size="sm" onClick={clearFilters} className="text-xs">
                          Clear Filters
                        </Button>
                      </div>
                    ) : (
                      "No archived reports found."
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
              ]}
              metrics={[
                { label: "Archived Status", value: r.status === "published" ? "Sent to Parent" : "Stored" },
                { label: "Date Saved", value: r.updated_at ? format(new Date(r.updated_at), "MMM d, yyyy") : "—" },
              ]}
              primaryAction={{
                label: "View Report",
                to: `/admin/report-cards/view?id=${encodeURIComponent(r.id)}`,
              }}
              secondaryAction={{
                label: "History",
                to: `/admin/report-cards/versions?id=${encodeURIComponent(r.id)}`,
              }}
            />
          ))}

          {!pag.total && !isLoading && (
            <div className="py-10 text-center text-xs text-muted-foreground">
              {activeFilterCount > 0 ? (
                <div className="space-y-2">
                  <p>No archived reports match your current filters.</p>
                  <Button variant="outline" size="sm" onClick={clearFilters} className="text-xs">
                    Clear Filters
                  </Button>
                </div>
              ) : (
                "No archived reports found."
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

export default withReportLayout("admin", ReportArchive);
