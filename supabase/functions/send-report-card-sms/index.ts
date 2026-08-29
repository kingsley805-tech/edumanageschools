/// <reference path="../deno-shim.d.ts" />
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ARKESEL_V2_URL = "https://sms.arkesel.com/api/v2/sms/send";
const DEFAULT_SMS_TEMPLATE =
  "{school_name}: {student_name}'s {term} report card is ready. Download PDF: {pdf_link}";
const MAX_RECIPIENTS = 20;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("233") && digits.length >= 11) return digits;
  if (digits.startsWith("0") && digits.length >= 10) return `233${digits.slice(1)}`;
  let local = digits.startsWith("0") ? digits.slice(1) : digits;
  if (local.length >= 8 && local.length <= 10) return `233${local}`;
  return local.length >= 10 ? local : null;
}

function applyTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{([a-z_]+)\}/gi, (_, key: string) => vars[key] ?? "");
}

function arkeselDeliveryOk(httpOk: boolean, body: Record<string, unknown>): boolean {
  if (!httpOk) return false;
  return String(body.status ?? "").toLowerCase() === "success";
}

function creditOk(credit: unknown): { ok: boolean; error?: string } {
  if (credit == null) return { ok: false, error: "No credit response" };
  if (typeof credit === "boolean") return { ok: credit, error: credit ? undefined : "Insufficient SMS balance" };
  if (typeof credit === "object") {
    const row = credit as { ok?: boolean; error?: string };
    if (row.ok === false) return { ok: false, error: row.error ?? "Insufficient SMS balance" };
    return { ok: true };
  }
  return { ok: false, error: "Unexpected credit response" };
}

async function resolveArkeselKey(admin: SupabaseClient): Promise<string | null> {
  const envKey = Deno.env.get("ARKESEL_API_KEY")?.trim();
  if (envKey) return envKey;
  const { data } = await admin.from("platform_sms_gateway").select("api_key").limit(1).maybeSingle();
  return (data as { api_key?: string } | null)?.api_key?.trim() || null;
}

async function sendArkesel(
  apiKey: string,
  sender: string,
  phone: string,
  message: string,
): Promise<{ ok: boolean; detail: string; body: Record<string, unknown> }> {
  try {
    const res = await fetch(ARKESEL_V2_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-key": apiKey },
      body: JSON.stringify({
        sender: sender.slice(0, 11),
        message: message.slice(0, 480),
        recipients: [phone],
      }),
    });
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const ok = arkeselDeliveryOk(res.ok, body);
    return { ok, detail: JSON.stringify(body), body };
  } catch (e) {
    return { ok: false, detail: String(e), body: { error: String(e) } };
  }
}

async function refundCredit(admin: SupabaseClient, schoolId: string): Promise<void> {
  const { error } = await admin.rpc("refund_school_sms_credit", {
    p_school_id: schoolId,
    p_count: 1,
  });
  if (error) {
    console.error("refund_school_sms_credit:", error);
  }
}

type ParentContact = {
  id: string;
  phone: string | null;
  full_name: string | null;
};

async function resolveParentContacts(
  admin: SupabaseClient,
  studentId: string,
): Promise<ParentContact[]> {
  const out: ParentContact[] = [];
  const seen = new Set<string>();

  const add = (p: {
    id?: string;
    phone?: string | null;
    emergency_contact?: string | null;
    whatsapp_number?: string | null;
    profiles?: { full_name?: string | null; phone?: string | null } | null;
  } | null) => {
    if (!p?.id || seen.has(p.id)) return;
    seen.add(p.id);
    const phone =
      p.whatsapp_number?.trim() ||
      p.phone?.trim() ||
      p.profiles?.phone?.trim() ||
      p.emergency_contact?.trim() ||
      null;
    out.push({
      id: p.id,
      phone,
      full_name: p.profiles?.full_name ?? null,
    });
  };

  const { data: student } = await admin
    .from("students")
    .select("guardian_id")
    .eq("id", studentId)
    .maybeSingle();

  const guardianId = (student as { guardian_id?: string | null } | null)?.guardian_id;
  if (guardianId) {
    const { data: guardian } = await admin
      .from("parents")
      .select("id, phone, emergency_contact, whatsapp_number, profiles:user_id(full_name, phone)")
      .eq("id", guardianId)
      .maybeSingle();
    add(guardian as Parameters<typeof add>[0]);
  }

  const { data: links } = await admin
    .from("parent_student_links")
    .select("parents(id, phone, emergency_contact, whatsapp_number, profiles:user_id(full_name, phone))")
    .eq("student_id", studentId);

  for (const link of links ?? []) {
    add((link as { parents?: Parameters<typeof add>[0] }).parents ?? null);
  }

  // Fallback legacy table
  if (!out.length) {
    const { data: legacy } = await admin
      .from("parent_students")
      .select("parent_id, parents(id, phone, emergency_contact, whatsapp_number, profiles:user_id(full_name, phone))")
      .eq("student_id", studentId);
    for (const link of legacy ?? []) {
      add((link as { parents?: Parameters<typeof add>[0] }).parents ?? null);
    }
  }

  return out;
}

