import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ARKESEL_URL = "https://sms.arkesel.com/api/v2/sms/send";

function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("233") && digits.length >= 12) return digits;
  if (digits.startsWith("0") && digits.length >= 10) return `233${digits.slice(1)}`;
  if (digits.length === 9) return `233${digits}`;
  return digits.length >= 10 ? digits : null;
}

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("SUBSCRIPTION_EMAIL_FROM") || "School Hub <onboarding@resend.dev>";
  if (!apiKey || !to) return false;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });
  if (!res.ok) {
    console.error("Resend error:", await res.text());
    return false;
  }
  return true;
}

async function sendSms(phone: string, message: string): Promise<boolean> {
  const apiKey = Deno.env.get("ARKESEL_API_KEY");
  const sender = Deno.env.get("SUBSCRIPTION_SMS_SENDER") || Deno.env.get("ARKESEL_SENDER") || "SCHOOLHUB";
  if (!apiKey) return false;
  const normalized = normalizePhone(phone);
  if (!normalized) return false;
  const res = await fetch(ARKESEL_URL, {
    method: "POST",
    headers: { "api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ sender, message, recipients: [normalized] }),
  });
  if (!res.ok) {
    console.error("Arkesel error:", await res.text());
    return false;
  }
  return true;
}

/** Calendar date YYYY-MM-DD in a given IANA timezone. */
function dateInTimezone(tz: string, offsetDays = 0): string {
  const now = new Date();
  const shifted = new Date(now.getTime() + offsetDays * 86400000);
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: tz || "Africa/Accra",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(shifted);
  } catch {
    return shifted.toISOString().slice(0, 10);
  }
}

function localHourMinute(tz: string): { hour: number; minute: number } {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz || "Africa/Accra",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(new Date());
    const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
    const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
    return { hour, minute };
  } catch {
    const d = new Date();
    return { hour: d.getUTCHours(), minute: d.getUTCMinutes() };
  }
}

