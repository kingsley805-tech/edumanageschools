export type ClassRegisterStatus = "draft" | "submitted" | "approved" | "rejected";

export type AttendanceStatusType = {
  id: string;
  school_id: string;
  code: string;
  label: string;
  color: string;
  sort_order: number;
  is_active: boolean;
};

export type ClassRegister = {
  id: string;
  school_id: string;
  class_id: string;
  subject_id: string;
  teacher_id: string;
  term_id: string | null;
  academic_year_id: string | null;
  session_label: string | null;
  register_date: string;
  period_label: string;
  day_of_week: number | null;
  lesson_summary: string | null;
  lesson_objectives: string | null;
  teaching_methods: string | null;
  homework: string | null;
  participation_summary: string | null;
  teacher_signature: string | null;
  status: ClassRegisterStatus;
  submitted_at: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  reviewer_name: string | null;
  admin_feedback: string | null;
  locked: boolean;
  created_at: string;
  updated_at: string;
  classes?: { name: string } | null;
  subjects?: { name: string } | null;
  teachers?: { id: string; profiles?: { full_name: string } | null } | null;
};

export type RegisterStudentEntry = {
  id: string;
  register_id: string;
  student_id: string;
  attendance_status: string;
  time_in: string | null;
  participation: string | null;
  remarks: string | null;
  behavior_remark: string | null;
  students?: {
    id: string;
    admission_no: string | null;
    profiles?: { full_name: string } | null;
  } | null;
};

export type RegisterWithEntries = ClassRegister & {
  entries: RegisterStudentEntry[];
};

export type RegisterDashboardStats = {
  totalClasses: number;
  registersSubmitted: number;
  registersExpected: number;
  pendingApproval: number;
  attendanceTodayPercent: number;
  attendanceTrend: number;
  absentToday: number;
  presentToday: number;
  lateToday: number;
};

export type RegisterCompletionItem = {
  registerId: string;
  label: string;
  status: ClassRegisterStatus;
  percent: number;
};

export type RegisterAlert = {
  id: string;
  severity: "warning" | "error" | "info";
  title: string;
  description: string;
};

export const DEFAULT_ATTENDANCE_STATUSES: Omit<AttendanceStatusType, "id" | "school_id">[] = [
  { code: "present", label: "Present", color: "#22c55e", sort_order: 1, is_active: true },
  { code: "absent", label: "Absent", color: "#ef4444", sort_order: 2, is_active: true },
  { code: "late", label: "Late", color: "#f97316", sort_order: 3, is_active: true },
  { code: "excused", label: "Excused", color: "#3b82f6", sort_order: 4, is_active: true },
  { code: "sick", label: "Sick", color: "#a855f7", sort_order: 5, is_active: true },
  { code: "suspended", label: "Suspended", color: "#6b7280", sort_order: 6, is_active: true },
];

export const REGISTER_STATUSES: ClassRegisterStatus[] = ["draft", "submitted", "approved", "rejected"];
