import { supabase } from "@/integrations/supabase/client";
import { fetchTeacherRecordId } from "@/report/lib/teacher-assignments";
import type { LessonNoteContent, LessonNoteRow, LessonNoteStatus } from "@/lesson-notes/lib/types";
import { notifyAdminsLessonNoteSubmitted, notifyTeacherLessonNoteReviewed } from "@/lesson-notes/lib/notify";

const NOTE_SELECT = `
  id, school_id, teacher_id, term_id, academic_year_id, session_label,
  week_number, day_of_week, lesson_date, class_id, subject_id, teacher_name,
  topic, sub_topic, content, status, version_number, submitted_at, reviewed_at,
  reviewed_by, reviewer_name, admin_feedback, created_at, updated_at,
  classes ( name ), subjects ( name ), terms ( name, session )
`;

function mapNote(row: Record<string, unknown>): LessonNoteRow {
  return {
    ...(row as LessonNoteRow),
    content: (row.content as LessonNoteContent) ?? {},
  };
}

export async function fetchTeacherClassSubjectOptions(userId: string) {
  const teacherId = await fetchTeacherRecordId(userId);
  if (!teacherId) return [];

  const { data, error } = await supabase
    .from("class_subjects")
    .select("class_id, subject_id, classes(id, name), subjects(id, name)")
    .eq("teacher_id", teacherId);

  if (error) throw error;

  return (data ?? []).map((row) => ({
    classId: row.class_id as string,
    className: (row.classes as { name: string })?.name ?? "Class",
    subjectId: row.subject_id as string,
    subjectName: (row.subjects as { name: string })?.name ?? "Subject",
  }));
}