function parseTime(t: string | null | undefined): { hour: number; minute: number } {
  const m = String(t ?? "10:00").match(/^(\d{1,2}):(\d{2})/);
  if (!m) return { hour: 10, minute: 0 };
  return { hour: Number(m[1]), minute: Number(m[2]) };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const cronSecret = Deno.env.get("DAILY_SUMMARY_CRON_SECRET") ||
      Deno.env.get("SUBSCRIPTION_CRON_SECRET");
    const headerSecret = req.headers.get("x-cron-secret");
    const authHeader = req.headers.get("Authorization");

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceKey) {
      return new Response(JSON.stringify({ error: "Missing Supabase secrets" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const force = Boolean(body.force);
    const schoolIdFilter = (body.school_id as string) || null;
    const isManual = Boolean(body.manual);

    // Auth: cron secret OR authenticated admin
    let cronOk = Boolean(cronSecret && headerSecret && headerSecret === cronSecret);
    if (!cronOk && authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: caller } = await admin.auth.getUser(token);
      if (caller.user) {
        const { data: roles } = await admin
          .from("user_roles")
          .select("role")
          .eq("user_id", caller.user.id)
          .in("role", ["admin", "super_admin"]);
        cronOk = Boolean(roles && roles.length > 0);
      }
    }

    if (!cronOk) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let schoolsQuery = admin.from("schools").select("id, school_name, school_code, email, phone").eq("is_active", true);
    if (schoolIdFilter) schoolsQuery = schoolsQuery.eq("id", schoolIdFilter);
    const { data: schools, error: schoolsErr } = await schoolsQuery;
    if (schoolsErr) throw schoolsErr;

    const processed: Array<Record<string, unknown>> = [];

    for (const school of schools ?? []) {
      const { data: settings } = await admin
        .from("school_settings")
        .select(
          "timezone, daily_summary_enabled, daily_summary_time, alert_drop_threshold",
        )
        .eq("school_id", school.id)
        .maybeSingle();

      const tz = (settings as any)?.timezone || "Africa/Accra";
      const enabled = (settings as any)?.daily_summary_enabled ?? true;
      const summaryTime = parseTime((settings as any)?.daily_summary_time ?? "10:00");
      const dropThreshold = Number((settings as any)?.alert_drop_threshold ?? 20);

      if (!enabled && !force && !isManual) {
        processed.push({ school_id: school.id, skipped: "disabled" });
        continue;
      }

      // Hourly cron: only run when local time is within the configured hour (unless force/manual)
      if (!force && !isManual) {
        const local = localHourMinute(tz);
        if (local.hour !== summaryTime.hour) {
          processed.push({ school_id: school.id, skipped: "not_scheduled_hour", local });
          continue;
        }
      }

      const summaryDate = dateInTimezone(tz, -1); // previous completed calendar day

      if (!force) {
        const { data: existing } = await admin
          .from("daily_school_summaries")
          .select("id, delivery_status")
          .eq("school_id", school.id)
          .eq("summary_date", summaryDate)
          .maybeSingle();
        if (existing && existing.delivery_status === "delivered") {
          processed.push({ school_id: school.id, skipped: "already_delivered", summary_date: summaryDate });
          continue;
        }
      }

      const dayStart = `${summaryDate}T00:00:00`;
      const dayEnd = `${summaryDate}T23:59:59`;

      // Attendance from attendance_records if present, else class_registers entries count
      const { data: attendanceRows } = await admin
        .from("attendance_records")
        .select("attendance_status, class_id")
        .eq("attendance_date", summaryDate)
        .eq("school_id", school.id);

      let present = 0;
      let absent = 0;
      let totalAtt = 0;
      const absentByClass = new Map<string, { absent: number; total: number }>();

      for (const row of attendanceRows ?? []) {
        totalAtt += 1;
        const status = String(row.attendance_status ?? "").toLowerCase();
        if (status === "present" || status === "late") present += 1;
        if (status === "absent") absent += 1;
        const cid = row.class_id as string;
        if (cid) {
          const cur = absentByClass.get(cid) ?? { absent: 0, total: 0 };
          cur.total += 1;
          if (status === "absent") cur.absent += 1;
          absentByClass.set(cid, cur);
        }
      }

      const attendancePct = totalAtt > 0 ? Math.round((present / totalAtt) * 1000) / 10 : null;

      const unusualClasses: Array<{ class_id: string; absent_pct: number }> = [];
      for (const [cid, stats] of absentByClass) {
        if (!stats.total) continue;
        const pct = (stats.absent / stats.total) * 100;
        if (pct >= dropThreshold) unusualClasses.push({ class_id: cid, absent_pct: Math.round(pct * 10) / 10 });
      }

      const { count: studentsTotal } = await admin
        .from("students")
        .select("id", { count: "exact", head: true })
        .eq("school_id", school.id);

      const { count: newStudents } = await admin
        .from("students")
        .select("id", { count: "exact", head: true })
        .eq("school_id", school.id)
        .gte("created_at", dayStart)
        .lte("created_at", dayEnd);

      const { count: gradesEntered } = await admin
        .from("grades")
        .select("id, students!inner(school_id)", { count: "exact", head: true })
        .eq("students.school_id", school.id)
        .gte("created_at", dayStart)
        .lte("created_at", dayEnd);

      const { data: schoolClasses } = await admin
        .from("classes")
        .select("id")
        .eq("school_id", school.id);
      const classIdList = (schoolClasses ?? []).map((c) => c.id);
      const todayIso = dateInTimezone(tz, 0);
      const weekAhead = dateInTimezone(tz, 7);

      let assignmentsCreated = 0;
      let submissionsCount = 0;
      let upcomingExams = 0;
      if (classIdList.length) {
        const { count: aCount } = await admin
          .from("assignments")
          .select("id", { count: "exact", head: true })
          .in("class_id", classIdList)
          .gte("created_at", dayStart)
          .lte("created_at", dayEnd);
        assignmentsCreated = aCount ?? 0;

        const { data: assignmentIds } = await admin
          .from("assignments")
          .select("id")
          .in("class_id", classIdList);
        const aIds = (assignmentIds ?? []).map((a) => a.id);
        if (aIds.length) {
          const { count: sCount } = await admin
            .from("submissions")
            .select("id", { count: "exact", head: true })
            .in("assignment_id", aIds)
            .gte("created_at", dayStart)
            .lte("created_at", dayEnd);
          submissionsCount = sCount ?? 0;
        }

        const { count: eCount } = await admin
          .from("exams")
          .select("id", { count: "exact", head: true })
          .in("class_id", classIdList)
          .gte("exam_date", todayIso)
          .lte("exam_date", weekAhead);
        upcomingExams = eCount ?? 0;
      }

      const { data: registers } = await admin
        .from("class_registers")
        .select("teacher_id, submitted_at")
        .eq("school_id", school.id)
        .eq("register_date", summaryDate);

      const teachersSubmitted = new Set(
        (registers ?? []).filter((r) => r.submitted_at).map((r) => r.teacher_id),
      ).size;

      const { count: announcementsCount } = await admin
        .from("announcements")
        .select("id", { count: "exact", head: true })
        .eq("school_id", school.id)
        .gte("created_at", dayStart)
        .lte("created_at", dayEnd);

      const payload = {
        summary_date: summaryDate,
        timezone: tz,
        attendance: {
          total_students: studentsTotal ?? 0,
          records: totalAtt,
          present,
          absent,
          percentage: attendancePct,
          unusual_absence_classes: unusualClasses,
        },
        academic: {
          results_entered: gradesEntered ?? 0,
          assignments_created: assignmentsCreated ?? 0,
          assignments_submitted: submissionsCount ?? 0,
          upcoming_examinations: upcomingExams ?? 0,
        },
        teachers: {
          attendance_registers_submitted: teachersSubmitted,
        },
        students: {
          new_students: newStudents ?? 0,
        },
        alerts: {
          announcements: announcementsCount ?? 0,
          attendance_concerns: unusualClasses.length,
        },
      };

      const { data: upserted, error: upErr } = await admin
        .from("daily_school_summaries")
        .upsert(
          {
            school_id: school.id,
            summary_date: summaryDate,
            payload,
            delivery_status: "pending",
            delivery_error: null,
          },
          { onConflict: "school_id,summary_date" },
        )
        .select("id")
        .maybeSingle();
      if (upErr) {
        processed.push({ school_id: school.id, error: upErr.message });
        continue;
      }

      const subject = `${school.school_name || "School"} daily summary — ${summaryDate}`;
      const bodyText =
        `Daily school summary for ${summaryDate} (${tz})\n` +
        `Attendance: ${present} present / ${absent} absent` +
        (attendancePct != null ? ` (${attendancePct}%)` : "") +
        `\nResults entered: ${payload.academic.results_entered}\n` +
        `Assignments created: ${payload.academic.assignments_created}, submitted: ${payload.academic.assignments_submitted}\n` +
        `Upcoming exams (7d): ${payload.academic.upcoming_examinations}\n` +
        `Registers submitted: ${payload.teachers.attendance_registers_submitted}\n` +
        `New students: ${payload.students.new_students}\n` +
        `Attendance concerns: ${payload.alerts.attendance_concerns}`;

      const html = `<pre style="font-family:sans-serif;white-space:pre-wrap">${bodyText.replace(/</g, "&lt;")}</pre>`;

      // Notify admins in-app
      const { data: profiles } = await admin
        .from("profiles")
        .select("id, email, phone")
        .eq("school_id", school.id);
      const profileIds = (profiles ?? []).map((p) => p.id);
      const { data: adminRoles } = profileIds.length
        ? await admin
            .from("user_roles")
            .select("user_id")
            .in("user_id", profileIds)
            .in("role", ["admin", "super_admin"])
        : { data: [] as { user_id: string }[] };

      const adminUserIds = [...new Set((adminRoles ?? []).map((r) => r.user_id))];
      if (adminUserIds.length) {
        await admin.from("notifications").insert(
          adminUserIds.map((user_id) => ({
            user_id,
            title: subject,
            body: bodyText.slice(0, 500),
            data: { type: "daily_summary", summary_date: summaryDate, school_id: school.id },
          })),
        );
      }

      let emailOk = false;
      let smsOk = false;
      const emailTargets = new Set<string>();
      if (school.email) emailTargets.add(school.email);
      for (const p of profiles ?? []) {
        if (adminUserIds.includes(p.id) && p.email) emailTargets.add(p.email);
      }
      for (const email of emailTargets) {
        if (await sendEmail(email, subject, html)) emailOk = true;
      }

      const smsPhone = school.phone ||
        (profiles ?? []).find((p) => adminUserIds.includes(p.id) && p.phone)?.phone;
      if (smsPhone) {
        smsOk = await sendSms(smsPhone, bodyText.slice(0, 300));
      }

      const delivered = emailOk || adminUserIds.length > 0;
      await admin
        .from("daily_school_summaries")
        .update({
          delivered_at: new Date().toISOString(),
          delivery_status: delivered ? "delivered" : "failed",
          delivery_error: delivered ? null : "No admin notification or email delivered",
        })
        .eq("id", upserted?.id);

      processed.push({
        school_id: school.id,
        summary_date: summaryDate,
        delivered,
        emailOk,
        smsOk,
        summary_id: upserted?.id,
      });
    }

    return new Response(JSON.stringify({ success: true, processed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
