export type LessonNoteStatus =
  | "draft"
  | "pending_review"
  | "approved"
  | "rejected"
  | "needs_correction";

export const LESSON_NOTE_STATUSES: LessonNoteStatus[] = [
  "draft",
  "pending_review",
  "approved",
  "rejected",
  "needs_correction",
];

export const DAYS_OF_WEEK = [
  { value: "monday", label: "Monday" },
  { value: "tuesday", label: "Tuesday" },
  { value: "wednesday", label: "Wednesday" },
  { value: "thursday", label: "Thursday" },
  { value: "friday", label: "Friday" },
  { value: "saturday", label: "Saturday" },
  { value: "sunday", label: "Sunday" },
] as const;

export type LessonNoteContent = {
  learning_objectives?: string;
  previous_knowledge?: string;
  teaching_materials?: string;
  reference_materials?: string;
  introduction?: string;
  lesson_development?: string;
  classroom_activities?: string;
  teacher_activities?: string;
  student_activities?: string;
  assessment_evaluation?: string;
  assignment_homework?: string;
  conclusion?: string;
};

export type LessonNoteRow = {
  id: string;
  school_id: string;
  teacher_id: string;
  term_id: string | null;
  academic_year_id: string | null;
  session_label: string | null;
  week_number: number;
  day_of_week: string;
  lesson_date: string;
  class_id: string;
  subject_id: string;
  teacher_name: string | null;
  topic: string;
  sub_topic: string | null;
  content: LessonNoteContent;
  status: LessonNoteStatus;
  version_number: number;
  submitted_at: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  reviewer_name: string | null;
  admin_feedback: string | null;
  created_at: string;
  updated_at: string;
  classes?: { name: string } | null;
  subjects?: { name: string } | null;
  terms?: { name: string; session: string | null } | null;
};

export const EMPTY_LESSON_CONTENT: LessonNoteContent = {
  learning_objectives: "",
  previous_knowledge: "",
  teaching_materials: "",
  reference_materials: "",
  introduction: "",
  lesson_development: "",
  classroom_activities: "",
  teacher_activities: "",
  student_activities: "",
  assessment_evaluation: "",
  assignment_homework: "",
  conclusion: "",
};

export const STATUS_LABELS: Record<LessonNoteStatus, string> = {
  draft: "Draft",
  pending_review: "Pending Review",
  approved: "Approved",
  rejected: "Rejected",
  needs_correction: "Needs Correction",
};

export const STATUS_BADGE_CLASS: Record<LessonNoteStatus, string> = {
  draft: "bg-slate-500/10 text-slate-700 border-slate-500/20",
  pending_review: "bg-amber-500/10 text-amber-800 border-amber-500/20",
  approved: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  rejected: "bg-red-500/10 text-red-700 border-red-500/20",
  needs_correction: "bg-orange-500/10 text-orange-800 border-orange-500/20",
};

export const CONTENT_FIELD_LABELS: { key: keyof LessonNoteContent; label: string }[] = [
  { key: "learning_objectives", label: "Learning Objectives" },
  { key: "previous_knowledge", label: "Previous Knowledge" },
  { key: "teaching_materials", label: "Teaching Materials" },
  { key: "reference_materials", label: "Reference Materials" },
  { key: "introduction", label: "Introduction" },
  { key: "lesson_development", label: "Lesson Development" },
  { key: "classroom_activities", label: "Classroom Activities" },
  { key: "teacher_activities", label: "Teacher Activities" },
  { key: "student_activities", label: "Student Activities" },
  { key: "assessment_evaluation", label: "Assessment / Evaluation" },
  { key: "assignment_homework", label: "Assignment / Homework" },
  { key: "conclusion", label: "Conclusion" },
];
