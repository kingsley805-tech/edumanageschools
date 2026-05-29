// @ts-nocheck
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, Download, Loader2, Printer, Save, Send, Upload } from "lucide-react";
import { printLessonNote } from "@/lesson-notes/lib/printLessonNote";
import { fetchTeacherRecordId } from "@/report/lib/teacher-assignments";
import {
  createLessonNoteDraft,
  fetchTeacherClassSubjectOptions,
  fetchTermsForSchool,
  getLessonNote,
  listLessonNoteAttachments,
  submitLessonNote,
  updateLessonNote,
  uploadLessonNoteAttachment,
} from "@/lesson-notes/lib/api";
import { downloadLessonNotePdf } from "@/lesson-notes/lib/exportPdf";
import { LessonNoteHistoryPanel } from "@/lesson-notes/components/LessonNoteHistoryPanel";
import { LessonNoteStatusBadge } from "@/lesson-notes/components/LessonNoteStatusBadge";
import {
  CONTENT_FIELD_LABELS,
  DAYS_OF_WEEK,
  EMPTY_LESSON_CONTENT,
  type LessonNoteContent,
} from "@/lesson-notes/lib/types";
import { supabase } from "@/integrations/supabase/client";

const AUTOSAVE_MS = 2500;

export default function TeacherLessonNoteEditor() {
  const { id } = useParams();
  const isNew = !id || id === "new";
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [noteId, setNoteId] = useState<string | null>(isNew ? null : id ?? null);
  const [status, setStatus] = useState("draft");
  const [adminFeedback, setAdminFeedback] = useState("");
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [teacherName, setTeacherName] = useState("");
  const [schoolName, setSchoolName] = useState("School");

  const [classOptions, setClassOptions] = useState([]);
  const [terms, setTerms] = useState([]);
  const [attachments, setAttachments] = useState([]);

  const [termId, setTermId] = useState("");
  const [sessionLabel, setSessionLabel] = useState("");
  const [weekNumber, setWeekNumber] = useState(1);
  const [dayOfWeek, setDayOfWeek] = useState("monday");
  const [lessonDate, setLessonDate] = useState(new Date().toISOString().slice(0, 10));
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [topic, setTopic] = useState("");
  const [subTopic, setSubTopic] = useState("");
  const [content, setContent] = useState<LessonNoteContent>({ ...EMPTY_LESSON_CONTENT });

  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const canEdit = ["draft", "needs_correction", "rejected"].includes(status);

  const loadMeta = useCallback(async () => {
    if (!user) return;
    const { data: profile } = await supabase
      .from("profiles")
      .select("school_id, full_name, schools(name)")
      .eq("id", user.id)
      .maybeSingle();
    const sid = profile?.school_id ?? null;
    setSchoolId(sid);
    setTeacherName(profile?.full_name ?? "Teacher");
    setSchoolName((profile?.schools as { name?: string })?.name ?? "School");
    const tid = await fetchTeacherRecordId(user.id);
    setTeacherId(tid);
    if (sid) {
      const [pairs, termRows] = await Promise.all([
        fetchTeacherClassSubjectOptions(user.id),
        fetchTermsForSchool(sid),
      ]);
      setClassOptions(pairs);
      setTerms(termRows);
      if (termRows.length && !termId) {
        const current = termRows.find((t) => t.is_current) ?? termRows[0];
        setTermId(current.id);
        setSessionLabel(current.session ?? "");
      }
    }
  }, [user, termId]);

  const loadNote = useCallback(async () => {
    if (isNew || !id) return;
    setLoading(true);
    try {
      const note = await getLessonNote(id);
      if (!note) {
        toast.error("Lesson note not found");
        navigate("/teacher/lesson-notes");
        return;
      }
      setNoteId(note.id);
      setStatus(note.status);
      setAdminFeedback(note.admin_feedback ?? "");
      setTermId(note.term_id ?? "");
      setSessionLabel(note.session_label ?? "");
      setWeekNumber(note.week_number);
      setDayOfWeek(note.day_of_week);
      setLessonDate(note.lesson_date);
      setClassId(note.class_id);
      setSubjectId(note.subject_id);
      setTopic(note.topic);
      setSubTopic(note.sub_topic ?? "");
      setContent({ ...EMPTY_LESSON_CONTENT, ...note.content });
      const atts = await listLessonNoteAttachments(note.id);
      setAttachments(atts);
    } finally {
      setLoading(false);
    }
  }, [id, isNew, navigate]);

  useEffect(() => {
    void loadMeta();
    void loadNote();
  }, [loadMeta, loadNote]);

  const persistDraft = useCallback(async () => {
    if (!canEdit || !user || !schoolId || !teacherId) return;
    if (!topic.trim() || !classId || !subjectId) return;

    setSaving(true);
    try {
      const payload = {
        topic: topic.trim(),
        sub_topic: subTopic.trim() || null,
        content,
        week_number: weekNumber,
        day_of_week: dayOfWeek,
        lesson_date: lessonDate,
        term_id: termId || null,
        session_label: sessionLabel || null,
      };

      if (!noteId) {
        const newId = await createLessonNoteDraft({
          schoolId,
          teacherId,
          teacherName,
          termId: termId || null,
          academicYearId: terms.find((t) => t.id === termId)?.academic_year_id ?? null,
          sessionLabel: sessionLabel || null,
          weekNumber,
          dayOfWeek,
          lessonDate,
          classId,
          subjectId,
          topic: topic.trim(),
          subTopic: subTopic.trim(),
          content,
        });
        setNoteId(newId);
        navigate(`/teacher/lesson-notes/${newId}`, { replace: true });
      } else {
        await updateLessonNote(noteId, payload);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [
    canEdit,
    user,
    schoolId,
    teacherId,
    topic,
    classId,
    subjectId,
    content,
    weekNumber,
    dayOfWeek,
    lessonDate,
    termId,
    sessionLabel,
    subTopic,
    teacherName,
    terms,
    noteId,
    navigate,
  ]);

  useEffect(() => {
    if (!canEdit) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => void persistDraft(), AUTOSAVE_MS);
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, [topic, subTopic, content, weekNumber, dayOfWeek, lessonDate, classId, subjectId, termId, canEdit, persistDraft]);

  const handleSubmit = async () => {
    await persistDraft();
    if (!noteId) {
      toast.error("Save the note first");
      return;
    }
    try {
      await submitLessonNote(noteId);
      toast.success("Submitted for admin review");
      setStatus("pending_review");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Submit failed");
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !noteId) {
      if (!noteId) toast.error("Save draft first before uploading files");
      return;
    }
    try {
      await uploadLessonNoteAttachment(noteId, file);
      setAttachments(await listLessonNoteAttachments(noteId));
      toast.success("File uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    }
  };

  const noteForPdf = useMemo(() => {
    if (!noteId) return null;
    return {
      id: noteId,
      topic,
      sub_topic: subTopic,
      content,
      week_number: weekNumber,
      day_of_week: dayOfWeek,
      lesson_date: lessonDate,
      teacher_name: teacherName,
      status,
      classes: { name: classOptions.find((c) => c.classId === classId)?.className },
      subjects: { name: classOptions.find((c) => c.classId === classId && c.subjectId === subjectId)?.subjectName },
      terms: { name: terms.find((t) => t.id === termId)?.name, session: sessionLabel },
    };
  }, [noteId, topic, subTopic, content, weekNumber, dayOfWeek, lessonDate, teacherName, status, classOptions, classId, subjectId, terms, termId, sessionLabel]);

  if (loading) {
    return (
      <DashboardLayout role="teacher">
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="teacher">
      <div className="space-y-6 max-w-5xl">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/teacher/lesson-notes">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back
            </Link>
          </Button>
          <LessonNoteStatusBadge status={status} />
          {saving ? <span className="text-xs text-muted-foreground">Saving…</span> : null}
        </div>

        <div className="flex flex-wrap justify-between gap-4">
          <h2 className="text-2xl font-bold">{isNew ? "New lesson note" : topic || "Lesson note"}</h2>
          <div className="flex flex-wrap gap-2">
            {noteForPdf ? (
              <>
                <Button variant="outline" size="sm" onClick={() => printLessonNote()}>
                  <Printer className="mr-1 h-4 w-4" />
                  Print
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadLessonNotePdf(noteForPdf as never, schoolName)}
                >
                  <Download className="mr-1 h-4 w-4" />
                  PDF
                </Button>
              </>
            ) : null}
            {canEdit ? (
              <>
                <Button variant="outline" size="sm" onClick={() => void persistDraft()}>
                  <Save className="mr-1 h-4 w-4" />
                  Save draft
                </Button>
                <Button size="sm" onClick={() => void handleSubmit()}>
                  <Send className="mr-1 h-4 w-4" />
                  Submit for review
                </Button>
              </>
            ) : null}
          </div>
        </div>

        <Tabs defaultValue="form">
          <TabsList>
            <TabsTrigger value="form">Lesson plan</TabsTrigger>
            {!isNew ? <TabsTrigger value="history">History</TabsTrigger> : null}
          </TabsList>

          <TabsContent value="form" className="space-y-6 mt-4" id="lesson-note-print-root">
            {!canEdit && adminFeedback ? (
              <Card className="border-amber-200 bg-amber-50/50">
                <CardHeader>
                  <CardTitle className="text-base">Admin feedback</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap">{adminFeedback}</p>
                </CardContent>
              </Card>
            ) : null}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Schedule & class</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Term</Label>
                  <Select
                    value={termId}
                    onValueChange={(v) => {
                      setTermId(v);
                      const t = terms.find((x) => x.id === v);
                      setSessionLabel(t?.session ?? "");
                    }}
                    disabled={!canEdit}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select term" />
                    </SelectTrigger>
                    <SelectContent>
                      {terms.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name} {t.session ? `(${t.session})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Week</Label>
                  <Input
                    type="number"
                    min={1}
                    max={52}
                    value={weekNumber}
                    onChange={(e) => setWeekNumber(Number(e.target.value))}
                    disabled={!canEdit}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Day</Label>
                  <Select value={dayOfWeek} onValueChange={setDayOfWeek} disabled={!canEdit}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DAYS_OF_WEEK.map((d) => (
                        <SelectItem key={d.value} value={d.value}>
                          {d.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={lessonDate}
                    onChange={(e) => setLessonDate(e.target.value)}
                    disabled={!canEdit}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Class & subject</Label>
                  <Select
                    value={classId && subjectId ? `${classId}:${subjectId}` : ""}
                    onValueChange={(v) => {
                      const [c, s] = v.split(":");
                      setClassId(c);
                      setSubjectId(s);
                    }}
                    disabled={!canEdit}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select class and subject" />
                    </SelectTrigger>
                    <SelectContent>
                      {classOptions.map((o) => (
                        <SelectItem key={`${o.classId}:${o.subjectId}`} value={`${o.classId}:${o.subjectId}`}>
                          {o.className} — {o.subjectName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Topic</Label>
                  <Input value={topic} onChange={(e) => setTopic(e.target.value)} disabled={!canEdit} />
                </div>
                <div className="space-y-2">
                  <Label>Sub topic</Label>
                  <Input value={subTopic} onChange={(e) => setSubTopic(e.target.value)} disabled={!canEdit} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Lesson content</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {CONTENT_FIELD_LABELS.map((field) => (
                  <div key={field.key} className="space-y-2">
                    <Label>{field.label}</Label>
                    <Textarea
                      rows={4}
                      value={content[field.key] ?? ""}
                      onChange={(e) => setContent((c) => ({ ...c, [field.key]: e.target.value }))}
                      disabled={!canEdit}
                      placeholder={`Enter ${field.label.toLowerCase()}…`}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Attachments</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {canEdit ? (
                  <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-primary">
                    <Upload className="h-4 w-4" />
                    Upload file
                    <input type="file" className="hidden" onChange={handleUpload} />
                  </label>
                ) : null}
                {attachments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No attachments</p>
                ) : (
                  <ul className="space-y-2">
                    {attachments.map((a) => (
                      <li key={a.id}>
                        <a href={a.file_url} target="_blank" rel="noreferrer" className="text-sm text-primary underline">
                          {a.file_name}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {!isNew && noteId ? (
            <TabsContent value="history" className="mt-4">
              <Card>
                <CardContent className="pt-6">
                  <LessonNoteHistoryPanel noteId={noteId} />
                </CardContent>
              </Card>
            </TabsContent>
          ) : null}
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
