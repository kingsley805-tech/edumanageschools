import { supabase } from "@/integrations/supabase/client";

type NotifyRow = {
  user_id: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

export async function insertNotifications(rows: NotifyRow[]) {
  if (!rows.length) return;
  const { error } = await supabase.from("notifications").insert(
    rows.map((r) => ({
      user_id: r.user_id,
      title: r.title,
      body: r.body,
      data: r.data ?? {},
    })),
  );
  if (error) console.error("notification insert failed", error);
}

/** Notify all students in a class (and their linked parents). */
export async function notifyClassStudentsAndParents(opts: {
  classId: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  includeParents?: boolean;
}) {
  const { data: students } = await supabase
    .from("students")
    .select("id, user_id, guardian_id")
    .eq("class_id", opts.classId);

  const rows: NotifyRow[] = [];
  const parentIds = new Set<string>();

  for (const s of students ?? []) {
    if (s.user_id) {
      rows.push({
        user_id: s.user_id,
        title: opts.title,
        body: opts.body,
        data: { ...opts.data, student_id: s.id },
      });
    }
    if (opts.includeParents !== false && s.guardian_id) parentIds.add(s.guardian_id);
  }

  if (opts.includeParents !== false && (students?.length ?? 0) > 0) {
    const studentIds = students!.map((s) => s.id);
    const { data: links } = await supabase
      .from("parent_student_links")
      .select("parent_id, student_id")
      .in("student_id", studentIds);
    for (const l of links ?? []) parentIds.add(l.parent_id);
  }

  if (parentIds.size) {
    const { data: parents } = await supabase
      .from("parents")
      .select("id, user_id")
      .in("id", [...parentIds]);
    for (const p of parents ?? []) {
      if (!p.user_id) continue;
      rows.push({
        user_id: p.user_id,
        title: opts.title,
        body: opts.body,
        data: opts.data,
      });
    }
  }

  await insertNotifications(rows);
}

export async function notifyUserIds(
  userIds: string[],
  title: string,
  body: string,
  data?: Record<string, unknown>,
) {
  const unique = [...new Set(userIds.filter(Boolean))];
  await insertNotifications(
    unique.map((user_id) => ({ user_id, title, body, data })),
  );
}

/** Notify school admins for a school_id. */
export async function notifySchoolAdmins(
  schoolId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
) {
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id")
    .eq("school_id", schoolId);
  const ids = (profiles ?? []).map((p) => p.id);
  if (!ids.length) return;
  const { data: roles } = await supabase
    .from("user_roles")
    .select("user_id")
    .in("user_id", ids)
    .in("role", ["admin", "super_admin"]);
  await notifyUserIds(
    (roles ?? []).map((r) => r.user_id),
    title,
    body,
    data,
  );
}
