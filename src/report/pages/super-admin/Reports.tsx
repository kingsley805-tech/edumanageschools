// @ts-nocheck
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/report/portal/page-header";
import { PlatformSchoolFilter } from "@/report/components/platform-school-filter";
import { StatCard } from "@/report/portal/stat-card";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Search, FileText, Clock, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";
import { useClientPagination } from "@/report/hooks/use-client-pagination";
import { TablePagination } from "@/report/portal/table-pagination";
import { TERM_REPORT_ADMIN_LIST_SELECT } from "@/report/lib/term-report";
import { isPendingAdminAction, statusBadgeVariant, statusLabel } from "@/report/lib/report-card-status";
import { usePlatformStats, useSchoolsList } from "@/report/hooks/use-platform-data";
import { logAudit } from "@/report/lib/audit";

function SuperAdminReports() {
  const qc = useQueryClient();
  const [schoolFilter, setSchoolFilter] = useState("all");
  const schoolId = schoolFilter === "all" ? null : schoolFilter;
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [actionRow, setActionRow] = useState<{ id: string; school_id: string; action: "approve" | "reject" } | null>(null);
  const [comment, setComment] = useState("");

  const { data: stats } = usePlatformStats(schoolId);
  const { data: schools } = useSchoolsList();
  const schoolNameById = useMemo(
    () => new Map((schools ?? []).map((s) => [s.id, s.name])),
    [schools],
  );

  const { data: reports, isLoading } = useQuery({
    queryKey: ["platform-reports", schoolFilter, statusFilter],
    queryFn: async () => {
      let q = supabase
        .from("term_report_cards")
        .select(TERM_REPORT_ADMIN_LIST_SELECT)
        .order("updated_at", { ascending: false });
      if (schoolFilter !== "all") q = q.eq("school_id", schoolFilter);
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return (reports ?? []).filter(
      (r) =>
        r.student_name.toLowerCase().includes(q) ||
        (r.class_name ?? "").toLowerCase().includes(q) ||
        (r.term_label ?? "").toLowerCase().includes(q),
    );
  }, [reports, search]);

  const pag = useClientPagination(filtered, { resetKey: `${search}-${statusFilter}` });

  const updateStatus = useMutation({
    mutationFn: async () => {
      if (!actionRow) return;
      const status = actionRow.action === "approve" ? "approved" : "rejected";
      const { error } = await supabase
        .from("term_report_cards")
        .update({
          status,
          admin_comment: comment.trim() || null,
          rejection_reason: actionRow.action === "reject" ? comment.trim() : null,
          published_at: actionRow.action === "approve" ? new Date().toISOString() : null,
        })
        .eq("id", actionRow.id);
      if (error) throw error;
      await logAudit(actionRow.school_id, `report_${status}`, "term_report", actionRow.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform-reports"] });
      qc.invalidateQueries({ queryKey: ["platform-stats"] });
      setActionRow(null);
      setComment("");
      toast.success("Report updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader
        title="Report monitoring"
        description="Review, approve, or return report cards submitted across all schools."
        actions={<PlatformSchoolFilter value={schoolFilter} onChange={setSchoolFilter} />}
      />
      <div className="space-y-6 p-6 md:p-8">
        <div className="grid gap-4 md:grid-cols-4">
          <StatCard label="Total reports" value={stats?.reports ?? 0} icon={FileText} />
          <StatCard label="Pending" value={stats?.pendingReports ?? 0} icon={Clock} tone="text-amber-600" />
          <StatCard label="Approved" value={stats?.approvedReports ?? 0} icon={CheckCircle} tone="text-emerald-600" />
          <StatCard label="Rejected" value={stats?.rejectedReports ?? 0} icon={XCircle} tone="text-destructive" />
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search reports…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="pending_review">Pending</SelectItem>
              <SelectItem value="saved">Saved</SelectItem>
              <SelectItem value="reviewed">Reviewed</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>School</TableHead>
                  <TableHead>Class / Term</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6}>Loading…</TableCell></TableRow>
                ) : pag.slice.length ? pag.slice.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.student_name}</TableCell>
                    <TableCell>{schoolNameById.get(r.school_id) ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.class_name} · {r.term_label ?? r.academic_year ?? "—"}
                    </TableCell>
                    <TableCell><Badge variant={statusBadgeVariant(r.status)}>{statusLabel(r.status)}</Badge></TableCell>
                    <TableCell>{format(new Date(r.updated_at), "MMM d, yyyy")}</TableCell>
                    <TableCell>
                      {isPendingAdminAction(r.status) && (
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" onClick={() => setActionRow({ id: r.id, school_id: r.school_id, action: "approve" })}>Approve</Button>
                          <Button size="sm" variant="ghost" onClick={() => setActionRow({ id: r.id, school_id: r.school_id, action: "reject" })}>Return</Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No reports match filters.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
            <TablePagination page={pag.page} totalPages={pag.totalPages} total={pag.total} from={pag.from} to={pag.to} pageSize={pag.pageSize} pageSizes={pag.pageSizes} onPageChange={pag.setPage} onPageSizeChange={pag.setPageSize} />
          </CardContent>
        </Card>

        <Dialog open={!!actionRow} onOpenChange={(o) => !o && setActionRow(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{actionRow?.action === "approve" ? "Approve report" : "Return for corrections"}</DialogTitle>
            </DialogHeader>
            <Textarea
              placeholder={actionRow?.action === "approve" ? "Optional admin comment…" : "Reason for return (required)…"}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
            />
            <Button
              onClick={() => {
                if (actionRow?.action === "reject" && !comment.trim()) {
                  toast.error("Please provide a reason");
                  return;
                }
                updateStatus.mutate();
              }}
              disabled={updateStatus.isPending}
            >
              Confirm
            </Button>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}

import { withReportLayout } from "@/report/withReportLayout";
export default withReportLayout("super_admin", SuperAdminReports);