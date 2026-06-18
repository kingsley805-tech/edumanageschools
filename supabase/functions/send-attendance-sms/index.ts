/// <reference path="../deno-shim.d.ts" />
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ARKESEL_V1_URL = "https://sms.arkesel.com/sms/api";

function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("233") && digits.length >= 11) return digits;
  if (digits.startsWith("0") && digits.length >= 10) return `233${digits.slice(1)}`;
  let local = digits;
  if (local.startsWith("0")) local = local.slice(1);
  if (local.length >= 8 && local.length <= 9) return `233${local}`;
  if (local.length === 9) return `233${local}`;
  return local.length >= 10 ? local : null;
}

function phoneForArkesel(intlPhone: string): string {
  if (intlPhone.startsWith("233") && intlPhone.length >= 11) {
    return `0${intlPhone.slice(3)}`;
  }
  return intlPhone;
}

function buildArkeselSmsUrl(apiKey: string, toPhone: string, sender: string, message: string): string {
  const params = new URLSearchParams({
    action: "send-sms",
    api_key: apiKey,
    to: phoneForArkesel(toPhone),
    from: sender.slice(0, 11),
    sms: message,
  });
  return `${ARKESEL_V1_URL}?${params.toString()}`;
}

async function sendArkeselSms(apiKey: string, toPhone: string, sender: string, message: string): Promise<Response> {
  const url = buildArkeselSmsUrl(apiKey, toPhone, sender, message);
  return fetch(url, { method: "GET" });
}

type SmsSettings = {
  sms_attendance_enabled: boolean;
  sms_sender_id: string | null;
  sms_notify_absent: boolean;
  sms_notify_late: boolean;
  sms_notify_present: boolean;
  sms_template_present: string | null;
  sms_template_absent: string | null;
  sms_template_late: string | null;
  sms_template_default: string | null;
};

type AttendanceEntry = {
  student_id: string;
  status: string;
  time_in?: string | null;
};

function formatShortDate(d: string): string {
  const dt = new Date(d.includes("T") ? d : `${d}T12:00:00`);
  const day = dt.getDate();
  const month = dt.toLocaleDateString("en-GB", { month: "short" });
  const year = dt.getFullYear();
  return `${day}-${month}-${year}`;
}

function formatLongDate(d: string): string {
  try {
    return new Date(d.includes("T") ? d : `${d}T12:00:00`).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return d;
  }
}

function applyTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? "");
}

function statusLabel(status: string): string {
  const s = status.toLowerCase();
  if (s === "sick") return "SICK";
  if (s === "excused") return "EXCUSED";
  return s.toUpperCase();
}

function defaultTemplateForStatus(status: string): string {
  const s = status.toLowerCase();
  if (s === "present") {
    return "{school_name}: {student_name} was marked PRESENT on {date}.";
  }
  if (s === "late") {
    return "{school_name}: {student_name} was marked LATE on {date}.";
  }
  if (s === "absent" || s === "sick" || s === "excused") {
    return "{school_name}: {student_name} was marked {status} on {date}. Please contact the school if necessary.";
  }
  return "{school_name}: {student_name} was marked {status} on {date}.";
}

function buildAttendanceMessage(
  settings: SmsSettings,
  opts: { schoolName: string; studentName: string; status: string; dateStr: string },
): string {
  const status = opts.status.toLowerCase();
  const vars = {
    school_name: opts.schoolName,
    student_name: opts.studentName,
    date: formatShortDate(opts.dateStr),
    status: statusLabel(status),
  };

  let template = settings.sms_template_default?.trim() || defaultTemplateForStatus(status);
  if (status === "present" && settings.sms_template_present?.trim()) {
    template = settings.sms_template_present.trim();
  } else if ((status === "absent" || status === "sick" || status === "excused") && settings.sms_template_absent?.trim()) {
    template = settings.sms_template_absent.trim();
  } else if (status === "late" && settings.sms_template_late?.trim()) {
    template = settings.sms_template_late.trim();
  } else if (!settings.sms_template_default?.trim()) {
    template = defaultTemplateForStatus(status);
  }

  return applyTemplate(template, vars);
}

function shouldNotifyStatus(settings: SmsSettings, status: string): boolean {
  const s = status.toLowerCase();
  if (s === "present") return settings.sms_notify_present;
  if (s === "late") return settings.sms_notify_late;
  if (s === "absent" || s === "sick" || s === "excused") return settings.sms_notify_absent;
  return settings.sms_notify_absent;
}

