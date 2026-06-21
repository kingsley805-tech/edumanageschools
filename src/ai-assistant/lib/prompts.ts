import type { AiContext } from "./types";

export type PromptCard = {
  title: string;
  prompt: string;
  category: string;
  roles?: string[];
};

const ALL_ROLES = ["admin", "super_admin", "teacher", "student", "parent", "accountant", "auditor"];

export const PROMPT_CARDS: PromptCard[] = [
  {
    title: "Generate Student Report",
    prompt: "Draft a term report remark for a Primary 5 student who is improving in Mathematics but needs support in English.",
    category: "Academic",
    roles: ["admin", "super_admin", "teacher"],
  },
  {
    title: "Create Lesson Note",
    prompt: "Create a detailed lesson note for Basic 5 Mathematics on fractions, including objectives, introduction, activities, and evaluation.",
    category: "Academic",
    roles: ["teacher", "admin", "super_admin"],
  },
  {
    title: "Write Parent SMS",
    prompt: "Write a friendly SMS to parents about tomorrow's PTA meeting at 9:00 AM. Keep it under 160 characters.",
    category: "Communication",
    roles: ALL_ROLES.filter((r) => r !== "student"),
  },
  {
    title: "Create Examination Questions",
    prompt: "Generate 10 multiple-choice questions on photosynthesis for JHS 2 Science, medium difficulty, with answer key.",
    category: "Academic",
    roles: ["teacher", "admin", "super_admin"],
  },
  {
    title: "Generate Timetable Tips",
    prompt: "Suggest an optimized weekly timetable structure for a school with 6 periods per day, avoiding teacher clashes.",
    category: "Administration",
    roles: ["admin", "super_admin", "teacher"],
  },
  {
    title: "Analyze Attendance",
    prompt: "What patterns should I look for in attendance data to identify at-risk students? Provide an analysis framework.",
    category: "Academic",
    roles: ["admin", "super_admin", "teacher"],
  },
  {
    title: "Draft Official Letter",
    prompt: "Draft a formal letter to parents announcing the start of a new academic term, including key dates and expectations.",
    category: "Administration",
    roles: ["admin", "super_admin"],
  },
  {
    title: "Create Meeting Minutes",
    prompt: "Create meeting minutes template for a staff meeting covering agenda, discussion points, decisions, and action items.",
    category: "Administration",
    roles: ["admin", "super_admin", "teacher"],
  },
  {
    title: "Generate Financial Report",
    prompt: "Outline a monthly school fee collection report structure with sections for revenue, outstanding fees, and recommendations.",
    category: "Finance",
    roles: ["admin", "super_admin", "accountant"],
  },
  {
    title: "Summarize Data",
    prompt: "Help me summarize key insights from school performance data for a management report.",
    category: "Administration",
    roles: ALL_ROLES,
  },
  {
    title: "Child Progress Update",
    prompt: "Help me write a clear, encouraging update to a parent about their child's recent class performance.",
    category: "Communication",
    roles: ["parent", "teacher"],
  },
  {
    title: "Study Plan",
    prompt: "Create a one-week study plan for exam preparation covering Mathematics, English, and Science.",
    category: "Academic",
    roles: ["student"],
  },
];

export function getPromptCardsForRole(role: string): PromptCard[] {
  const normalized = role === "super_admin" ? "admin" : role;
  return PROMPT_CARDS.filter(
    (p) => !p.roles || p.roles.includes(normalized) || p.roles.includes(role),
  );
}

export const MODULE_ACTIONS: Record<string, string[]> = {
  students: ["Write student report", "Analyze performance", "Draft parent notification"],
  teachers: ["Lesson note template", "Scheme of work", "Staff evaluation"],
  attendance: ["Absentee report", "Risk student analysis", "Parent alert SMS"],
  finance: ["Fee collection summary", "Revenue analysis", "Debtor report"],
  billing: ["Financial report", "Outstanding fees summary", "Payment reminder"],
  lesson_notes: ["Generate lesson note", "Weekly plan", "Assessment rubric"],
  report_cards: ["Report remarks", "Term summary", "Recommendations"],
  timetable: ["Timetable optimization", "Period allocation", "Conflict resolution"],
  announcements: ["Draft announcement", "Parent letter", "SMS message"],
  default: ["Summarize", "Draft document", "Improve writing", "Explain concept"],
};

export function getContextActions(ctx: AiContext): string[] {
  const key = ctx.module ?? "default";
  return MODULE_ACTIONS[key] ?? MODULE_ACTIONS.default;
}

export function greetingForHour(name: string): string {
  const h = new Date().getHours();
  const time =
    h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  return `${time}, ${name.split(" ")[0] || "there"}`;
}