export async function fetchTermsForSchool(schoolId: string) {
  const { data, error } = await supabase
    .from("terms")
    .select("id, name, session, is_current, academic_year_id")
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listLessonNotes(filters: {
  schoolId?: string;
  teacherId?: string;
  status?: string;
  classId?: string;
  subjectId?: string;
  week?: number;
  termId?: string;
  search?: string;
}) {
  let q = supabase.from("lesson_notes").select(NOTE_SELECT).order("updated_at", { ascending: false });

  if (filters.schoolId) q = q.eq("school_id", filters.schoolId);
  if (filters.teacherId) q = q.eq("teacher_id", filters.teacherId);
  if (filters.status && filters.status !== "all") q = q.eq("status", filters.status);
  if (filters.classId && filters.classId !== "all") q = q.eq("class_id", filters.classId);
  if (filters.subjectId && filters.subjectId !== "all") q = q.eq("subject_id", filters.subjectId);
  if (filters.week) q = q.eq("week_number", filters.week);
  if (filters.termId && filters.termId !== "all") q = q.eq("term_id", filters.termId);

  const { data, error } = await q.limit(500);
  if (error) throw error;

  let rows = (data ?? []).map((r) => mapNote(r as Record<string, unknown>));
  const search = (filters.search ?? "").trim().toLowerCase();
  if (search) {
    rows = rows.filter(
      (n) =>
        n.topic.toLowerCase().includes(search) ||
        (n.sub_topic ?? "").toLowerCase().includes(search) ||
        (n.teacher_name ?? "").toLowerCase().includes(search),
    );
  }
  return rows;
}

export async function getLessonNote(id: string) {
  const { data, error } = await supabase.from("lesson_notes").select(NOTE_SELECT).eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return mapNote(data as Record<string, unknown>);
}

export async function createLessonNoteDraft(input: {
  schoolId: string;
  teacherId: string;
  teacherName: string;
  termId: string | null;
  academicYearId: string | null;
  sessionLabel: string | null;
  weekNumber: number;
  dayOfWeek: string;
  lessonDate: string;
  classId: string;
  subjectId: string;
  topic: string;
  subTopic?: string;
  content: LessonNoteContent;
}) {
  const { data, error } = await supabase
    .from("lesson_notes")
    .insert({
      school_id: input.schoolId,
      teacher_id: input.teacherId,
      teacher_name: input.teacherName,
      term_id: input.termId,
      academic_year_id: input.academicYearId,
      session_label: input.sessionLabel,
      week_number: input.weekNumber,
      day_of_week: input.dayOfWeek,
      lesson_date: input.lessonDate,
      class_id: input.classId,
      subject_id: input.subjectId,
      topic: input.topic,
      sub_topic: input.subTopic ?? null,
      content: input.content,
      status: "draft",
    })
    .select("id")
    .single();

  if (error) throw error;

  await logStatusChange({
    noteId: data.id,
    schoolId: input.schoolId,
    from: null,
    to: "draft",
    comment: "Created draft",
  });

  return data.id as string;
}

export async function updateLessonNote(
  id: string,
  patch: Partial<{
    topic: string;
    sub_topic: string;
    content: LessonNoteContent;
    week_number: number;
    day_of_week: string;
    lesson_date: string;
    term_id: string | null;
    session_label: string | null;
  }>,
) {
  const { error } = await supabase.from("lesson_notes").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteLessonNoteDraft(id: string) {
  const { error } = await supabase.from("lesson_notes").delete().eq("id", id).eq("status", "draft");
  if (error) throw error;
}

async function logStatusChange(opts: {
  noteId: string;
  schoolId: string;
  from: LessonNoteStatus | null;
  to: LessonNoteStatus;
  comment?: string;
  actorName?: string;
}) {
  const { data: session } = await supabase.auth.getSession();
  const uid = session.session?.user?.id ?? null;
  await supabase.from("lesson_note_status_logs").insert({
    lesson_note_id: opts.noteId,
    school_id: opts.schoolId,
    from_status: opts.from,
    to_status: opts.to,
    actor_user_id: uid,
    actor_name: opts.actorName ?? null,
    comment: opts.comment ?? null,
  });
}

export async function submitLessonNote(noteId: string) {
  const note = await getLessonNote(noteId);
  if (!note) throw new Error("Lesson note not found");
  if (!["draft", "needs_correction", "rejected"].includes(note.status)) {
    throw new Error("This note cannot be submitted in its current status.");
  }

  const nextVersion = note.status === "draft" && note.version_number === 1 && !note.submitted_at
    ? 1
    : note.version_number + 1;

  const snapshot = {
    topic: note.topic,
    sub_topic: note.sub_topic,
    content: note.content,
    week_number: note.week_number,
    day_of_week: note.day_of_week,
    lesson_date: note.lesson_date,
    class_id: note.class_id,
    subject_id: note.subject_id,
  };

  const { data: session } = await supabase.auth.getSession();
  const uid = session.session?.user?.id ?? null;

  await supabase.from("lesson_note_versions").insert({
    lesson_note_id: noteId,
    version_number: nextVersion,
    snapshot,
    submitted_by: uid,
  });

  const { error } = await supabase
    .from("lesson_notes")
    .update({
      status: "pending_review",
      version_number: nextVersion,
      submitted_at: new Date().toISOString(),
      admin_feedback: null,
    })
    .eq("id", noteId);

  if (error) throw error;

  await logStatusChange({
    noteId,
    schoolId: note.school_id,
    from: note.status,
    to: "pending_review",
    comment: "Submitted for review",
    actorName: note.teacher_name ?? undefined,
  });

  const { data: teacher } = await supabase
    .from("teachers")
    .select("user_id")
    .eq("id", note.teacher_id)
    .maybeSingle();

  await notifyAdminsLessonNoteSubmitted({
    schoolId: note.school_id,
    teacherName: note.teacher_name ?? "Teacher",
    topic: note.topic,
    className: note.classes?.name ?? "Class",
    noteId,
  });

  return { teacherUserId: teacher?.user_id };
}

export async function reviewLessonNote(opts: {
  noteId: string;
  status: "approved" | "rejected" | "needs_correction";
  feedback: string;
  reviewerName: string;
}) {
  const note = await getLessonNote(opts.noteId);
  if (!note) throw new Error("Lesson note not found");
  if (note.status !== "pending_review") {
    throw new Error("Only pending notes can be reviewed.");
  }

  const { data: session } = await supabase.auth.getSession();
  const uid = session.session?.user?.id ?? null;

  const { error } = await supabase
    .from("lesson_notes")
    .update({
      status: opts.status,
      reviewed_at: new Date().toISOString(),
      reviewed_by: uid,
      reviewer_name: opts.reviewerName,
      admin_feedback: opts.feedback || null,
    })
    .eq("id", opts.noteId);

  if (error) throw error;

  if (opts.feedback.trim()) {
    await supabase.from("lesson_note_comments").insert({
      lesson_note_id: opts.noteId,
      author_user_id: uid!,
      author_name: opts.reviewerName,
      author_role: "admin",
      body: opts.feedback.trim(),
    });
  }

  await logStatusChange({
    noteId: opts.noteId,
    schoolId: note.school_id,
    from: "pending_review",
    to: opts.status,
    comment: opts.feedback || opts.status,
    actorName: opts.reviewerName,
  });

  const { data: teacher } = await supabase
    .from("teachers")
    .select("user_id")
    .eq("id", note.teacher_id)
    .maybeSingle();

  if (teacher?.user_id) {
    await notifyTeacherLessonNoteReviewed({
      teacherUserId: teacher.user_id,
      status: opts.status,
      topic: note.topic,
      noteId: opts.noteId,
      feedback: opts.feedback,
    });
  }
}

export async function fetchLessonNoteHistory(noteId: string) {
  const [logs, versions, comments] = await Promise.all([
    supabase
      .from("lesson_note_status_logs")
      .select("*")
      .eq("lesson_note_id", noteId)
      .order("created_at", { ascending: true }),
    supabase
      .from("lesson_note_versions")
      .select("*")
      .eq("lesson_note_id", noteId)
      .order("version_number", { ascending: true }),
    supabase
      .from("lesson_note_comments")
      .select("*")
      .eq("lesson_note_id", noteId)
      .order("created_at", { ascending: true }),
  ]);

  return {
    logs: logs.data ?? [],
    versions: versions.data ?? [],
    comments: comments.data ?? [],
  };
}

export async function uploadLessonNoteAttachment(noteId: string, file: File) {
  const ext = file.name.split(".").pop() ?? "bin";
  const path = `${noteId}/${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await supabase.storage.from("lesson-notes").upload(path, file, { upsert: false });
  if (upErr) throw upErr;
  const { data: urlData } = supabase.storage.from("lesson-notes").getPublicUrl(path);
  const { data: session } = await supabase.auth.getSession();
  const { error } = await supabase.from("lesson_note_attachments").insert({
    lesson_note_id: noteId,
    file_name: file.name,
    file_url: urlData.publicUrl,
    file_type: file.type,
    file_size: file.size,
    uploaded_by: session.session?.user?.id ?? null,
  });
  if (error) throw error;
  return urlData.publicUrl;
}

export async function listLessonNoteAttachments(noteId: string) {
  const { data, error } = await supabase
    .from("lesson_note_attachments")
    .select("*")
    .eq("lesson_note_id", noteId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export function computeLessonNoteStats(notes: LessonNoteRow[]) {
  return {
    total: notes.length,
    draft: notes.filter((n) => n.status === "draft").length,
    pending: notes.filter((n) => n.status === "pending_review").length,
    approved: notes.filter((n) => n.status === "approved").length,
    rejected: notes.filter((n) => n.status === "rejected" || n.status === "needs_correction").length,
  };
}
