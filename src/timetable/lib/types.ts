export type TimetablePeriodType = "period" | "break" | "lunch";
export type TimetableEntryStatus = "draft" | "published";

export type TimetablePeriod = {
  id: string;
  school_id: string;
  name: string;
  start_time: string;
  end_time: string;
  period_type: TimetablePeriodType;
  sort_order: number;
};

export type TimetableSettings = {
  id: string;
  school_id: string;
  school_open_time: string;
  school_close_time: string;
  period_duration_minutes: number;
  break_duration_minutes: number;
  lunch_duration_minutes: number;
  periods_per_day: number;
  include_saturday: boolean;
};

export type ClassSubjectOption = {
  subjectId: string;
  subjectName: string;
  teacherId: string | null;
  teacherName: string | null;
};

export type ScheduleEntry = {
  id: string;
  class_id: string;
  subject_id: string;
  teacher_id: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  room: string | null;
  school_id?: string | null;
  term_id?: string | null;
  academic_year_id?: string | null;
  period_id?: string | null;
  status: TimetableEntryStatus;
  classes?: { name: string } | null;
  subjects?: { name: string; code?: string } | null;
  teachers?: { id: string; profiles?: { full_name: string } | null } | null;
};

export type TimetableConflict = {
  id: string;
  type: "teacher_overlap" | "room_overlap" | "class_overlap" | "subject_frequency";
  severity: "error" | "warning";
  title: string;
  description: string;
  scheduleIds: string[];
};

export type TeacherWorkload = {
  teacherId: string;
  teacherName: string;
  periodsPerWeek: number;
  maxPeriods: number;
  percent: number;
  status: "low" | "ok" | "high" | "overload";
};

export const WEEKDAYS = [
  { value: 1, label: "Monday", short: "Mon" },
  { value: 2, label: "Tuesday", short: "Tue" },
  { value: 3, label: "Wednesday", short: "Wed" },
  { value: 4, label: "Thursday", short: "Thu" },
  { value: 5, label: "Friday", short: "Fri" },
  { value: 6, label: "Saturday", short: "Sat" },
] as const;

export const DEFAULT_PERIODS: Omit<TimetablePeriod, "id" | "school_id">[] = [
  { name: "Period 1", start_time: "08:00", end_time: "08:40", period_type: "period", sort_order: 1 },
  { name: "Period 2", start_time: "08:40", end_time: "09:20", period_type: "period", sort_order: 2 },
  { name: "Break", start_time: "09:20", end_time: "09:40", period_type: "break", sort_order: 3 },
  { name: "Period 3", start_time: "09:40", end_time: "10:20", period_type: "period", sort_order: 4 },
  { name: "Period 4", start_time: "10:20", end_time: "11:00", period_type: "period", sort_order: 5 },
  { name: "Lunch", start_time: "11:00", end_time: "11:40", period_type: "lunch", sort_order: 6 },
  { name: "Period 5", start_time: "11:40", end_time: "12:20", period_type: "period", sort_order: 7 },
  { name: "Period 6", start_time: "12:20", end_time: "13:00", period_type: "period", sort_order: 8 },
];
