import { supabase } from "@/integrations/supabase/client";
import { isMissingSchemaTableError } from "@/report/lib/supabase-errors";
import type {
  CreateLiveClassInput,
  GoogleConnection,
  LiveClass,
  LiveClassAnalytics,
  LiveClassAttendance,
  LiveClassRecording,
  LiveClassResource,
  LiveClassSession,
  SessionStatus,
  StudentOnlineAttendance,
} from "./types";

export type { SessionStatus };

const SESSION_SELECT = `
  id, live_class_id, school_id, class_id, subject_id, teacher_id,
  title, description, session_date, start_at, end_at,
  meet_link, meet_id, google_event_id, status,
  classes(name), subjects(name),
  teachers(profiles(full_name))
`;

export const LIVE_CLASSES_SETUP_HINT =
  "Live Classes tables are not set up yet. Run public/sql/apply-live-classes.sql in the Supabase SQL Editor, then refresh.";

function isLiveClassesUnavailable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (isMissingSchemaTableError(error)) return true;
  if (error.code === "42P01") return true;
  const msg = (error.message ?? "").toLowerCase();
  return msg.includes("live_class") && (msg.includes("does not exist") || msg.includes("could not find"));
}

async function invokeGoogleMeet<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("google-meet", { body });
  if (error) {
    const msg = error.message ?? "";
    if (
      msg.includes("Failed to fetch") ||
      msg.includes("FunctionsFetchError") ||
      msg.includes("CORS")
    ) {
      throw new Error(
        "Google Meet service is not available. Deploy the google-meet edge function (npm run functions:deploy) and set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI in Supabase.",
      );
    }
    throw error;
  }
  if (data?.error) throw new Error(String(data.error));
  return data as T;
}

export async function fetchGoogleConnection(schoolId: string): Promise<GoogleConnection> {
  return invokeGoogleMeet({ action: "connection_status", schoolId });
}

export async function getGoogleAuthUrl(schoolId: string, redirectUri: string): Promise<string> {
  const data = await invokeGoogleMeet<{ url: string }>({
    action: "auth_url",
    schoolId,
    redirectUri,
  });
  return data.url;
}

export async function exchangeGoogleCode(
  code: string,
  redirectUri: string,
  state?: string,
): Promise<{ success: boolean; email: string }> {
  return invokeGoogleMeet({ action: "exchange_code", code, redirectUri, state });
}

export async function disconnectGoogle(schoolId: string): Promise<void> {
  await invokeGoogleMeet({ action: "disconnect", schoolId });
}

export async function createLiveClass(input: CreateLiveClassInput) {
  return invokeGoogleMeet<{
    liveClass: LiveClass;
    sessions: LiveClassSession[];
    meetLink: string;
  }>({
    action: "create_live_class",
    schoolId: input.schoolId,
    classId: input.classId,
    subjectId: input.subjectId,
    teacherId: input.teacherId,
    title: input.title,
    description: input.description,
    sessionDate: input.sessionDate,
    startTime: input.startTime,
    endTime: input.endTime,
    timezone: input.timezone,
    recurrenceType: input.recurrenceType ?? "none",
    recurrenceEndDate: input.recurrenceEndDate,
    recurrenceRule: input.recurrenceRule,
    recordingEnabled: input.recordingEnabled,
    scheduleId: input.scheduleId,
  });
}

export async function fetchLiveClassSessions(opts: {
  schoolId?: string;
  classId?: string;
  teacherId?: string;
  fromDate?: string;
  toDate?: string;
  limit?: number;
}): Promise<LiveClassSession[]> {
  let q = supabase
    .from("live_class_sessions")
    .select(SESSION_SELECT)
    .order("start_at", { ascending: true });

  if (opts.schoolId) q = q.eq("school_id", opts.schoolId);
  if (opts.classId) q = q.eq("class_id", opts.classId);
  if (opts.teacherId) q = q.eq("teacher_id", opts.teacherId);
  if (opts.fromDate) q = q.gte("session_date", opts.fromDate);
  if (opts.toDate) q = q.lte("session_date", opts.toDate);
  if (opts.limit) q = q.limit(opts.limit);

  const { data, error } = await q;
  if (error) {
    if (isLiveClassesUnavailable(error)) return [];
    throw error;
  }
  return (data ?? []) as LiveClassSession[];
}

