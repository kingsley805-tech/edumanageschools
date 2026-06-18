export type RecurrenceType = "none" | "daily" | "weekly" | "monthly" | "custom";

export type LiveClassStatus = "draft" | "scheduled" | "live" | "ended" | "cancelled";
export type SessionStatus = "scheduled" | "live" | "ended" | "cancelled";
export type AttendanceStatus = "present" | "absent" | "late";

export type GoogleConnection = {
  connected: boolean;
  email: string | null;
  expiresAt: string | null;
};

export type LiveClass = {
  id: string;
  school_id: string;
  class_id: string;
  subject_id: string | null;
  teacher_id: string;
  schedule_id: string | null;
  title: string;
  description: string | null;
  session_date: string;
  start_time: string;
  end_time: string;
  timezone: string;
  recurrence_type: RecurrenceType;
  recurrence_rule: Record<string, unknown>;
  recurrence_end_date: string | null;
  status: LiveClassStatus;
  recording_enabled: boolean;
  created_at: string;
  classes?: { name: string } | null;
  subjects?: { name: string } | null;
  teachers?: { profiles?: { full_name?: string } | null } | null;
};

export type LiveClassSession = {
  id: string;
  live_class_id: string;
  school_id: string;
  class_id: string;
  subject_id: string | null;
  teacher_id: string;
  title: string;
  description: string | null;
  session_date: string;
  start_at: string;
  end_at: string;
  meet_link: string | null;
  meet_id: string | null;
  google_event_id: string | null;
  status: SessionStatus;
  classes?: { name: string } | null;
  subjects?: { name: string } | null;
  teachers?: { profiles?: { full_name?: string } | null } | null;
};

export type LiveClassResource = {
  id: string;
  live_class_id: string;
  title: string;
  resource_type: string;
  file_url: string | null;
  file_name: string | null;
  created_at: string;
};

export type LiveClassRecording = {
  id: string;
  session_id: string;
  recording_url: string;
  recording_date: string;
  duration_seconds: number | null;
  title: string | null;
};

export type LiveClassAttendance = {
  id: string;
  session_id: string;
  student_id: string;
  join_time: string | null;
  leave_time: string | null;
  duration_seconds: number;
  status: AttendanceStatus;
  students?: { full_name?: string; profiles?: { full_name?: string } | null } | null;
};

export type CreateLiveClassInput = {
  schoolId: string;
  classId: string;
  subjectId: string;
  teacherId: string;
  title: string;
  description?: string;
  sessionDate: string;
  startTime: string;
  endTime: string;
  timezone?: string;
  recurrenceType?: RecurrenceType;
  recurrenceEndDate?: string;
  recurrenceRule?: { daysOfWeek?: number[] };
  recordingEnabled?: boolean;
  scheduleId?: string;
};

export type LiveClassAnalytics = {
  totalSessions: number;
  totalClasses: number;
  attendanceRate: number;
  avgDurationMinutes: number;
  topTeachers: { name: string; sessions: number }[];
  dailyActivity: { date: string; sessions: number }[];
  weeklyAttendance: { week: string; present: number; absent: number }[];
};

export type StudentOnlineAttendance = {
  totalClasses: number;
  attended: number;
  missed: number;
  rate: number;
};
