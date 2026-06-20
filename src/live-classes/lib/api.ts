import { supabase } from "@/integrations/supabase/client";
import { invokeEdgeFunction } from "@/lib/invokeEdgeFunction";
import { isMissingRpcError, isMissingSchemaTableError } from "@/report/lib/supabase-errors";
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
  "Live Classes tables are missing on Supabase. Open SQL Editor → run public/sql/apply-live-classes.sql → refresh this page.";

export const LIVE_CLASSES_SETUP_SQL_URL =
  "https://supabase.com/dashboard/project/xbhhpjtwawfawifhpxbe/sql/new";

export const GOOGLE_MEET_SETUP_HINT =
  "Run public/sql/apply-create-live-class-rpc.sql in Supabase SQL Editor (or deploy the paystack Edge Function).";

export const GOOGLE_MEET_FUNCTIONS_URL =
  "https://supabase.com/dashboard/project/xbhhpjtwawfawifhpxbe/functions/paystack/details";

let liveClassesSchemaReady: boolean | null = null;

function isLiveClassesUnavailable(error: { code?: string; message?: string; status?: number } | null): boolean {
  if (!error) return false;
  if (error.status === 404) return true;
  if (isMissingSchemaTableError(error)) return true;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  const msg = (error.message ?? "").toLowerCase();
  return (
    msg.includes("live_class") ||
    msg.includes("could not find the table") ||
    (msg.includes("relation") && msg.includes("does not exist"))
  );
}

function isEdgeFunctionMissing(error: unknown): boolean {
  if (isEdgeFunctionUnreachable(error)) return true;
  if (error && typeof error === "object") {
    const e = error as { message?: string; name?: string; context?: Response };
    if (e.name === "FunctionsFetchError") return true;
    const msg = (e.message ?? "").trim().toLowerCase();
    if (
      msg.includes("failed to send a request to the edge function") ||
      msg.includes("failed to fetch") ||
      msg.includes("cors") ||
      msg.includes("not found") ||
      msg.includes("not reachable") ||
      msg.includes("404")
    ) {
      return true;
    }
    if (e.context?.status === 404) return true;
  }
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return msg.includes("not found") || msg.includes("not reachable") || msg.includes("404");
  }
  return false;
}

async function invokeGoogleMeet<T>(body: Record<string, unknown>): Promise<T> {
  const attempts = [
    () => invokeEdgeFunction<T>("paystack", body),
    () => invokeEdgeFunction<T>("google-meet", body),
  ];

  let lastError: unknown;
  for (const attempt of attempts) {
    try {
      return await attempt();
    } catch (error) {
      if (isEdgeFunctionMissing(error)) {
        lastError = error;
        continue;
      }
      throw error;
    }
  }

  throw new Error(
    lastError instanceof Error && lastError.message
      ? lastError.message
      : GOOGLE_MEET_SETUP_HINT,
  );
}

export const GOOGLE_OAUTH_SETUP_HINT =
  "Run public/sql/apply-live-classes.sql in Supabase SQL Editor once (includes Google OAuth RPCs), then Settings → API → Reload schema.";

export async function isGoogleOAuthSchemaReady(): Promise<boolean> {
  const { error } = await supabase.rpc("get_google_oauth_public_config", {
    p_school_id: "00000000-0000-0000-0000-000000000001",
  });
  if (!error) return true;
  if (isMissingRpcError(error)) {
    const { error: tableErr } = await supabase
      .from("school_google_oauth_config")
      .select("school_id")
      .limit(1);
    return !isMissingSchemaTableError(tableErr);
  }
  return true;
}

async function fetchGoogleOAuthConfigDirect(schoolId: string): Promise<{
  configured: boolean;
  clientId?: string;
  redirectUri?: string;
}> {
  const { data, error } = await supabase
    .from("school_google_oauth_config")
    .select("client_id, redirect_uri")
    .eq("school_id", schoolId)
    .maybeSingle();

  if (error) {
    if (isMissingSchemaTableError(error)) return { configured: false };
    throw error;
  }

  return {
    configured: !!data,
    clientId: data?.client_id ?? undefined,
    redirectUri: data?.redirect_uri ?? undefined,
  };
}

