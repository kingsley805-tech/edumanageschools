import { Link, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/report/hooks/use-auth";
import { useCurrentTerm } from "@/report/hooks/use-school-data";
import { useTermReportCard } from "@/report/hooks/use-term-report-card";
import { PageHeader } from "@/report/portal/page-header";
import { ActiveTermBanner } from "@/report/portal/active-term-banner";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { ShepherdReportCard } from "@/report/components/shepherd-report-card";
import {
  isPendingAdminAction,
  statusBadgeVariant,
  statusLabel,
  teacherReportEditByDefault,
} from "@/report/lib/report-card-status";
import { useGeneratePositions } from "@/report/hooks/use-generate-positions";
import { GeneratePositionsCard } from "@/report/portal/generate-positions-card";
import { FileText, History, Pencil, Send } from "lucide-react";
import { useReportSignatures } from "@/report/hooks/use-report-signatures";
import { TeacherBulkReportActions } from "@/report/components/teacher-bulk-report-actions";
import { fetchTeacherAssignedClasses } from "@/report/lib/teacher-assignments";

function TeacherReportCards() {
  const { user, profile } = useAuth();
  const { data: term } = useCurrentTerm();
  const [classId, setClassId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [submitOpen, setSubmitOpen] = useState(false);
  const [positionsRevealed, setPositionsRevealed] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Reset only when class or term changes — not when switching students after Generate Positions.
  useEffect(() => {
    setPositionsRevealed(false);
    setIsEditing(false);
  }, [classId, term?.id]);

  useEffect(() => {
    setIsEditing(false);
    setPositionsRevealed(false);
  }, [studentId]);

  const { data: classes, isLoading: classesLoading } = useQuery({
    queryKey: ["teacher-classes-report", user?.id],
    enabled: !!user?.id,
    queryFn: () => fetchTeacherAssignedClasses(user!.id),
  });

  useEffect(() => {
    if (!classes?.length || classId) return;
    setClassId(classes[0].id);
  }, [classes, classId]);

  const { data: students } = useQuery({
    queryKey: ["class-students-report", classId],
    enabled: !!classId,
    queryFn: async () => {
      const { data } = await supabase
        .from("students")
        .select("id, full_name, admission_number")
        .eq("class_id", classId)
        .order("full_name");
      return data ?? [];
    },
  });

  const schoolId = profile?.school_id ?? "";

  const editor = useTermReportCard({
    studentId,
    classId,
    termId: term?.id ?? "",
    schoolId,
    teacherId: user?.id ?? "",
    teacherName: profile?.full_name ?? undefined,
    enabled: !!studentId && !!schoolId && !!term?.id,
    showPositions: positionsRevealed,
  });

  useEffect(() => {
    if (!studentId || editor.loading) return;
    if (teacherReportEditByDefault(editor.status) || !editor.reportId) {
      setIsEditing(true);
    }
  }, [studentId, editor.status, editor.reportId, editor.loading]);

  const {
    generate: generatePositions,
    progress: scoringProgress,
    progressLoading,
    isGenerating,
    progressPct,
  } = useGeneratePositions({
    classId: classId || undefined,
    termId: term?.id,
    onSuccess: async () => {
      setPositionsRevealed(true);
      if (studentId) await editor.load({ showPositions: true });
    },
  });

  const selectedClassName = classes?.find((c) => c.id === classId)?.name;

  const editable = isEditing;

  const startEditing = () => {
    setIsEditing(true);
    setPositionsRevealed(true);
    if (studentId) void editor.load({ showPositions: true });
  };

  const { teacherSignatureUrl, headSignatureUrl } = useReportSignatures({
    schoolId,
    teacherId: user?.id,
    enabled: !!editor.form && !!schoolId,
  });

  return (
    <>
      <PageHeader
        title="Report card"
        description="Select class and student, then fill the official report. Changes auto-save. Upload your signature under Signatures in the sidebar."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/teacher/report-cards/history">
              <History className="mr-1 h-4 w-4" /> History
            </Link>
          </Button>
        }
      />

      <div className="p-6 md:p-8 space-y-6">
        <ActiveTermBanner />
        <Card className="no-print">
          <CardContent className="grid gap-4 p-6 md:grid-cols-3">
            <div>
              <Label>Class</Label>
              <Select
                value={classId}
                onValueChange={(v) => {
                  setClassId(v);
                  setStudentId("");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent>
                  {classes?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!classesLoading && classes && classes.length === 0 && (
                <p className="mt-2 text-sm text-muted-foreground">
                  No classes assigned yet. Ask your admin to link you under Teacher–Class assignments.
                </p>
              )}
            </div>
            <div>
              <Label>Student name</Label>
              <Select value={studentId} onValueChange={setStudentId} disabled={!classId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select student" />
                </SelectTrigger>
                <SelectContent>
                  {students?.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col justify-end gap-2">
              {studentId && (
                <Badge variant={statusBadgeVariant(editor.status)} className="w-fit">
                  {statusLabel(editor.status)}
                </Badge>
              )}
              <div className="flex flex-wrap gap-2">
                {studentId && editor.reportId && !isEditing && (
                  <Button
                    type="button"
                    variant="default"
                    className="flex-1 min-w-[7rem]"
                    onClick={startEditing}
                    disabled={editor.loading}
                  >
                    <Pencil className="mr-1 h-4 w-4" />
                    Edit report
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="flex-1 min-w-[7rem]"
                  onClick={() => editor.load({ showPositions: positionsRevealed || isEditing })}
                  disabled={!studentId || editor.loading}
                >
                  Reload
                </Button>
                <Button
                  className="flex-1 min-w-[7rem]"
                  onClick={() => void editor.saveDraft()}
                  disabled={!editor.form || editor.saving || !editable}
                >
                  Save
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {classId && term && user?.id && schoolId && (
          <TeacherBulkReportActions
            classId={classId}
            termId={term.id}
            teacherId={user.id}
            schoolId={schoolId}
            className={selectedClassName}
            termLabel={term.name}
            students={students}
            onSelectStudent={setStudentId}
          />
        )}

        {classId && term && (
          <GeneratePositionsCard
            className={selectedClassName}
            classId={classId}
            termId={term.id}
            progress={scoringProgress}
            progressPct={progressPct}
            progressLoading={progressLoading}
            isGenerating={isGenerating}
            onGenerate={() => generatePositions.mutate({})}
            compact
          />
        )}

        {editor.loading ? (
          <Skeleton className="h-[900px] w-full max-w-[860px] mx-auto" />
        ) : !editor.form ? (
          <Card className="no-print">
            <CardContent className="flex flex-col items-center py-16 text-muted-foreground">
              <FileText className="h-12 w-12 mb-4 opacity-40" />
              <p>Select a class and student to open the report card template.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {editable && (editor.status === "draft" || editor.status === "rejected") && (
              <div className="no-print flex justify-end">
                <Button onClick={() => setSubmitOpen(true)} disabled={editor.saving}>
                  <Send className="mr-1 h-4 w-4" />
                  Send to Admin for Review
                </Button>
              </div>
            )}
            {!isEditing && editor.reportId && (
              <p className="no-print text-center text-sm text-muted-foreground">
                This report is in <strong>{statusLabel(editor.status)}</strong> status. Click{" "}
                <strong>Edit report</strong> above to make changes (including after positions are generated).
              </p>
            )}
            {isEditing && isPendingAdminAction(editor.status) && (
              <p className="no-print text-center text-sm text-muted-foreground">
                Pending admin review — you can edit and save; status stays the same until admin approves.
              </p>
            )}
            {isEditing && editor.status === "reviewed" && (
              <p className="no-print text-center text-sm text-muted-foreground">
                Admin has reviewed this report — you can still edit and save updates.
              </p>
            )}
            {isEditing && (editor.status === "approved" || editor.status === "published") && (
              <p className="no-print text-center text-sm text-muted-foreground">
                Approved report — edits are saved without removing approval. Parents already see the last published version until you forward again.
              </p>
            )}

            <ShepherdReportCard
              data={editor.form}
              academicYear={editor.form.academicYear}
              editable={editable}
              onChange={editor.setForm}
              onSave={() => void editor.saveDraft()}
              saving={editor.saving}
              autosavePending={editor.autosavePending}
              status={editor.status}
              lastSaved={editor.lastSaved}
              toolbarTitle={`Report — ${editor.form.studentName}`}
              schoolId={schoolId || undefined}
              teacherSignatureUrl={teacherSignatureUrl}
              headSignatureUrl={headSignatureUrl}
            />
          </>
        )}
      </div>

      <AlertDialog open={submitOpen} onOpenChange={setSubmitOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send to admin for review?</AlertDialogTitle>
            <AlertDialogDescription>
              This will notify school admins. You can still edit later using Edit report.
              PDF and print will be enabled after submission.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                await editor.submitForReview();
                setSubmitOpen(false);
              }}
            >
              Send for review
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

import { withReportLayout } from "@/report/withReportLayout";
export default withReportLayout("teacher", TeacherReportCards);
