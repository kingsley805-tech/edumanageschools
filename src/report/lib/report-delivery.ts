import { supabase } from "@/integrations/supabase/client";
import { isMissingSchemaColumnError } from "@/report/lib/supabase-errors";

export async function notifyParentsReportReady(opts: {
  studentId: string;
  studentName: string;
  className?: string | null;
  termLabel?: string | null;
  reportId: string;
  senderRole: "teacher" | "admin";
}): Promise<number> {
  const { data: links } = await supabase
    .from("parent_students")
    .select("parent_id")
    .eq("student_id", opts.studentId);
  const parentIds = (links ?? []).map((l) => l.parent_id);
  if (!parentIds.length) return 0;

  const rows = parentIds.map((pid) => ({
    user_id: pid,
    title: `Report card available — ${opts.studentName}`,
    message:
      `${opts.senderRole === "admin" ? "The school admin" : "The class teacher"} shared ` +
      `${opts.studentName}'s${opts.termLabel ? ` ${opts.termLabel}` : ""} report card` +
      `${opts.className ? ` (${opts.className})` : ""}. View, download, or print from your portal.`,
    type: "info",
    link: `/parent/reports?studentId=${opts.studentId}&reportId=${opts.reportId}`,
  }));
  const { error } = await supabase.from("notifications").insert(rows);
  if (error) throw error;
  return parentIds.length;
}

/** Send one report to parent portal and record delivery metadata. */
export async function deliverReportToParents(opts: {
  reportId: string;
  studentId: string;
  studentName: string;
  className?: string | null;
  termLabel?: string | null;
  senderId: string;
  senderRole: "teacher" | "admin";
}): Promise<number> {
  const now = new Date().toISOString();
  const fullPayload = {
    status: "published" as const,
    published_at: now,
    published_by: opts.senderId,
    sent_to_parents_at: now,
    sent_to_parents_by: opts.senderId,
  };
  let { error: upErr } = await supabase
    .from("term_report_cards")
    .update(fullPayload as never)
    .eq("id", opts.reportId);
  if (isMissingSchemaColumnError(upErr)) {
    ({ error: upErr } = await supabase
      .from("term_report_cards")
      .update({ status: "published" })
      .eq("id", opts.reportId));
  }
  if (upErr) throw upErr;

  return notifyParentsReportReady({
    studentId: opts.studentId,
    studentName: opts.studentName,
    className: opts.className,
    termLabel: opts.termLabel,
    reportId: opts.reportId,
    senderRole: opts.senderRole,
  });
}

/** Bulk deliver all approved/published reports for a class (optional term filter). */
export async function deliverClassReportsToParents(opts: {
  schoolId: string;
  classId: string;
  termId?: string | null;
  senderId: string;
  senderRole: "teacher" | "admin";
}): Promise<{ sent: number; skipped: number }> {
  const baseSelect =
    "id, student_id, student_name, class_name, term_label, status, sent_to_parents_at";
  let query = supabase
    .from("term_report_cards")
    .select(baseSelect)
    .eq("school_id", opts.schoolId)
    .eq("class_id", opts.classId)
    .in("status", ["approved", "published"]);

  if (opts.termId) query = query.eq("term_id", opts.termId);

  let { data: rows, error } = await query;
  if (isMissingSchemaColumnError(error)) {
    let q2 = supabase
      .from("term_report_cards")
      .select("id, student_id, student_name, class_name, term_label, status")
      .eq("school_id", opts.schoolId)
      .eq("class_id", opts.classId)
      .in("status", ["approved", "published"]);
    if (opts.termId) q2 = q2.eq("term_id", opts.termId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ({ data: rows as any, error } = await q2);
  }
  if (error) throw error;

  let sent = 0;
  let skipped = 0;

  for (const row of rows ?? []) {
    if ("sent_to_parents_at" in row && row.sent_to_parents_at) {
      skipped += 1;
      continue;
    }
    const n = await deliverReportToParents({
      reportId: row.id,
      studentId: row.student_id,
      studentName: row.student_name,
      className: row.class_name,
      termLabel: row.term_label,
      senderId: opts.senderId,
      senderRole: opts.senderRole,
    });
    if (n > 0) sent += 1;
    else skipped += 1;
  }

  return { sent, skipped };
}