async function assertCanMarkClassAttendance(
  admin: SupabaseClient,
  userId: string,
  classId: string,
): Promise<string> {
  const { data: cls, error: clsErr } = await admin
    .from("classes")
    .select("school_id")
    .eq("id", classId)
    .maybeSingle();
  if (clsErr || !cls?.school_id) throw new Error("Class not found");

  const { data: canTeacher } = await admin.rpc("teacher_can_view_student", {
    teacher_user_id: userId,
    student_class_id: classId,
  });
  if (canTeacher) return String(cls.school_id);

  const { data: userSchool } = await admin.rpc("get_user_school_id", { _user_id: userId });
  const { data: roleRows } = await admin.from("user_roles").select("role").eq("user_id", userId);
  const isAdmin =
    (roleRows ?? []).some((r) => r.role === "admin") && String(userSchool) === String(cls.school_id);
  if (isAdmin) return String(cls.school_id);

  throw new Error("Not authorized to send attendance notifications for this class");
}

async function loadSmsSettings(admin: SupabaseClient, schoolId: string): Promise<SmsSettings> {
  const { data } = await admin
    .from("school_settings")
    .select(
      "sms_attendance_enabled, sms_sender_id, sms_notify_absent, sms_notify_late, sms_notify_present, sms_template_present, sms_template_absent, sms_template_late, sms_template_default",
    )
    .eq("school_id", schoolId)
    .maybeSingle();

  const row = (data ?? {}) as Record<string, unknown>;
  return {
    sms_attendance_enabled: row.sms_attendance_enabled !== false,
    sms_sender_id: typeof row.sms_sender_id === "string" ? row.sms_sender_id : null,
    sms_notify_absent: row.sms_notify_absent !== false,
    sms_notify_late: row.sms_notify_late !== false,
    sms_notify_present: row.sms_notify_present === true,
    sms_template_present: typeof row.sms_template_present === "string" ? row.sms_template_present : null,
    sms_template_absent: typeof row.sms_template_absent === "string" ? row.sms_template_absent : null,
    sms_template_late: typeof row.sms_template_late === "string" ? row.sms_template_late : null,
    sms_template_default: typeof row.sms_template_default === "string" ? row.sms_template_default : null,
  };
}

async function resolveParentsForStudent(
  admin: SupabaseClient,
  studentId: string,
  guardianId: string | null | undefined,
): Promise<Array<{ id: string; user_id: string | null; phone: string | null; emergency_contact: string | null; full_name: string | null }>> {
  const parents: Array<{
    id: string;
    user_id: string | null;
    phone: string | null;
    emergency_contact: string | null;
    full_name: string | null;
  }> = [];
  const seen = new Set<string>();

  const addParent = (p: {
    id: string;
    user_id?: string | null;
    phone?: string | null;
    emergency_contact?: string | null;
    profiles?: { full_name?: string; phone?: string | null } | null;
  } | null) => {
    if (!p?.id || seen.has(p.id)) return;
    seen.add(p.id);
    const profilePhone = p.profiles?.phone?.trim() || null;
    parents.push({
      id: p.id,
      user_id: p.user_id ?? null,
      phone: p.phone?.trim() || profilePhone || null,
      emergency_contact: p.emergency_contact?.trim() || null,
      full_name: p.profiles?.full_name ?? null,
    });
  };

  if (guardianId) {
    const { data: guardian } = await admin
      .from("parents")
      .select("id, user_id, phone, emergency_contact, profiles:user_id(full_name, phone)")
      .eq("id", guardianId)
      .maybeSingle();
    addParent(guardian as Parameters<typeof addParent>[0]);
  }

  const { data: links } = await admin
    .from("parent_student_links")
    .select("parent_id, parents(id, user_id, phone, emergency_contact, profiles:user_id(full_name, phone))")
    .eq("student_id", studentId);

  for (const link of links ?? []) {
    addParent((link as { parents?: Parameters<typeof addParent>[0] }).parents ?? null);
  }

  return parents;
}

async function alreadySentSms(
  admin: SupabaseClient,
  studentId: string,
  classId: string | null,
  attendanceDate: string,
  status: string,
): Promise<boolean> {
  let query = admin
    .from("attendance_sms_logs")
    .select("id")
    .eq("student_id", studentId)
    .eq("attendance_date", attendanceDate)
    .eq("attendance_status", status.toLowerCase())
    .eq("sms_status", "sent")
    .limit(1);

  if (classId) query = query.eq("class_id", classId);
  const { data } = await query.maybeSingle();
  return Boolean(data?.id);
}

async function logAttendanceSms(
  admin: SupabaseClient,
  row: Record<string, unknown>,
): Promise<string | null> {
  const { data, error } = await admin.from("attendance_sms_logs").insert(row).select("id").single();
  if (error) {
    console.error("attendance_sms_logs insert:", error);
    return null;
  }
  return data?.id ?? null;
}