export async function fetchSessionById(sessionId: string): Promise<LiveClassSession | null> {
  const { data, error } = await supabase
    .from("live_class_sessions")
    .select(SESSION_SELECT)
    .eq("id", sessionId)
    .maybeSingle();
  if (error) {
    if (isLiveClassesUnavailable(error)) return null;
    throw error;
  }
  return data as LiveClassSession | null;
}

export async function isLiveClassesSchemaReady(): Promise<boolean> {
  const { error } = await supabase.from("live_class_sessions").select("id").limit(1);
  return !isLiveClassesUnavailable(error);
}

export async function fetchLiveClasses(schoolId: string): Promise<LiveClass[]> {
  const { data, error } = await supabase
    .from("live_classes")
    .select(
      `*, classes(name), subjects(name), teachers(profiles(full_name))`,
    )
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as LiveClass[];
}

export async function recordJoin(sessionId: string, studentId: string) {
  return invokeGoogleMeet({ action: "record_join", sessionId, studentId });
}

export async function recordLeave(sessionId: string, studentId: string) {
  return invokeGoogleMeet({ action: "record_leave", sessionId, studentId });
}

export async function finalizeSession(sessionId: string) {
  return invokeGoogleMeet({ action: "finalize_session", sessionId });
}

export async function fetchSessionAttendance(sessionId: string): Promise<LiveClassAttendance[]> {
  const { data, error } = await supabase
    .from("live_class_attendance")
    .select("*, students(full_name, profiles:profile_id(full_name))")
    .eq("session_id", sessionId);
  if (error) throw error;
  return (data ?? []) as LiveClassAttendance[];
}

