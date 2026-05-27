import { supabase } from "@/integrations/supabase/client";

export async function notifyAdminsReportSubmitted(opts: {
  schoolId: string;
  studentName: string;
  className: string;
  reportId: string;
  teacherName?: string;
}) {
  const { data: admins } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("school_id", opts.schoolId)
    .eq("role", "school_admin");

  const rows = (admins ?? []).map((a) => ({
    user_id: a.user_id,
    title: "Report card pending review",
    message: `${opts.teacherName ? `${opts.teacherName} submitted` : "A teacher submitted"} the report for ${opts.studentName} (${opts.className}).`,
    type: "info",
    link: `/admin/report-cards/view?id=${opts.reportId}`,
  }));

  if (!rows.length) return;
  await supabase.from("notifications").insert(rows);
}

export async function notifyTeacherReportReviewed(opts: {
  teacherId: string;
  studentName: string;
  status: "reviewed" | "approved" | "rejected";
  reportId: string;
  note?: string;
}) {
  const titles = {
    reviewed: "Report card reviewed",
    approved: "Report card approved",
    rejected: "Report card needs changes",
  };
  const messages = {
    reviewed: `Admin has reviewed ${opts.studentName}'s report card.`,
    approved: `${opts.studentName}'s report card is approved and published to parents.`,
    rejected: `${opts.studentName}'s report card was returned.${opts.note ? ` Note: ${opts.note}` : ""}`,
  };

  await supabase.from("notifications").insert({
    user_id: opts.teacherId,
    title: titles[opts.status],
    message: messages[opts.status],
    type: opts.status === "rejected" ? "warning" : "success",
    link: `/teacher/report-cards/view?id=${opts.reportId}`,
  });
}
