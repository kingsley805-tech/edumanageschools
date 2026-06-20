/// <reference path="../deno-shim.d.ts" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const CALENDAR_EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
].join(" ");

export const GOOGLE_MEET_ACTIONS = new Set([
  "auth_url",
  "exchange_code",
  "disconnect",
  "connection_status",
  "create_live_class",
  "record_join",
  "record_leave",
  "finalize_session",
]);

export function isGoogleMeetAction(action: unknown): action is string {
  return typeof action === "string" && GOOGLE_MEET_ACTIONS.has(action);
}

type TokenRow = {
  id: string;
  school_id: string;
  access_token: string;
  refresh_token: string | null;
  token_expires_at: string | null;
  google_email: string;
};

type JsonResponder = (body: unknown, status?: number) => Response;

function getEnv(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing environment variable: ${name}`);
  return v;
}

async function refreshAccessToken(
  supabase: ReturnType<typeof createClient>,
  row: TokenRow,
): Promise<string> {
  if (row.token_expires_at && new Date(row.token_expires_at).getTime() > Date.now() + 60_000) {
    return row.access_token;
  }
  if (!row.refresh_token) throw new Error("Google token expired. Reconnect your account.");

  const clientId = getEnv("GOOGLE_CLIENT_ID");
  const clientSecret = getEnv("GOOGLE_CLIENT_SECRET");

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: row.refresh_token,
      grant_type: "refresh_token",
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description ?? data.error ?? "Token refresh failed");

  const expiresAt = new Date(Date.now() + (data.expires_in ?? 3600) * 1000).toISOString();

  await supabase
    .from("google_workspace_connections")
    .update({
      access_token: data.access_token,
      token_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id);

  return data.access_token as string;
}

async function fetchGoogleConnection(supabase: ReturnType<typeof createClient>, schoolId: string) {
  const { data, error } = await supabase
    .from("google_workspace_connections")
    .select("*")
    .eq("school_id", schoolId)
    .maybeSingle();
  if (error) throw error;
  return data as TokenRow | null;
}

type CreateMeetingInput = {
  title: string;
  description?: string;
  startAt: string;
  endAt: string;
  timezone?: string;
  recurrence?: string[];
};

async function createGoogleMeetEvent(
  accessToken: string,
  input: CreateMeetingInput,
): Promise<{ meetLink: string; meetId: string; eventId: string }> {
  const requestId = crypto.randomUUID();
  const body: Record<string, unknown> = {
    summary: input.title,
    description: input.description ?? "",
    start: { dateTime: input.startAt, timeZone: input.timezone ?? "Africa/Accra" },
    end: { dateTime: input.endAt, timeZone: input.timezone ?? "Africa/Accra" },
    conferenceData: {
      createRequest: {
        requestId,
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    },
  };
  if (input.recurrence?.length) body.recurrence = input.recurrence;

  const res = await fetch(`${CALENDAR_EVENTS_URL}?conferenceDataVersion=1`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message ?? "Failed to create Google Meet event");

  const entryPoints = data.conferenceData?.entryPoints ?? [];
  const video = entryPoints.find((e: { entryPointType?: string }) => e.entryPointType === "video");
  const meetLink = video?.uri ?? data.hangoutLink ?? "";
  const meetId = data.conferenceData?.conferenceId ?? data.id ?? "";

  return { meetLink, meetId, eventId: data.id as string };
}

function buildRecurrenceRule(
  type: string,
  startDate: string,
  endDate?: string | null,
  customDays?: number[],
): string[] {
  const until = endDate ? endDate.replace(/-/g, "") + "T235959Z" : undefined;
  const untilPart = until ? `;UNTIL=${until}` : "";
  switch (type) {
    case "daily":
      return [`RRULE:FREQ=DAILY${untilPart}`];
    case "weekly":
      if (customDays?.length) {
        const days = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
        const byday = customDays.map((d) => days[d]).join(",");
        return [`RRULE:FREQ=WEEKLY;BYDAY=${byday}${untilPart}`];
      }
      return [`RRULE:FREQ=WEEKLY${untilPart}`];
    case "monthly":
      return [`RRULE:FREQ=MONTHLY${untilPart}`];
    default:
      return [];
  }
}

function generateSessionDates(
  startDate: string,
  recurrenceType: string,
  endDate: string | null,
  customDays: number[] = [],
  maxSessions = 52,
): string[] {
  const dates: string[] = [startDate];
  if (recurrenceType === "none") return dates;

  const start = new Date(startDate + "T12:00:00");
  const end = endDate ? new Date(endDate + "T12:00:00") : null;
  let current = new Date(start);

  while (dates.length < maxSessions) {
    if (recurrenceType === "daily") {
      current.setDate(current.getDate() + 1);
    } else if (recurrenceType === "weekly") {
      current.setDate(current.getDate() + 1);
      if (!customDays.length || customDays.includes(current.getDay())) {
        if (current > start) dates.push(current.toISOString().slice(0, 10));
      }
      if (customDays.length && !customDays.includes(current.getDay())) continue;
    } else if (recurrenceType === "monthly") {
      current.setMonth(current.getMonth() + 1);
      dates.push(current.toISOString().slice(0, 10));
    } else {
      break;
    }
    if (end && current > end) break;
    if (recurrenceType === "daily") dates.push(current.toISOString().slice(0, 10));
  }

  return [...new Set(dates)].sort();
}

/** Google Meet / Calendar OAuth and live-class actions (shared by google-meet and paystack functions). */
export async function handleGoogleMeet(
  body: Record<string, unknown>,
  authHeader: string | null,
  env: { supabaseUrl: string; supabaseAnon: string; serviceKey: string },
  jsonResponse: JsonResponder,
): Promise<Response> {
  try {
    if (!authHeader) return jsonResponse({ error: "Unauthorized" }, 401);

    const userClient = createClient(env.supabaseUrl, env.supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(env.supabaseUrl, env.serviceKey);

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return jsonResponse({ error: "Unauthorized" }, 401);

    const action = body.action as string;

    const { data: profile } = await userClient
      .from("profiles")
      .select("school_id")
      .eq("id", userData.user.id)
      .maybeSingle();

    const schoolId = (body.schoolId as string | undefined) ?? profile?.school_id;
    if (!schoolId && action !== "exchange_code") {
      return jsonResponse({ error: "School context required" }, 400);
    }

    if (action === "auth_url") {
      const clientId = getEnv("GOOGLE_CLIENT_ID");
      const redirectUri = (body.redirectUri as string | undefined) ?? getEnv("GOOGLE_REDIRECT_URI");
      const state = btoa(JSON.stringify({ schoolId, userId: userData.user.id }));
      const url = `${GOOGLE_AUTH_URL}?${new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: SCOPES,
        access_type: "offline",
        prompt: "consent",
        state,
      })}`;
      return jsonResponse({ url });
    }

    if (action === "exchange_code") {
      const code = body.code as string | undefined;
      const redirectUri = body.redirectUri as string | undefined;
      if (!code) return jsonResponse({ error: "Missing code" }, 400);

      const clientId = getEnv("GOOGLE_CLIENT_ID");
      const clientSecret = getEnv("GOOGLE_CLIENT_SECRET");
      const redirect = redirectUri ?? getEnv("GOOGLE_REDIRECT_URI");

      const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirect,
          grant_type: "authorization_code",
        }),
      });
      const tokens = await tokenRes.json();
      if (!tokenRes.ok) {
        return jsonResponse({ error: tokens.error_description ?? "OAuth failed" }, 400);
      }

      const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const userInfo = await userInfoRes.json();
      if (!userInfoRes.ok) return jsonResponse({ error: "Failed to fetch Google profile" }, 400);

      let parsedSchoolId = schoolId;
      if (body.state) {
        try {
          const parsed = JSON.parse(atob(String(body.state)));
          parsedSchoolId = parsed.schoolId ?? parsedSchoolId;
        } catch {
          /* ignore */
        }
      }

      const expiresAt = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString();

      const { error: upsertErr } = await adminClient.from("google_workspace_connections").upsert(
        {
          school_id: parsedSchoolId,
          google_account_id: userInfo.id,
          google_email: userInfo.email,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token ?? null,
          token_expires_at: expiresAt,
          scopes: SCOPES.split(" "),
          connected_by: userData.user.id,
          connected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "school_id" },
      );
      if (upsertErr) return jsonResponse({ error: upsertErr.message }, 500);

      await adminClient.from("live_class_audit_logs").insert({
        school_id: parsedSchoolId,
        actor_id: userData.user.id,
        action: "google_connected",
        entity_type: "google_workspace_connections",
        metadata: { email: userInfo.email },
      });

      return jsonResponse({ success: true, email: userInfo.email });
    }

    if (action === "disconnect") {
      await adminClient.from("google_workspace_connections").delete().eq("school_id", schoolId);
      await adminClient.from("live_class_audit_logs").insert({
        school_id: schoolId,
        actor_id: userData.user.id,
        action: "google_disconnected",
        entity_type: "google_workspace_connections",
      });
      return jsonResponse({ success: true });
    }

    if (action === "connection_status") {
      const conn = await fetchGoogleConnection(adminClient, schoolId!);
      return jsonResponse({
        connected: !!conn,
        email: conn?.google_email ?? null,
        expiresAt: conn?.token_expires_at ?? null,
      });
    }

    if (action === "create_live_class") {
      const {
        classId,
        subjectId,
        teacherId,
        title,
        description,
        sessionDate,
        startTime,
        endTime,
        timezone,
        recurrenceType,
        recurrenceEndDate,
        recurrenceRule,
        recordingEnabled,
        scheduleId,
      } = body;

      const conn = await fetchGoogleConnection(adminClient, schoolId!);
      if (!conn) {
        return jsonResponse({ error: "Connect Google Workspace before creating live classes." }, 400);
      }

      const accessToken = await refreshAccessToken(adminClient, conn);

      const tz = (timezone as string | undefined) ?? "Africa/Accra";
      const customDays: number[] = (recurrenceRule as { daysOfWeek?: number[] } | undefined)?.daysOfWeek ?? [];
      const sessionDates = generateSessionDates(
        sessionDate as string,
        (recurrenceType as string | undefined) ?? "none",
        (recurrenceEndDate as string | null | undefined) ?? null,
        customDays,
      );

      const recurrence = buildRecurrenceRule(
        (recurrenceType as string | undefined) ?? "none",
        sessionDate as string,
        recurrenceEndDate as string | null | undefined,
        customDays,
      );

      const firstStart = `${sessionDate}T${startTime}`;
      const firstEnd = `${sessionDate}T${endTime}`;

      const meet = await createGoogleMeetEvent(accessToken, {
        title: title as string,
        description: description as string | undefined,
        startAt: firstStart,
        endAt: firstEnd,
        timezone: tz,
        recurrence: recurrence.length ? recurrence : undefined,
      });

      const { data: liveClass, error: lcErr } = await userClient
        .from("live_classes")
        .insert({
          school_id: schoolId,
          class_id: classId,
          subject_id: subjectId,
          teacher_id: teacherId,
          schedule_id: (scheduleId as string | null | undefined) ?? null,
          title,
          description,
          session_date: sessionDate,
          start_time: startTime,
          end_time: endTime,
          timezone: tz,
          recurrence_type: (recurrenceType as string | undefined) ?? "none",
          recurrence_rule: (recurrenceRule as Record<string, unknown> | undefined) ?? {},
          recurrence_end_date: (recurrenceEndDate as string | null | undefined) ?? null,
          recording_enabled: (recordingEnabled as boolean | undefined) ?? false,
          status: "scheduled",
          created_by: userData.user.id,
        })
        .select()
        .single();
      if (lcErr) return jsonResponse({ error: lcErr.message }, 500);

      const sessions = sessionDates.map((date, idx) => ({
        live_class_id: liveClass.id,
        school_id: schoolId,
        class_id: classId,
        subject_id: subjectId,
        teacher_id: teacherId,
        schedule_id: (scheduleId as string | null | undefined) ?? null,
        title,
        description,
        session_date: date,
        start_at: `${date}T${startTime}`,
        end_at: `${date}T${endTime}`,
        meet_link: meet.meetLink,
        meet_id: meet.meetId,
        google_event_id: idx === 0 ? meet.eventId : null,
        status: "scheduled",
      }));

      const { data: insertedSessions, error: sessErr } = await userClient
        .from("live_class_sessions")
        .insert(sessions)
        .select();
      if (sessErr) return jsonResponse({ error: sessErr.message }, 500);

      if (scheduleId) {
        await userClient.from("schedules").update({ status: "published" }).eq("id", scheduleId);
      } else {
        const dayOfWeek = new Date(String(sessionDate) + "T12:00:00").getDay();
        await userClient.from("schedules").insert({
          school_id: schoolId,
          class_id: classId,
          subject_id: subjectId,
          teacher_id: teacherId,
          day_of_week: dayOfWeek,
          start_time: startTime,
          end_time: endTime,
          room: "Google Meet",
          status: "published",
        });
      }

      await adminClient.from("live_class_audit_logs").insert({
        school_id: schoolId,
        actor_id: userData.user.id,
        action: "live_class_created",
        entity_type: "live_classes",
        entity_id: liveClass.id,
        metadata: { sessionCount: sessions.length, meetLink: meet.meetLink },
      });

      return jsonResponse({ liveClass, sessions: insertedSessions, meetLink: meet.meetLink });
    }

    if (action === "record_join") {
      const { sessionId, studentId } = body;
      const now = new Date().toISOString();

      const { data: existing } = await userClient
        .from("live_class_attendance")
        .select("*")
        .eq("session_id", sessionId)
        .eq("student_id", studentId)
        .maybeSingle();

      if (existing?.join_time) return jsonResponse({ attendance: existing });

      const { data, error } = await userClient
        .from("live_class_attendance")
        .upsert(
          {
            session_id: sessionId,
            student_id: studentId,
            join_time: now,
            status: "present",
          },
          { onConflict: "session_id,student_id" },
        )
        .select()
        .single();
      if (error) return jsonResponse({ error: error.message }, 500);

      await userClient
        .from("live_class_sessions")
        .update({ status: "live" })
        .eq("id", sessionId)
        .in("status", ["scheduled", "live"]);

      return jsonResponse({ attendance: data });
    }

    if (action === "record_leave") {
      const { sessionId, studentId } = body;
      const now = new Date().toISOString();

      const { data: existing } = await userClient
        .from("live_class_attendance")
        .select("*")
        .eq("session_id", sessionId)
        .eq("student_id", studentId)
        .maybeSingle();

      if (!existing) return jsonResponse({ error: "No join record" }, 400);

      const duration = existing.join_time
        ? Math.floor((Date.now() - new Date(existing.join_time).getTime()) / 1000)
        : 0;

      const { data, error } = await userClient
        .from("live_class_attendance")
        .update({ leave_time: now, duration_seconds: duration })
        .eq("session_id", sessionId)
        .eq("student_id", studentId)
        .select()
        .single();
      if (error) return jsonResponse({ error: error.message }, 500);

      return jsonResponse({ attendance: data });
    }

    if (action === "finalize_session") {
      const { sessionId } = body;
      const { error } = await userClient.rpc("finalize_live_class_session", {
        p_session_id: sessionId,
      });
      if (error) return jsonResponse({ error: error.message }, 500);
      return jsonResponse({ success: true });
    }

    return jsonResponse({ error: "Unknown action" }, 400);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Internal error";
    return jsonResponse({ error: message }, 500);
  }
}