async function processAttendanceSmsBatch(opts: {
  admin: SupabaseClient;
  apiKey: string;
  triggeredBy: string;
  schoolId: string;
  classId: string | null;
  className: string;
  schoolName: string;
  attendanceDate: string;
  registerId: string | null;
  source: "teacher_attendance" | "register";
  entries: AttendanceEntry[];
}): Promise<{ sent: number; skipped: number; errors: string[] }> {
  const { admin, apiKey, triggeredBy, schoolId, classId, className, schoolName, attendanceDate, registerId, source, entries } = opts;

  const { data: smsActive, error: smsActiveErr } = await admin.rpc("school_sms_service_active", {
    p_school_id: schoolId,
  });
  if (smsActiveErr) console.error("school_sms_service_active:", smsActiveErr);

  const settings = await loadSmsSettings(admin, schoolId);
  if (smsActive === false || !settings.sms_attendance_enabled) {
    return { sent: 0, skipped: entries.length, errors: [] };
  }

  const senderId = (
    settings.sms_sender_id?.trim() ||
    schoolName.replace(/[^a-zA-Z0-9]/g, "").slice(0, 11) ||
    "School"
  ).slice(0, 11);

  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];
  const dateLabel = formatLongDate(attendanceDate);
  const dayLabel = new Date(`${attendanceDate}T12:00:00`).toLocaleDateString("en-GB", { weekday: "long" });

  for (const entry of entries) {
    const status = (entry.status ?? "").toLowerCase();
    if (!status) {
      skipped++;
      continue;
    }

    if (!shouldNotifyStatus(settings, status)) {
      skipped++;
      continue;
    }

    const { data: studentRow } = await admin
      .from("students")
      .select("id, guardian_id, full_name, profiles:profile_id(full_name)")
      .eq("id", entry.student_id)
      .maybeSingle();

    const student = studentRow as {
      id: string;
      guardian_id?: string | null;
      full_name?: string | null;
      profiles?: { full_name?: string } | null;
    } | null;

    if (!student?.id) {
      skipped++;
      continue;
    }

    const studentName = student.profiles?.full_name?.trim() || student.full_name?.trim() || "Student";

    if (classId && (await alreadySentSms(admin, student.id, classId, attendanceDate, status))) {
      skipped++;
      continue;
    }

    const parents = await resolveParentsForStudent(admin, student.id, student.guardian_id);
    if (parents.length === 0) {
      await logAttendanceSms(admin, {
        school_id: schoolId,
        student_id: student.id,
        parent_id: null,
        class_id: classId,
        register_id: registerId,
        attendance_date: attendanceDate,
        attendance_status: status,
        phone_number: null,
        message: null,
        sms_status: "skipped",
        error_message: "No linked parent with contact details",
        source,
        triggered_by: triggeredBy,
      });
      skipped++;
      continue;
    }

    const message = buildAttendanceMessage(settings, {
      schoolName,
      studentName,
      status,
      dateStr: attendanceDate,
    });

    for (const parent of parents) {
      const phoneRaw = parent.phone ?? parent.emergency_contact ?? "";
      const phone = normalizePhone(phoneRaw);

      if (parent.user_id) {
        await admin.from("notifications").insert({
          user_id: parent.user_id,
          title: "Attendance Update",
          body: `Attendance Update: Your child, ${studentName}, has been marked ${statusLabel(status)} at ${schoolName} on ${dayLabel}, ${dateLabel}.`,
          data: {
            type: "attendance",
            student_id: student.id,
            class_id: classId,
            register_id: registerId,
            status,
            date: attendanceDate,
            school_name: schoolName,
          },
          read: false,
        });
      }

      if (!phone) {
        await logAttendanceSms(admin, {
          school_id: schoolId,
          student_id: student.id,
          parent_id: parent.id,
          class_id: classId,
          register_id: registerId,
          attendance_date: attendanceDate,
          attendance_status: status,
          phone_number: null,
          message,
          sms_status: "skipped",
          error_message: "Parent phone number missing",
          source,
          triggered_by: triggeredBy,
        });
        skipped++;
        continue;
      }

      const attendanceLogId = await logAttendanceSms(admin, {
        school_id: schoolId,
        student_id: student.id,
        parent_id: parent.id,
        class_id: classId,
        register_id: registerId,
        attendance_date: attendanceDate,
        attendance_status: status,
        phone_number: phone,
        message,
        sms_status: "queued",
        source,
        triggered_by: triggeredBy,
      });

      const { data: legacyLog } = await admin
        .from("sms_logs")
        .insert({
          school_id: schoolId,
          student_id: student.id,
          parent_id: parent.id,
          register_id: registerId,
          phone_number: phone,
          message,
          sms_status: "queued",
        })
        .select("id")
        .single();

      try {
        const { data: credit, error: creditErr } = await admin.rpc("consume_school_sms_credit", {
          p_school_id: schoolId,
          p_count: 1,
        });
        if (creditErr) throw creditErr;
        if (credit && credit.ok === false) {
          throw new Error(credit.error ?? "Insufficient SMS balance");
        }

        const res = await sendArkeselSms(apiKey, phone, senderId, message);
        const rawBody = await res.text();
        let body: Record<string, unknown> = {};
        try {
          body = JSON.parse(rawBody) as Record<string, unknown>;
        } catch {
          body = { raw: rawBody };
        }
        const ok = res.ok;

        const updates = {
          sms_status: ok ? "sent" : "failed",
          provider_response: body,
          sent_at: ok ? new Date().toISOString() : null,
          error_message: ok ? null : JSON.stringify(body),
        };

        if (attendanceLogId) {
          await admin.from("attendance_sms_logs").update(updates).eq("id", attendanceLogId);
        }
        if (legacyLog?.id) {
          await admin.from("sms_logs").update(updates).eq("id", legacyLog.id);
        }

        if (ok) sent++;
        else errors.push(`${studentName}: ${JSON.stringify(body)}`);
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        const failUpdate = {
          sms_status: "failed",
          error_message: errMsg,
          provider_response: { error: errMsg },
        };
        if (attendanceLogId) {
          await admin.from("attendance_sms_logs").update(failUpdate).eq("id", attendanceLogId);
        }
        if (legacyLog?.id) {
          await admin.from("sms_logs").update(failUpdate).eq("id", legacyLog.id);
        }
        errors.push(`${studentName}: ${errMsg}`);
      }

      break;
    }
  }

  return { sent, skipped, errors: errors.slice(0, 10) };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("ARKESEL_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "ARKESEL_API_KEY is not configured on the server" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const registerId = typeof body.registerId === "string" ? body.registerId : null;
    const classId = typeof body.classId === "string" ? body.classId : null;
    const attendanceDate = typeof body.date === "string" ? body.date.slice(0, 10) : null;

    if (!registerId && !(classId && attendanceDate)) {
      return new Response(JSON.stringify({ error: "registerId or (classId + date) required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );
    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: userData, error: userErr } = await supabaseUser.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (classId && attendanceDate) {
      const schoolId = await assertCanMarkClassAttendance(admin, userData.user.id, classId);

      const { data: cls } = await admin
        .from("classes")
        .select("name, schools(school_name)")
        .eq("id", classId)
        .maybeSingle();

      const className = (cls as { name?: string } | null)?.name ?? "Class";
      const schoolRow = (cls as { schools?: { name?: string; school_name?: string } } | null)?.schools;
      const schoolName = schoolRow?.name ?? schoolRow?.school_name ?? "School";

      const { data: attendanceRows, error: attErr } = await admin
        .from("attendance")
        .select("student_id, status")
        .eq("class_id", classId)
        .eq("date", attendanceDate);

      if (attErr) throw attErr;

      const result = await processAttendanceSmsBatch({
        admin,
        apiKey,
        triggeredBy: userData.user.id,
        schoolId,
        classId,
        className,
        schoolName,
        attendanceDate,
        registerId: null,
        source: "teacher_attendance",
        entries: (attendanceRows ?? []).map((r) => ({
          student_id: String(r.student_id),
          status: String(r.status),
        })),
      });

      return new Response(JSON.stringify({ ok: true, ...result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: reg, error: regErr } = await admin
      .from("class_registers")
      .select("id, school_id, class_id, register_date, classes(name), schools(school_name)")
      .eq("id", registerId)
      .maybeSingle();

    if (regErr || !reg) {
      return new Response(JSON.stringify({ error: "Register not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const schoolId = String(reg.school_id);
    const className = (reg.classes as { name?: string })?.name ?? "Class";
    const schoolRow = reg.schools as { name?: string; school_name?: string } | null;
    const schoolName = schoolRow?.name ?? schoolRow?.school_name ?? "School";

    const { data: entries, error: entErr } = await admin
      .from("register_student_entries")
      .select("student_id, attendance_status, time_in")
      .eq("register_id", registerId);

    if (entErr) throw entErr;

    const result = await processAttendanceSmsBatch({
      admin,
      apiKey,
      triggeredBy: userData.user.id,
      schoolId,
      classId: reg.class_id ? String(reg.class_id) : null,
      className,
      schoolName,
      attendanceDate: String(reg.register_date),
      registerId,
      source: "register",
      entries: (entries ?? []).map((e) => ({
        student_id: String(e.student_id),
        status: String(e.attendance_status ?? ""),
        time_in: e.time_in as string | null,
      })),
    });

    return new Response(JSON.stringify({ ok: true, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-attendance-sms:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
