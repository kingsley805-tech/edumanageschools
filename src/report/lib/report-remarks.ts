// @ts-nocheck
import { supabase } from "@/integrations/supabase/client";

export type PerformanceTier = "excellent" | "very_good" | "good" | "pass" | "weak" | "poor";

export function performanceTier(avg: number): PerformanceTier {
  if (avg >= 80) return "excellent";
  if (avg >= 70) return "very_good";
  if (avg >= 60) return "good";
  if (avg >= 50) return "pass";
  if (avg >= 40) return "weak";
  return "poor";
}

const REMARKS: Record<PerformanceTier, string[]> = {
  excellent: [
    "An outstanding performance this term. Keep up the brilliant work!",
    "Exceptional results across the board. A model student — well done!",
    "Excellent work and consistent effort. Continue to aim high.",
    "Truly impressive performance. Your hard work is paying off.",
  ],
  very_good: [
    "A very good term's work. With a little more push you can reach the top.",
    "Strong results this term. Stay focused and keep improving.",
    "Very commendable performance. Keep the momentum going.",
    "A great term overall — well done and keep striving for excellence.",
  ],
  good: [
    "A good performance this term. With more effort, even better results are possible.",
    "Steady progress shown. Keep working hard to climb higher.",
    "A pleasing term's work. Aim to push past the average in every subject.",
    "Good work this term. Sharpen weaker areas to move up the class.",
  ],
  pass: [
    "An average performance. More dedication is needed to improve.",
    "A fair term's work. Pay closer attention in class and at home.",
    "You can do much better. Focus more on revision and practice.",
    "A satisfactory effort. Set clear goals for next term to do better.",
  ],
  weak: [
    "Performance is below expectation. More serious effort is required.",
    "Results are weak this term. Please give more time to your studies.",
    "You need to take your learning more seriously. Seek help where needed.",
    "A disappointing term. Daily revision and practice are strongly advised.",
  ],
  poor: [
    "A very poor performance. Urgent attention and remedial support are needed.",
    "Results are well below expectation. Parents are urged to support at home.",
    "Significant improvement is needed. Please commit to regular study and class participation.",
    "Performance is very weak. A clear study plan and extra support are required.",
  ],
};

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function randomRemarkForAverage(avg: number): string {
  return pick(REMARKS[performanceTier(avg)]);
}

export function improvementTipsFor(avg: number): string {
  const tier = performanceTier(avg);
  if (tier === "poor")
    return "Arrange remedial classes, daily 1-hour guided study at home, weekly subject tests, and one-on-one teacher follow-up.";
  if (tier === "weak")
    return "Schedule extra coaching in weakest subjects, structured homework supervision, and bi-weekly progress checks.";
  return "Continue regular revision, complete all assignments on time, and seek clarification on difficult topics.";
}

/** Notify all school admins about a list of underperforming students with names, class, and tips. */
export async function notifyAdminsOfPoorPerformers(opts: {
  schoolId: string;
  className: string;
  termLabel?: string | null;
  students: { name: string; average: number }[];
}) {
  if (!opts.students.length) return;
  const { data: admins } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("school_id", opts.schoolId)
    .eq("role", "school_admin");
  if (!admins?.length) return;

  const lines = opts.students
    .map((s) => `• ${s.name} (${s.average.toFixed(1)}%) — ${improvementTipsFor(s.average)}`)
    .join("\n");
  const message =
    `${opts.students.length} student${opts.students.length === 1 ? "" : "s"} in ${opts.className}` +
    `${opts.termLabel ? ` (${opts.termLabel})` : ""} need academic support:\n${lines}`;

  const rows = admins.map((a) => ({
    user_id: a.user_id,
    title: `Academic alert — ${opts.className}`,
    message,
    type: "warning",
    link: "/admin/report-cards",
  }));
  await supabase.from("notifications").insert(rows);
}

/** @deprecated Use deliverReportToParents from @/report/lib/report-delivery */
export { deliverReportToParents as forwardReportToParents } from "@/report/lib/report-delivery";