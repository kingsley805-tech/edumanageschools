import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle, Eye, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { withReportLayout } from "@/report/withReportLayout";
import { PageHeader } from "@/report/portal/page-header";
import { useAuth } from "@/report/hooks/use-auth";
import { useSchool } from "@/report/hooks/use-school-data";
import {
  fetchTermClassReportById,
  updateTermClassReportStatus,
} from "@/report/lib/term-class-report";
import { notifyTeacherClassReportReviewed } from "@/report/lib/report-card-notify";
import {
  canAdminEdit,
  isPendingAdminAction,
  statusBadgeVariant,
  statusLabel,
} from "@/report/lib/report-card-status";
import { OverallClassReport } from "@/report/components/overall-class-report";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function AdminClassReportView() {
  const [searchParams] = useSearchParams();
  const id = searchParams.get("id") ?? "";
  const { user } = useAuth();
  const { data: school } = useSchool();
  const qc = useQueryClient();
  const [adminComment, setAdminComment] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [dialog, setDialog] = useState<"reviewed" | "approve" | "reject" | null>(null);

  const { data: report, isLoading, refetch } = useQuery({
    queryKey: ["term-class-report", id],
    enabled: !!id,
    queryFn: () => fetchTermClassReportById(id),
  });

  useEffect(() => {
    if (report) setAdminComment(report.admin_comment ?? "");
  }, [report?.id, report?.admin_comment]);

  const updateStatus = useMutation({
    mutationFn: async (opts: {
      status: "reviewed" | "approved" | "rejected";
      note: string;
    }) => {
      if (!report || !user?.id) throw new Error("Missing report");
      return updateTermClassReportStatus({
        report,
        status: opts.status,
        actorId: user.id,
        adminComment,
        rejectionReason: opts.status === "rejected" ? rejectReason : null,
        note: opts.note,
      });
    },
    onSuccess: async (row, vars) => {
      if (row.teacher_id) {
        await notifyTeacherClassReportReviewed({
          teacherId: row.teacher_id,
          className: row.class_name ?? "Class",
          status: vars.status,
          reportId: row.id,
          note: vars.status === "rejected" ? rejectReason : adminComment || undefined,
        });
      }
      qc.invalidateQueries({ queryKey: ["admin-term-class-reports"] });
      qc.invalidateQueries({ queryKey: ["term-class-reports-history"] });
      await refetch();
      toast.success(
        vars.status === "approved"
          ? "Class report approved — teacher can now print/download"
          : vars.status === "rejected"
            ? "Class report returned to teacher"
            : "Class report marked as reviewed",
      );
      setDialog(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !report) {
    return (
      <p className="p-8 text-muted-foreground">{isLoading ? "Loading…" : "Class report not found"}</p>
    );
  }

  const editable = canAdminEdit(report.status);

  return (
    <>
      <div className="no-print border-b bg-card px-4 py-4 sm:px-6 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/admin/report-cards">
              <ArrowLeft className="mr-1 h-4 w-4" /> Queue
            </Link>
          </Button>
          <Badge variant={statusBadgeVariant(report.status)}>{statusLabel(report.status)}</Badge>
          <span className="text-sm text-muted-foreground">
            {report.class_name} · {report.term_label}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {editable && isPendingAdminAction(report.status) && (
            <>
              <Button size="sm" variant="outline" onClick={() => setDialog("reviewed")}>
                <Eye className="mr-1 h-4 w-4" /> Mark reviewed
              </Button>
              <Button size="sm" onClick={() => setDialog("approve")}>
                <CheckCircle className="mr-1 h-4 w-4" /> Approve
              </Button>
              <Button size="sm" variant="destructive" onClick={() => setDialog("reject")}>
                <XCircle className="mr-1 h-4 w-4" /> Reject
              </Button>
            </>
          )}
          {editable && report.status === "reviewed" && (
            <>
              <Button size="sm" onClick={() => setDialog("approve")}>
                <CheckCircle className="mr-1 h-4 w-4" /> Approve
              </Button>
              <Button size="sm" variant="destructive" onClick={() => setDialog("reject")}>
                <XCircle className="mr-1 h-4 w-4" /> Reject
              </Button>
            </>
          )}
        </div>
      </div>

      <PageHeader
        title="Overall Class Report review"
        description="Review the class performance & position snapshot submitted by the teacher."
      />

      <div className="space-y-4 p-4 md:p-6">
        <div className="no-print grid gap-3 max-w-xl">
          <div>
            <Label>Admin comment</Label>
            <Textarea
              value={adminComment}
              onChange={(e) => setAdminComment(e.target.value)}
              disabled={!editable}
              rows={2}
              placeholder="Optional note for the teacher"
            />
          </div>
        </div>

        <OverallClassReport
          data={report.snapshot}
          schoolName={school?.name ?? school?.school_name}
          status={report.status}
          allowExportOverride
        />
      </div>

      <AlertDialog open={dialog === "reviewed"} onOpenChange={(o) => !o && setDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark as reviewed?</AlertDialogTitle>
            <AlertDialogDescription>
              The teacher will be notified that you have reviewed this class report.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={updateStatus.isPending}
              onClick={() => updateStatus.mutate({ status: "reviewed", note: "Admin reviewed" })}
            >
              {updateStatus.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={dialog === "approve"} onOpenChange={(o) => !o && setDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve class report?</AlertDialogTitle>
            <AlertDialogDescription>
              The teacher will be able to print and download (Excel, PDF, Word) after approval.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={updateStatus.isPending}
              onClick={() => updateStatus.mutate({ status: "approved", note: "Admin approved" })}
            >
              {updateStatus.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Approve"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={dialog === "reject"} onOpenChange={(o) => !o && setDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Return class report?</AlertDialogTitle>
            <AlertDialogDescription>
              The teacher must fix and resubmit before print/download unlocks.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <Label>Reason</Label>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="What should the teacher change?"
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={updateStatus.isPending || !rejectReason.trim()}
              onClick={() =>
                updateStatus.mutate({ status: "rejected", note: "Admin rejected class report" })
              }
            >
              {updateStatus.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Return"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default withReportLayout("admin", AdminClassReportView);
