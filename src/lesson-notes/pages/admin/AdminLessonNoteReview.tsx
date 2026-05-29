// @ts-nocheck
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, Download, Printer, RotateCcw, XCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { getLessonNote, listLessonNoteAttachments, reviewLessonNote } from "@/lesson-notes/lib/api";
import { downloadLessonNotePdf } from "@/lesson-notes/lib/exportPdf";
import { printLessonNote } from "@/lesson-notes/lib/printLessonNote";
import { LessonNoteHistoryPanel } from "@/lesson-notes/components/LessonNoteHistoryPanel";
import { LessonNoteStatusBadge } from "@/lesson-notes/components/LessonNoteStatusBadge";
import { CONTENT_FIELD_LABELS, DAYS_OF_WEEK } from "@/lesson-notes/lib/types";

export default function AdminLessonNoteReview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [note, setNote] = useState(null);
  const [feedback, setFeedback] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [schoolName, setSchoolName] = useState("School");
  const [reviewerName, setReviewerName] = useState("Admin");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const n = await getLessonNote(id);
    if (!n) {
      toast.error("Not found");
      navigate("/admin/lesson-notes");
      return;
    }
    setNote(n);
    setFeedback(n.admin_feedback ?? "");
    setAttachments(await listLessonNoteAttachments(id));
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, schools(name)")
        .eq("id", user.id)
        .maybeSingle();
      setReviewerName(profile?.full_name ?? "Admin");
      setSchoolName((profile?.schools as { name?: string })?.name ?? "School");
    }
  }, [id, navigate, user]);

  useEffect(() => {
    void load();
  }, [load]);

  const runReview = async (status: "approved" | "rejected" | "needs_correction") => {
    if (!id) return;
    if ((status === "rejected" || status === "needs_correction") && !feedback.trim()) {
      toast.error("Please add feedback for the teacher");
      return;
    }
    setSubmitting(true);
    try {
      await reviewLessonNote({
        noteId: id,
        status,
        feedback: feedback.trim(),
        reviewerName,
      });
      toast.success(`Marked as ${status.replace(/_/g, " ")}`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Review failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (!note) {
    return (
      <DashboardLayout role="admin">
        <div className="py-12 text-center text-muted-foreground">Loading…</div>
      </DashboardLayout>
    );
  }

  const dayLabel = DAYS_OF_WEEK.find((d) => d.value === note.day_of_week)?.label ?? note.day_of_week;
  const canReview = note.status === "pending_review";

  return (
    <DashboardLayout role="admin">
    <div className="space-y-6 max-w-5xl">
      <Button variant="ghost" size="sm" asChild>
        <Link to="/admin/lesson-notes">
          <ArrowLeft className="mr-1 h-4 w-4" />
          All lesson notes
        </Link>
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-2xl font-bold">{note.topic}</h1>
            <LessonNoteStatusBadge status={note.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {note.teacher_name} · {note.classes?.name} · {note.subjects?.name} · Week {note.week_number} · {dayLabel}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => printLessonNote()}>
            <Printer className="mr-1 h-4 w-4" />
            Print
          </Button>
          <Button variant="outline" size="sm" onClick={() => downloadLessonNotePdf(note, schoolName)}>
            <Download className="mr-1 h-4 w-4" />
            PDF
          </Button>
        </div>
      </div>

      {canReview ? (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-base">Admin review</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Comments / feedback</Label>
              <Textarea
                rows={4}
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Approval notes, corrections, or rejection reasons…"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button disabled={submitting} onClick={() => void runReview("approved")}>
                <CheckCircle2 className="mr-1 h-4 w-4" />
                Approve
              </Button>
              <Button variant="secondary" disabled={submitting} onClick={() => void runReview("needs_correction")}>
                <RotateCcw className="mr-1 h-4 w-4" />
                Needs correction
              </Button>
              <Button variant="destructive" disabled={submitting} onClick={() => void runReview("rejected")}>
                <XCircle className="mr-1 h-4 w-4" />
                Reject
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : note.admin_feedback ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Reviewer feedback</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{note.admin_feedback}</p>
            {note.reviewer_name ? (
              <p className="text-xs text-muted-foreground mt-2">
                {note.reviewer_name} · {note.reviewed_at ? new Date(note.reviewed_at).toLocaleString() : ""}
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Tabs defaultValue="content">
        <TabsList>
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
        <TabsContent value="content" className="space-y-4 mt-4" id="lesson-note-print-root">
          <Card>
            <CardContent className="pt-6 space-y-4">
              {CONTENT_FIELD_LABELS.map((field) => {
                const text = String(note.content?.[field.key] ?? "").trim();
                if (!text) return null;
                return (
                  <div key={field.key}>
                    <h4 className="text-sm font-semibold">{field.label}</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-1">{text}</p>
                  </div>
                );
              })}
            </CardContent>
          </Card>
          {attachments.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Attachments</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {attachments.map((a) => (
                  <a key={a.id} href={a.file_url} className="text-sm text-primary underline block" target="_blank" rel="noreferrer">
                    {a.file_name}
                  </a>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>
        <TabsContent value="history" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <LessonNoteHistoryPanel noteId={note.id} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
    </DashboardLayout>
  );
}