export async function fetchGoogleOAuthConfig(schoolId: string): Promise<{
  configured: boolean;
  clientId?: string;
  redirectUri?: string;
  schemaReady: boolean;
}> {
  const { data, error } = await supabase.rpc("get_google_oauth_public_config", {
    p_school_id: schoolId,
  });
  if (error) {
    if (isMissingRpcError(error)) {
      const direct = await fetchGoogleOAuthConfigDirect(schoolId);
      const { error: tableErr } = await supabase
        .from("school_google_oauth_config")
        .select("school_id")
        .limit(1);
      return { ...direct, schemaReady: !isMissingSchemaTableError(tableErr) };
    }
    if (isMissingSchemaTableError(error)) {
      return { configured: false, schemaReady: false };
    }
    throw new Error(error.message);
  }
  const row = data as {
    configured?: boolean;
    client_id?: string;
    redirect_uri?: string;
    error?: string;
  } | null;
  if (row?.error) throw new Error(row.error);
  return {
    configured: !!row?.configured,
    clientId: row?.client_id,
    redirectUri: row?.redirect_uri,
    schemaReady: true,
  };
}

export async function saveGoogleOAuthConfig(
  schoolId: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
): Promise<void> {
  const { data, error } = await supabase.rpc("upsert_google_oauth_config", {
    p_school_id: schoolId,
    p_client_id: clientId,
    p_client_secret: clientSecret,
    p_redirect_uri: redirectUri,
  });

  if (error && isMissingRpcError(error)) {
    const { error: upsertErr } = await supabase.from("school_google_oauth_config").upsert(
      {
        school_id: schoolId,
        client_id: clientId.trim(),
        client_secret: clientSecret.trim(),
        redirect_uri:
          redirectUri.trim() || "http://localhost:8080/admin/online-learning/oauth/callback",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "school_id" },
    );
    if (upsertErr) {
      throw new Error(
        isMissingSchemaTableError(upsertErr) ? GOOGLE_OAUTH_SETUP_HINT : upsertErr.message,
      );
    }
    return;
  }

  if (error) throw new Error(error.message);
  const row = data as { ok?: boolean; error?: string } | null;
  if (row?.error) throw new Error(row.error);
  if (!row?.ok) throw new Error("Failed to save Google OAuth settings");
}

const GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar";

export const GOOGLE_OAUTH_SCOPES = [
  GOOGLE_CALENDAR_SCOPE,
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
].join(" ");

export const GOOGLE_CALENDAR_SCOPE_HINT =
  "Google Calendar access is required for Meet links. In Google Cloud Console → OAuth consent screen → Scopes, add " +
  `"${GOOGLE_CALENDAR_SCOPE}" (or calendar.events), plus openid, email, and profile. ` +
  "Enable the Google Calendar API, then Disconnect and Connect again on this page.";

export function connectionHasCalendarScope(scopes: string[] | null | undefined): boolean {
  return (scopes ?? []).some(
    (s) =>
      s === GOOGLE_CALENDAR_SCOPE ||
      s.includes("calendar.events") ||
      s === "https://www.googleapis.com/auth/calendar",
  );
}

function formatGoogleScopeError(message: string): string {
  if (message.toLowerCase().includes("insufficient authentication scopes")) {
    return GOOGLE_CALENDAR_SCOPE_HINT;
  }
  return message;
}

export async function fetchGoogleConnection(schoolId: string): Promise<GoogleConnection> {
  const { data, error } = await supabase
    .from("google_workspace_connections")
    .select("google_email, token_expires_at, scopes")
    .eq("school_id", schoolId)
    .maybeSingle();

  if (error) {
    if (isLiveClassesUnavailable(error) || isMissingSchemaTableError(error)) {
      return { connected: false, email: null, expiresAt: null, hasCalendarScope: false };
    }
    throw error;
  }

  const scopes = (data?.scopes as string[] | null) ?? null;

  return {
    connected: !!data,
    email: data?.google_email ?? null,
    expiresAt: data?.token_expires_at ?? null,
    hasCalendarScope: connectionHasCalendarScope(scopes),
  };
}