export async function fetchLiveClassResources(liveClassId: string): Promise<LiveClassResource[]> {
  const { data, error } = await supabase
    .from("live_class_resources")
    .select("*")
    .eq("live_class_id", liveClassId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as LiveClassResource[];
}

export async function addLiveClassResource(input: {
  liveClassId: string;
  schoolId: string;
  title: string;
  resourceType: string;
  fileUrl?: string;
  fileName?: string;
  mimeType?: string;
  uploadedBy: string;
}) {
  const { data, error } = await supabase
    .from("live_class_resources")
    .insert({
      live_class_id: input.liveClassId,
      school_id: input.schoolId,
      title: input.title,
      resource_type: input.resourceType,
      file_url: input.fileUrl ?? null,
      file_name: input.fileName ?? null,
      mime_type: input.mimeType ?? null,
      uploaded_by: input.uploadedBy,
    })
    .select()
    .single();
  if (error) throw error;
  return data as LiveClassResource;
}

export async function fetchSessionRecordings(sessionId: string): Promise<LiveClassRecording[]> {
  const { data, error } = await supabase
    .from("live_class_recordings")
    .select("*")
    .eq("session_id", sessionId)
    .order("recording_date", { ascending: false });
  if (error) throw error;
  return (data ?? []) as LiveClassRecording[];
}

export async function addSessionRecording(input: {
  sessionId: string;
  schoolId: string;
  recordingUrl: string;
  durationSeconds?: number;
  title?: string;
}) {
  const { data, error } = await supabase
    .from("live_class_recordings")
    .insert({
      session_id: input.sessionId,
      school_id: input.schoolId,
      recording_url: input.recordingUrl,
      duration_seconds: input.durationSeconds ?? null,
      title: input.title ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as LiveClassRecording;
}

export function getSessionStatus(session: LiveClassSession): SessionStatus {
  const now = Date.now();
  const start = new Date(session.start_at).getTime();
  const end = new Date(session.end_at).getTime();
  if (session.status === "cancelled" || session.status === "ended") return session.status;
  if (now >= start && now <= end) return "live";
  if (now > end) return "ended";
  return "scheduled";
}

export async function fetchSchoolLiveAnalytics(schoolId: string): Promise<LiveClassAnalytics> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const from = thirtyDaysAgo.toISOString().slice(0, 10);

  const [sessionsRes, classesRes, attendanceRes] = await Promise.all([
    supabase
      .from("live_class_sessions")
      .select("id, session_date, teacher_id, teachers(profiles(full_name))")
      .eq("school_id", schoolId)
      .gte("session_date", from),
    supabase.from("live_classes").select("id", { count: "exact", head: true }).eq("school_id", schoolId),
    supabase
      .from("live_class_attendance")
      .select("status, duration_seconds, session_id, live_class_sessions!inner(school_id)")
      .eq("live_class_sessions.school_id", schoolId),
  ]);

  const sessions = sessionsRes.data ?? [];
  const attendance = attendanceRes.data ?? [];
  const present = attendance.filter((a) => a.status === "present" || a.status === "late").length;
  const totalAtt = attendance.length || 1;
  const avgDuration =
    attendance.length > 0
      ? Math.round(
          attendance.reduce((s, a) => s + (a.duration_seconds ?? 0), 0) / attendance.length / 60,
        )
      : 0;

  const teacherMap = new Map<string, { name: string; sessions: number }>();
  for (const s of sessions) {
    const name =
      (s.teachers as { profiles?: { full_name?: string } })?.profiles?.full_name ?? "Teacher";
    const cur = teacherMap.get(s.teacher_id) ?? { name, sessions: 0 };
    cur.sessions += 1;
    teacherMap.set(s.teacher_id, cur);
  }

  const dailyMap = new Map<string, number>();
  for (const s of sessions) {
    dailyMap.set(s.session_date, (dailyMap.get(s.session_date) ?? 0) + 1);
  }

  return {
    totalSessions: sessions.length,
    totalClasses: classesRes.count ?? 0,
    attendanceRate: Math.round((present / totalAtt) * 100),
    avgDurationMinutes: avgDuration,
    topTeachers: [...teacherMap.values()].sort((a, b) => b.sessions - a.sessions).slice(0, 5),
    dailyActivity: [...dailyMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({
        date: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        sessions: count,
      })),
    weeklyAttendance: [],
  };
}

export async function fetchStudentOnlineAttendance(studentId: string): Promise<StudentOnlineAttendance> {
  const { data: student } = await supabase
    .from("students")
    .select("class_id")
    .eq("id", studentId)
    .maybeSingle();
  if (!student?.class_id) {
    return { totalClasses: 0, attended: 0, missed: 0, rate: 0 };
  }

  const { data: sessions } = await supabase
    .from("live_class_sessions")
    .select("id")
    .eq("class_id", student.class_id)
    .eq("status", "ended");

  const sessionIds = (sessions ?? []).map((s) => s.id);
  const total = sessionIds.length;
  if (!total) return { totalClasses: 0, attended: 0, missed: 0, rate: 0 };

  const { data: att } = await supabase
    .from("live_class_attendance")
    .select("status")
    .eq("student_id", studentId)
    .in("session_id", sessionIds);

  const attended = (att ?? []).filter((a) => a.status === "present" || a.status === "late").length;
  const missed = total - attended;

  return {
    totalClasses: total,
    attended,
    missed,
    rate: Math.round((attended / total) * 100),
  };
}

export async function fetchSchoolId(userId: string): Promise<string | null> {
  const { data } = await supabase.from("profiles").select("school_id").eq("id", userId).maybeSingle();
  return data?.school_id ?? null;
}
