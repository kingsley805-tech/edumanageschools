// @ts-nocheck
import { supabase } from "@/integrations/supabase/client";
import type { LessonNoteStatus } from "@/lesson-notes/lib/types";

async function insertNotification(row: {
  user_id: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}) {
  await supabase.from("notifications").insert({
    user_id: row.user_id,
    title: row.title,
    body: row.body,
    data: row.data ?? {},
  });
}

export async function notifyAdminsLessonNoteSubmitted(opts: {
  schoolId: string;
  teacherName: string;
  topic: string;
  className: string;
  noteId: string;
}) {
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id")
    .eq("school_id", opts.schoolId);

  const userIds = (profiles ?? []).map((p) => p.id);
  if (!userIds.length) return;

  const { data: roles } = await supabase
    .from("user_roles")
    .select("user_id, role")
    .in("user_id", userIds)
    .in("role", ["admin", "accountant"]);

  const adminIds = [...new Set((roles ?? []).map((r) => r.user_id))];
  await Promise.all(
    adminIds.map((user_id) =>
      insertNotification({
        user_id,
        title: "Lesson note submitted",
        body: `${opts.teacherName} submitted "${opts.topic}" for ${opts.className}.`,
        data: { type: "lesson_note_submitted", link: `/admin/lesson-notes/${opts.noteId}` },
      }),
    ),
  );
}

export async function notifyTeacherLessonNoteReviewed(opts: {
  teacherUserId: string;
  status: LessonNoteStatus;
  topic: string;
  noteId: string;
  feedback?: string;
}) {
  const titles: Record<string, string> = {
    approved: "Lesson note approved",
    rejected: "Lesson note rejected",
    needs_correction: "Correction requested",
    pending_review: "Lesson note update",
    draft: "Lesson note update",
  };
  const bodies: Record<string, string> = {
    approved: `Your lesson note "${opts.topic}" has been approved.`,
    rejected: `Your lesson note "${opts.topic}" was rejected.${opts.feedback ? ` ${opts.feedback}` : ""}`,
    needs_correction: `Please update "${opts.topic}" and resubmit.${opts.feedback ? ` ${opts.feedback}` : ""}`,
    pending_review: `Your lesson note "${opts.topic}" is being reviewed.`,
    draft: `Your lesson note "${opts.topic}" was updated.`,
  };

  await insertNotification({
    user_id: opts.teacherUserId,
    title: titles[opts.status] ?? "Lesson note update",
    body: bodies[opts.status] ?? `Update on "${opts.topic}".`,
    data: { type: "lesson_note_review", link: `/teacher/lesson-notes/${opts.noteId}` },
  });
}