export async function getGoogleAuthUrl(schoolId: string, redirectUri: string): Promise<string> {
  const cfg = await fetchGoogleOAuthConfig(schoolId);
  const clientId =
    cfg.clientId ?? (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined);
  const redirect = redirectUri || cfg.redirectUri;
  if (!clientId || !redirect) {
    throw new Error("Add your Google OAuth Client ID and Secret below, then try again.");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const state = btoa(JSON.stringify({ schoolId, userId: user?.id }));

  return `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirect,
    response_type: "code",
    scope: GOOGLE_OAUTH_SCOPES,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  })}`;
}

export async function exchangeGoogleCode(
  code: string,
  redirectUri: string,
  state?: string,
): Promise<{ success: boolean; email: string }> {
  const { data, error } = await supabase.rpc("exchange_google_oauth_code", {
    p_code: code,
    p_redirect_uri: redirectUri,
    p_state: state ?? null,
  });

  if (!error && data) {
    const row = data as { ok?: boolean; email?: string; error?: string };
    if (row.ok && row.email) return { success: true, email: row.email };
    if (row.error) throw new Error(row.error);
  }

  if (error && !isMissingRpcError(error)) {
    throw new Error(error.message);
  }

  try {
    return await invokeGoogleMeet({ action: "exchange_code", code, redirectUri, state });
  } catch {
    throw new Error(GOOGLE_OAUTH_SETUP_HINT);
  }
}

export async function disconnectGoogle(schoolId: string): Promise<void> {
  const { error } = await supabase
    .from("google_workspace_connections")
    .delete()
    .eq("school_id", schoolId);
  if (error) throw error;
}

export async function createLiveClass(input: CreateLiveClassInput) {
  const { data, error } = await supabase.rpc("create_live_class_via_google", {
    p_school_id: input.schoolId,
    p_class_id: input.classId,
    p_subject_id: input.subjectId,
    p_teacher_id: input.teacherId,
    p_title: input.title,
    p_description: input.description ?? null,
    p_session_date: input.sessionDate,
    p_start_time: input.startTime,
    p_end_time: input.endTime,
    p_timezone: input.timezone ?? "Africa/Accra",
    p_recurrence_type: input.recurrenceType ?? "none",
    p_recurrence_end_date: input.recurrenceEndDate ?? null,
    p_recurrence_rule: input.recurrenceRule ?? {},
    p_recording_enabled: input.recordingEnabled ?? false,
    p_schedule_id: input.scheduleId ?? null,
  });

  if (!error && data) {
    const row = data as {
      ok?: boolean;
      error?: string;
      liveClass?: LiveClass;
      sessions?: LiveClassSession[];
      meetLink?: string;
    };
    if (row.ok && row.liveClass && row.sessions) {
      return {
        liveClass: row.liveClass,
        sessions: row.sessions,
        meetLink: row.meetLink ?? "",
      };
    }
    if (row.error) throw new Error(formatGoogleScopeError(row.error));
  }

  if (error && !isMissingRpcError(error)) {
    throw new Error(formatGoogleScopeError(error.message));
  }

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
  if (liveClassesSchemaReady === false) return [];
  if (liveClassesSchemaReady === null) {
    const ready = await isLiveClassesSchemaReady();
    if (!ready) return [];
  }

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
    if (isLiveClassesUnavailable(error)) {
      liveClassesSchemaReady = false;
      return [];
    }
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

export async function isLiveClassesSchemaReady(force = false): Promise<boolean> {
  if (!force && liveClassesSchemaReady !== null) return liveClassesSchemaReady;
  const { error } = await supabase.from("live_class_sessions").select("id").limit(1);
  liveClassesSchemaReady = !isLiveClassesUnavailable(error);
  return liveClassesSchemaReady;
}

export async function fetchLiveClasses(schoolId: string): Promise<LiveClass[]> {
  if (liveClassesSchemaReady === false) return [];
  if (liveClassesSchemaReady === null) {
    const ready = await isLiveClassesSchemaReady();
    if (!ready) return [];
  }

  const { data, error } = await supabase
    .from("live_classes")
    .select(
      `*, classes(name), subjects(name), teachers(profiles(full_name))`,
    )
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false });
  if (error) {
    if (isLiveClassesUnavailable(error)) {
      liveClassesSchemaReady = false;
      return [];
    }
    throw error;
  }
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
