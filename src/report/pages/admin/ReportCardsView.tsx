// @ts-nocheck
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import { useReportCardAutosave } from "@/report/hooks/use-report-card-autosave";
import { PageHeader } from "@/report/portal/page-header";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ShepherdReportCard } from "@/report/components/shepherd-report-card";
import { useGradingFormat } from "@/report/hooks/use-school-data";
import { fetchTermReportById, rowToFormWithTermDates } from "@/report/lib/term-report";
import { useAdminReportActions } from "@/report/hooks/use-term-report-card";
import { useAuth } from "@/report/hooks/use-auth";
import { canAdminEdit, statusBadgeVariant, statusLabel } from "@/report/lib/report-card-status";
import type { ReportFormData } from "@/report/lib/shepherd-grading";
import { ReportVersionTimeline } from "@/report/components/report-version-history";
import { ArrowLeft, CheckCircle, Eye, History, XCircle, Send, Loader2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { toast } from "sonner";
import { deliverReportToParents } from "@/report/lib/report-delivery";
import { ReportMetaPanel } from "@/report/components/report-meta-panel";
import { supabase } from "@/integrations/supabase/client";
import { useReportSignatures } from "@/report/hooks/use-report-signatures";
import { useSchool } from "@/report/hooks/use-school-data";

function AdminViewReport() {
  const [searchParams] = useSearchParams();
  const id = searchParams.get("id") ?? "";
  const { user } = useAuth();
  const { data: school } = useSchool();
  const gradingFormat = useGradingFormat();
  const [form, setForm] = useState<ReportFormData | null>(null);
  const [adminComment, setAdminComment] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [dialog, setDialog] = useState<"reviewed" | "approve" | "reject" | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [timelineVersion, setTimelineVersion] = useState<number | null>(null);
  const [forwarding, setForwarding] = useState(false);


  const { data: report, isLoading, refetch } = useQuery({
    queryKey: ["term-report", id],
    enabled: !!id,
    queryFn: async () => {
      const row = await fetchTermReportById(id);
      setForm(await rowToFormWithTermDates(row, gradingFormat));
      setAdminComment(row.admin_comment ?? "");
      return row;
    },
  });

  const { data: sentByProfile } = useQuery({
    queryKey: ["report-sender", report?.sent_to_parents_by],
    enabled: !!report?.sent_to_parents_by,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", report!.sent_to_parents_by!)
        .single();
      return data;
    },
  });

  const { updateStatus } = useAdminReportActions(report, user?.id ?? "");

  const formRef = useRef<ReportFormData | null>(null);
  const adminCommentRef = useRef(adminComment);
  formRef.current = form;
  adminCommentRef.current = adminComment;

  const autosave = useReportCardAutosave({
    enabled: !!report && !!form && canAdminEdit(report.status),
    onSave: async () => {
      if (!report || !formRef.current) return;
      await updateStatus.mutateAsync({
        status: report.status,
        form: formRef.current,
        adminComment: adminCommentRef.current,
        note: "Auto-saved",
        skipVersion: true,
      });
    },
  });

  const onFormChange = useCallback(
    (next: ReportFormData) => {
      formRef.current = next;
      setForm(next);
      autosave.scheduleAutosave();
    },
    [autosave.scheduleAutosave],
  );

  const onAdminCommentChange = useCallback(
    (value: string) => {
      adminCommentRef.current = value;
      setAdminComment(value);
      autosave.scheduleAutosave();
    },
    [autosave.scheduleAutosave],
  );

  const { teacherSignatureUrl, headSignatureUrl } = useReportSignatures({
    schoolId: school?.id ?? report?.school_id ?? "",
    teacherId: report?.teacher_id,
    enabled: !!report,
  });

  if (isLoading || !report || !form) {
    return <p className="p-8">{isLoading ? "Loading report…" : "Report not found"}</p>;
  }

  const editable = canAdminEdit(report.status);

  const saveEdits = async () => {
    await updateStatus.mutateAsync({
      status: report.status,
      form: formRef.current ?? form,
      adminComment: adminCommentRef.current,
      note: "Admin saved edits",
    });
    toast.success("Report updated");
    refetch();
  };

  return (
    <>
      <div className="no-print border-b bg-card px-6 py-4 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/admin/report-cards"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link>
          </Button>
          <Badge variant={statusBadgeVariant(report.status)}>{statusLabel(report.status)}</Badge>
          {report && (
            <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm">
                  <History className="mr-1 h-4 w-4" />
                  Version history
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
                <SheetHeader className="px-4 py-4 border-b">
                  <SheetTitle>Version history</SheetTitle>
                </SheetHeader>
                <ReportVersionTimeline
                  reportId={id}
                  currentVersion={report.version ?? undefined}
                  selectedVersion={timelineVersion}
                  onSelectVersion={setTimelineVersion}
                  compact
                />
                <div className="border-t p-4 mt-auto">
                  <Button asChild className="w-full" variant="secondary">
                    <Link to={`/admin/report-cards/versions?id=${encodeURIComponent(id)}`} onClick={() => setHistoryOpen(false)}>
                      Open full viewer
                    </Link>
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          )}
          <Button asChild variant="outline" size="sm">
            <Link to={`/admin/report-cards/versions?id=${encodeURIComponent(id)}`}>
              <History className="mr-1 h-4 w-4" />
              Full history
            </Link>
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>Admin comments / feedback</Label>
            <Textarea
              rows={3}
              value={adminComment}
              onChange={(e) => onAdminCommentChange(e.target.value)}
              placeholder="Notes for the teacher before approval…"
            />
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <Button variant="outline" size="sm" onClick={saveEdits} disabled={updateStatus.isPending}>
              Save edits
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setDialog("reviewed")}>
              <Eye className="mr-1 h-4 w-4" /> Mark reviewed
            </Button>
            <Button size="sm" onClick={() => setDialog("approve")}>
              <CheckCircle className="mr-1 h-4 w-4" /> Approve
            </Button>
            <Button variant="destructive" size="sm" onClick={() => setDialog("reject")}>
              <XCircle className="mr-1 h-4 w-4" /> Reject
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={
                forwarding ||
                !(report.status === "approved" || report.status === "published")
              }
              tooltip={
                report.status === "approved" || report.status === "published"
                  ? "Notify linked parents"
                  : "Approve the report first to forward to parents"
              }
              onClick={async () => {
                setForwarding(true);
                try {
                  const n = await deliverReportToParents({
                    studentId: report.student_id,
                    studentName: report.student_name,
                    className: report.class_name,
                    termLabel: report.term_label,
                    reportId: report.id,
                    senderId: user!.id,
                    senderRole: "admin",
                  });
                  refetch();
                  if (n === 0) toast.warning("No parents linked to this student yet.");
                  else toast.success(`Sent to ${n} parent${n === 1 ? "" : "s"}.`);
                } catch (e) {
                  toast.error((e as Error).message || "Failed to forward report.");
                } finally {
                  setForwarding(false);
                }
              }}
            >
              {forwarding ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-1 h-4 w-4" />
              )}
              Forward to parents
            </Button>
          </div>
        </div>
      </div>

      <PageHeader
        title={`${report.student_name} — ${report.class_name}`}
        description={`${report.term_label} · Teacher submission`}
      />

      <ReportMetaPanel
        className="mx-6 mb-4"
        report={report}
        sentBy={
          sentByProfile?.full_name
            ? { name: sentByProfile.full_name, role: "admin" }
            : undefined
        }
      />

      <ShepherdReportCard
        data={form}
        academicYear={form.academicYear}
        editable={editable}
        onChange={onFormChange}
        onSave={saveEdits}
        saving={updateStatus.isPending}
        autosavePending={autosave.autosavePending}
        lastSaved={autosave.lastSaved}
        status={report.status}
        adminComment={adminComment}
        rejectionReason={report.rejection_reason}
        schoolId={report.school_id}
        teacherSignatureUrl={teacherSignatureUrl}
        headSignatureUrl={headSignatureUrl}
        allowHeadSignEdit={editable}
        showToolbar
        toolbarTitle={`Admin review — ${report.student_name}`}
      />

      <AlertDialog open={dialog === "reviewed"} onOpenChange={(o) => !o && setDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark as reviewed?</AlertDialogTitle>
            <AlertDialogDescription>Teacher will be notified. Report stays editable until approved.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={async () => {
              await updateStatus.mutateAsync({ status: "reviewed", form, adminComment, note: "Marked reviewed" });
              toast.success("Marked as reviewed");
              setDialog(null);
              refetch();
            }}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={dialog === "approve"} onOpenChange={(o) => !o && setDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve report card?</AlertDialogTitle>
            <AlertDialogDescription>
              This publishes the report to parents and students. PDF/print remain available.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={async () => {
              await updateStatus.mutateAsync({ status: "approved", form, adminComment, note: "Approved" });
              toast.success("Report approved and published");
              setDialog(null);
              refetch();
            }}>Approve</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={dialog === "reject"} onOpenChange={(o) => !o && setDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Return report to teacher?</AlertDialogTitle>
            <AlertDialogDescription>Teacher can edit and resubmit.</AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            className="mt-2"
            rows={3}
            placeholder="Reason for rejection…"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={async () => {
              if (!rejectReason.trim()) {
                toast.error("Please provide a reason");
                return;
              }
              await updateStatus.mutateAsync({
                status: "rejected",
                form,
                adminComment,
                rejectionReason: rejectReason,
                note: "Rejected",
              });
              toast.success("Report returned to teacher");
              setDialog(null);
              refetch();
            }}>Return to teacher</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

import { withReportLayout } from "@/report/withReportLayout";
export default withReportLayout("admin", AdminViewReport);