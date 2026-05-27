import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/report/portal/page-header";
import { Button } from "@/components/ui/button";
import { ShepherdReportCard } from "@/report/components/shepherd-report-card";
import { useGradingFormat } from "@/report/hooks/use-school-data";
import { fetchTermReportById, rowToFormWithTermDates, saveTeacherReportEdits } from "@/report/lib/term-report";
import { teacherReportEditByDefault } from "@/report/lib/report-card-status";
import { ArrowLeft, Loader2, Pencil, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { deliverReportToParents } from "@/report/lib/report-delivery";
import { ReportMetaPanel } from "@/report/components/report-meta-panel";
import { useAuth } from "@/report/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useReportSignatures } from "@/report/hooks/use-report-signatures";

function searchWantsEdit(edit: string | null | undefined) {
  return edit === "1" || edit === "true";
}

function ViewReport() {
  const [searchParams] = useSearchParams();
  const id = searchParams.get("id") ?? "";
  const editSearch = searchParams.get("edit");
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const gradingFormat = useGradingFormat();
  const [form, setForm] = useState<Awaited<ReturnType<typeof rowToFormWithTermDates>> | null>(null);
  const [forwarding, setForwarding] = useState(false);
  const [isEditing, setIsEditing] = useState(() => searchWantsEdit(editSearch));

  const { data: report, isLoading, refetch } = useQuery({
    queryKey: ["term-report", id],
    enabled: !!id,
    queryFn: async () => {
      const row = await fetchTermReportById(id);
      setForm(await rowToFormWithTermDates(row, gradingFormat));
      return row;
    },
  });

  useEffect(() => {
    if (searchWantsEdit(editSearch)) setIsEditing(true);
  }, [editSearch]);

  useEffect(() => {
    if (!report) return;
    if (teacherReportEditByDefault(report.status)) setIsEditing(true);
  }, [report?.status]);

  const { teacherSignatureUrl, headSignatureUrl } = useReportSignatures({
    schoolId: profile?.school_id ?? report?.school_id ?? "",
    teacherId: report?.teacher_id ?? user?.id,
    enabled: !!report,
  });

  const saveEdits = useMutation({
    mutationFn: async () => {
      if (!report || !form || !user?.id) throw new Error("Missing report data");
      await saveTeacherReportEdits(report, form, user.id);
    },
    onSuccess: () => {
      toast.success("Report saved");
      qc.invalidateQueries({ queryKey: ["term-report", id] });
      qc.invalidateQueries({ queryKey: ["term-reports-history"] });
      refetch();
    },
    onError: (e: Error) => toast.error(e.message || "Failed to save"),
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

  if (isLoading || !report || !form) {
    return <p className="p-8">{isLoading ? "Loading…" : "Not found"}</p>;
  }

  const canForward = report.status === "approved" || report.status === "published";

  const handleForward = async () => {
    setForwarding(true);
    try {
      const n = await deliverReportToParents({
        studentId: report.student_id,
        studentName: report.student_name,
        className: report.class_name,
        termLabel: report.term_label,
        reportId: report.id,
        senderId: user!.id,
        senderRole: "teacher",
      });
      refetch();
      if (n === 0) toast.warning("No parents linked to this student yet.");
      else toast.success(`Sent to ${n} parent${n === 1 ? "" : "s"}.`);
    } catch (e) {
      toast.error((e as Error).message || "Failed to forward report.");
    } finally {
      setForwarding(false);
    }
  };

  return (
    <>
      <div className="no-print border-b bg-card px-6 py-4 flex flex-wrap items-center justify-between gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link to="/teacher/report-cards/history"><ArrowLeft className="mr-1 h-4 w-4" /> History</Link>
        </Button>
        <div className="flex flex-wrap gap-2">
          {!isEditing && (
            <Button size="sm" onClick={() => setIsEditing(true)}>
              <Pencil className="mr-1 h-4 w-4" />
              Edit report
            </Button>
          )}
          {isEditing && (
            <Button
              size="sm"
              onClick={() => saveEdits.mutate()}
              disabled={saveEdits.isPending}
            >
              {saveEdits.isPending ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Pencil className="mr-1 h-4 w-4" />
              )}
              Save changes
            </Button>
          )}
          <Button
            size="sm"
            onClick={handleForward}
            disabled={!canForward || forwarding}
            title={canForward ? "Notify linked parents" : "Available after admin approval"}
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
      <PageHeader title={`${report.student_name}`} description={`${report.class_name} · ${report.term_label}`} />
      {isEditing ? (
        <p className="no-print mx-6 mb-2 text-sm text-muted-foreground">
          Editing mode — changes are saved without changing approval status. Manage your signature under{" "}
          <Link to="/teacher/signatures" className="text-primary underline">
            Signatures
          </Link>
          .
        </p>
      ) : (
        <p className="no-print mx-6 mb-2 text-sm text-muted-foreground">
          Viewing report. Click <strong>Edit report</strong> to change remarks, dates, or other fields (including after admin review).
        </p>
      )}
      <ReportMetaPanel
        className="mx-6 mb-4"
        report={report}
        sentBy={
          sentByProfile?.full_name
            ? { name: sentByProfile.full_name, role: "teacher" }
            : undefined
        }
      />
      <ShepherdReportCard
        data={form}
        academicYear={form.academicYear || report.academic_year || undefined}
        editable={isEditing}
        onChange={setForm}
        onSave={() => saveEdits.mutate()}
        saving={saveEdits.isPending}
        status={report.status}
        adminComment={report.admin_comment}
        rejectionReason={report.rejection_reason}
        schoolId={report.school_id}
        teacherSignatureUrl={teacherSignatureUrl}
        headSignatureUrl={headSignatureUrl}
        showToolbar
        toolbarTitle={`${report.student_name} — ${report.term_label}`}
      />
    </>
  );
}

import { withReportLayout } from "@/report/withReportLayout";
export default withReportLayout("teacher", ViewReport);