async function logSms(
  admin: SupabaseClient,
  row: {
    school_id: string;
    student_id: string;
    parent_id: string | null;
    phone_number: string;
    message: string;
    sms_status: string;
    provider_response?: Record<string, unknown>;
    error_message?: string | null;
  },
): Promise<void> {
  try {
    const payload: Record<string, unknown> = {
      school_id: row.school_id,
      student_id: row.student_id,
      parent_id: row.parent_id,
      phone_number: row.phone_number,
      message: row.message,
      sms_status: row.sms_status,
      provider_response: row.provider_response ?? null,
      sent_at: row.sms_status === "sent" ? new Date().toISOString() : null,
    };
    if (row.error_message) payload.error_message = row.error_message;
    const { error } = await admin.from("sms_logs").insert(payload);
    if (error) console.error("sms_logs insert:", error.message);
  } catch (e) {
    console.error("sms_logs insert failed:", e);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return json({ error: "Unauthorized" }, 401);
    }
    const userId = userData.user.id;

    const body = (await req.json()) as {
      school_id?: string;
      report_id?: string;
      sender_role?: "admin" | "teacher";
      /** Manual send — teachers need sms_teacher_can_send_report_card */
      force?: boolean;
    };

    const schoolId = body.school_id?.trim();
    const reportId = body.report_id?.trim();
    const senderRole = body.sender_role === "teacher" ? "teacher" : "admin";
    const force = body.force === true;

    if (!schoolId || !reportId) {
      return json({ error: "school_id and report_id are required" }, 400);
    }

    const { data: report, error: reportErr } = await admin
      .from("term_report_cards")
      .select(
        "id, school_id, student_id, student_name, class_id, class_name, term_label, teacher_id, report_pdf_url",
      )
      .eq("id", reportId)
      .maybeSingle();

    if (reportErr || !report) {
      return json({ error: "Report card not found" }, 404);
    }
    if (report.school_id !== schoolId) {
      return json({ error: "Report does not belong to this school" }, 400);
    }

    const { data: settings } = await admin
      .from("school_settings")
      .select(
        "sms_sender_id, sms_teacher_can_send_report_card, sms_auto_send_report_card, sms_report_card_template, whatsapp_default_country_code",
      )
      .eq("school_id", schoolId)
      .maybeSingle();

    const { data: isAdmin } = await admin.rpc("is_school_admin", {
      _user_id: userId,
      _school_id: schoolId,
    });

    if (senderRole === "teacher") {
      const canManual = Boolean(settings?.sms_teacher_can_send_report_card);
      const canAuto = Boolean(settings?.sms_auto_send_report_card);
      if (force && !canManual) {
        return json({ error: "Teachers are not allowed to send report card SMS for this school." }, 403);
      }
      if (!force && !canAuto) {
        return json({ ok: true, sent: 0, skipped: 1, errors: ["Auto-send SMS is disabled."] });
      }

      const teaches = report.class_id
        ? (
            await admin.rpc("teacher_teaches_class", {
              p_teacher_id: userId,
              p_class_id: report.class_id,
            })
          ).data
        : false;
      const owns = report.teacher_id === userId;
      if (!isAdmin && !teaches && !owns) {
        return json({ error: "Not allowed to SMS this report card." }, 403);
      }
    } else if (!isAdmin) {
      const { data: superAdmin } = await admin.rpc("has_role", {
        _user_id: userId,
        _role: "super_admin",
      });
      if (!superAdmin) {
        return json({ error: "Only school admins can send report card SMS." }, 403);
      }
    }

    const { data: smsActive } = await admin.rpc("school_sms_service_active", {
      p_school_id: schoolId,
    });
    if (smsActive === false) {
      return json({
        error: "SMS is not enabled for this school. Enable it under Platform SMS or subscription.",
      }, 402);
    }

    const { data: school } = await admin
      .from("schools")
      .select("name, school_name")
      .eq("id", schoolId)
      .maybeSingle();
    const schoolName =
      (school as { name?: string; school_name?: string } | null)?.name ||
      (school as { school_name?: string } | null)?.school_name ||
      "School";

    const studentName = report.student_name || "Student";
    const termLabel = report.term_label || "term";
    const appBase =
      Deno.env.get("PUBLIC_APP_URL")?.replace(/\/$/, "") ||
      Deno.env.get("SITE_URL")?.replace(/\/$/, "") ||
      "";
    const pdfUrl =
      (report as { report_pdf_url?: string | null }).report_pdf_url?.trim() ||
      (appBase
        ? `${appBase}/parent/reports?studentId=${report.student_id}&reportId=${reportId}`
        : `Report card ${reportId}`);

    const template =
      (settings as { sms_report_card_template?: string | null } | null)?.sms_report_card_template?.trim() ||
      DEFAULT_SMS_TEMPLATE;
    const message = applyTemplate(template, {
      student_name: studentName,
      school_name: schoolName,
      term: termLabel,
      term_label: termLabel,
      pdf_link: pdfUrl,
      class_name: report.class_name || "—",
    }).slice(0, 480);

    const parents = await resolveParentContacts(admin, report.student_id);
    const recipients = parents
      .map((p) => ({
        parent_id: p.id,
        name: p.full_name,
        phone: p.phone ? normalizePhone(p.phone) : null,
      }))
      .filter((r) => r.phone)
      .slice(0, MAX_RECIPIENTS);

    if (!recipients.length) {
      return json({
        ok: true,
        sent: 0,
        skipped: 1,
        errors: ["No parent phone numbers found for this student."],
      });
    }

    const apiKey = await resolveArkeselKey(admin);
    if (!apiKey) {
      return json({ error: "Arkesel API key is not configured." }, 500);
    }

    const sender =
      (settings as { sms_sender_id?: string | null } | null)?.sms_sender_id?.trim() ||
      Deno.env.get("ARKESEL_SENDER")?.trim() ||
      "EDUMANAGE";

    let sent = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const r of recipients) {
      const phone = r.phone!;
      const { data: credit, error: creditErr } = await admin.rpc("consume_school_sms_credit", {
        p_school_id: schoolId,
        p_count: 1,
      });

      if (creditErr) {
        console.error("consume_school_sms_credit:", creditErr);
        skipped += 1;
        errors.push(`Credit check failed for ${r.name || phone}: ${creditErr.message}`);
        await logSms(admin, {
          school_id: schoolId,
          student_id: report.student_id,
          parent_id: r.parent_id,
          phone_number: phone,
          message,
          sms_status: "failed",
          error_message: creditErr.message,
          provider_response: { error: creditErr.message },
        });
        continue;
      }

      const reserved = creditOk(credit);
      if (!reserved.ok) {
        skipped += 1;
        errors.push(reserved.error || "SMS credit balance exhausted.");
        await logSms(admin, {
          school_id: schoolId,
          student_id: report.student_id,
          parent_id: r.parent_id,
          phone_number: phone,
          message,
          sms_status: "failed",
          error_message: reserved.error || "Insufficient SMS balance",
        });
        break;
      }

      const result = await sendArkesel(apiKey, sender, phone, message);
      if (result.ok) {
        sent += 1;
        await logSms(admin, {
          school_id: schoolId,
          student_id: report.student_id,
          parent_id: r.parent_id,
          phone_number: phone,
          message,
          sms_status: "sent",
          provider_response: result.body,
        });
      } else {
        skipped += 1;
        errors.push(`Failed to ${phone}: ${result.detail}`);
        console.error("report-card SMS failed:", phone, result.detail);
        await refundCredit(admin, schoolId);
        await logSms(admin, {
          school_id: schoolId,
          student_id: report.student_id,
          parent_id: r.parent_id,
          phone_number: phone,
          message,
          sms_status: "failed",
          error_message: result.detail.slice(0, 500),
          provider_response: result.body,
        });
      }
    }

    return json({ ok: true, sent, skipped, errors });
  } catch (e) {
    console.error("send-report-card-sms:", e);
    return json({ error: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});
