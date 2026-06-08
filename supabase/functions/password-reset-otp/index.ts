import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const OTP_LENGTH = 8;
const OTP_TTL_MIN = 15;
const RESEND_COOLDOWN_SEC = 90;
const MAX_REQUESTS_PER_HOUR = 5;
const ARKESEL_URL = "https://sms.arkesel.com/api/v2/sms/send";

const admin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { persistSession: false, autoRefreshToken: false } },
);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function generateOtp(): string {
  const arr = new Uint32Array(OTP_LENGTH);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((n) => (n % 10).toString()).join("");
}

async function sha256(str: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function maskEmail(e?: string | null) {
  if (!e) return null;
  const [u, d] = e.split("@");
  if (!d) return null;
  const head = u.slice(0, 2);
  return `${head}${"*".repeat(Math.max(1, u.length - 2))}@${d}`;
}
function maskPhone(p?: string | null) {
  if (!p) return null;
  const digits = p.replace(/\D/g, "");
  if (digits.length < 4) return "***";
  return `${"*".repeat(digits.length - 4)}${digits.slice(-4)}`;
}
function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("233") && digits.length >= 12) return digits;
  if (digits.startsWith("0") && digits.length >= 10) return `233${digits.slice(1)}`;
  if (digits.length === 9) return `233${digits}`;
  return digits.length >= 10 ? digits : null;
}

async function logAudit(opts: {
  schoolId?: string | null;
  actionType: string;
  entityId?: string | null;
  performedBy?: string | null;
  details?: Record<string, unknown>;
}) {
  try {
    await admin.from("audit_logs").insert({
      school_id: opts.schoolId ?? null,
      action_type: opts.actionType,
      entity_type: "password_reset",
      entity_id: opts.entityId ?? null,
      performed_by: opts.performedBy ?? null,
      module: "auth",
      details: opts.details ?? {},
    });
  } catch (e) {
    console.error("audit log failed:", e);
  }
}

async function resolveTarget(identifier: string) {
  const trimmed = identifier.trim();
  if (!trimmed) return null;

  // Try admission number / employee_no via RPC
  const { data: rpcData } = await admin.rpc("resolve_login_identifier", {
    p_identifier: trimmed,
  });
  let email: string | null =
    (rpcData as { ok?: boolean; email?: string } | null)?.ok
      ? (rpcData as { email?: string }).email ?? null
      : null;

  if (!email && trimmed.includes("@")) {
    email = trimmed.toLowerCase();
  }
  if (!email) return null;

  // Lookup profile by email
  const { data: profile } = await admin
    .from("profiles")
    .select("id, email, full_name, phone, school_id")
    .ilike("email", email)
    .maybeSingle();

  if (!profile) return null;

  // Role
  const { data: roleRow } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", profile.id);
  const roles = (roleRow ?? []).map((r: { role: string }) => r.role);
  const isStudent = roles.includes("student") && !roles.some((r) => r !== "student");

  return {
    userId: profile.id as string,
    email: profile.email as string,
    fullName: (profile.full_name as string) ?? "",
    phone: (profile.phone as string) ?? null,
    schoolId: (profile.school_id as string) ?? null,
    roles,
    isStudent,
  };
}

async function sendOtpEmail(to: string, fullName: string, otp: string) {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return { ok: false, reason: "no_resend_key" };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "EDUMANAGE Security <onboarding@resend.dev>",
        to: [to],
        subject: `Your password reset code: ${otp}`,
        html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px;background:#0f172a;color:#f1f5f9;border-radius:12px">
          <h2 style="color:#10b981;margin:0 0 8px">Password reset code</h2>
          <p>Hi ${fullName || "there"},</p>
          <p>Use this code to reset your EDUMANAGE password. It expires in <strong>${OTP_TTL_MIN} minutes</strong>.</p>
          <div style="font-size:32px;font-weight:bold;letter-spacing:8px;background:#020617;padding:18px;border-radius:8px;text-align:center;color:#34d399;margin:16px 0">${otp}</div>
          <p style="color:#94a3b8;font-size:12px">If you didn't request this, ignore this email and your password will stay the same.</p>
        </div>`,
      }),
    });
    const body = await res.text();
    return { ok: res.ok, reason: res.ok ? "sent" : body };
  } catch (e) {
    return { ok: false, reason: String(e) };
  }
}

async function sendOtpSms(toRaw: string, otp: string, schoolId: string | null) {
  const key = Deno.env.get("ARKESEL_API_KEY");
  if (!key) return { ok: false, reason: "no_arkesel_key" };
  const phone = normalizePhone(toRaw);
  if (!phone) return { ok: false, reason: "invalid_phone" };

  let sender = "EDUMANAGE";
  if (schoolId) {
    const { data: s } = await admin
      .from("school_settings")
      .select("sms_sender_id")
      .eq("school_id", schoolId)
      .maybeSingle();
    const sid = (s as { sms_sender_id?: string } | null)?.sms_sender_id?.trim();
    if (sid) sender = sid.slice(0, 11);
  }
  try {
    const res = await fetch(ARKESEL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-key": key },
      body: JSON.stringify({
        sender,
        message: `EDUMANAGE password reset code: ${otp}. Expires in ${OTP_TTL_MIN} minutes. Do not share.`,
        recipients: [phone],
      }),
    });
    const body = await res.json().catch(() => ({}));
    return { ok: res.ok, reason: res.ok ? "sent" : JSON.stringify(body) };
  } catch (e) {
    return { ok: false, reason: String(e) };
  }
}

async function handleRequest(req: Request, body: { identifier: string }) {
  const ip = req.headers.get("x-forwarded-for") ?? null;
  const ua = req.headers.get("user-agent") ?? null;
  const target = await resolveTarget(body.identifier);

  // Always return same shape to prevent enumeration, but if student tell them clearly.
  if (!target) {
    return json({ ok: true, sent: false, message: "If an account exists, a code was sent." });
  }

  if (target.isStudent) {
    await logAudit({
      schoolId: target.schoolId,
      actionType: "password_reset_blocked_student",
      entityId: target.userId,
      details: { identifier: body.identifier, ip },
    });
    return json({
      ok: false,
      student: true,
      message: "Students cannot reset their own password. Please contact your school administrator.",
    });
  }

  // Rate limit: how many recent requests for this user?
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count: recentCount } = await admin
    .from("password_reset_otps")
    .select("id", { head: true, count: "exact" })
    .eq("user_id", target.userId)
    .gt("created_at", since);
  if ((recentCount ?? 0) >= MAX_REQUESTS_PER_HOUR) {
    return json({ ok: false, rate_limited: true, message: "Too many requests. Try again later." }, 429);
  }

  // Resend cooldown
  const { data: last } = await admin
    .from("password_reset_otps")
    .select("created_at")
    .eq("user_id", target.userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (last?.created_at) {
    const ageMs = Date.now() - new Date(last.created_at as string).getTime();
    if (ageMs < RESEND_COOLDOWN_SEC * 1000) {
      return json({
        ok: false,
        cooldown: true,
        retry_in_seconds: Math.ceil((RESEND_COOLDOWN_SEC * 1000 - ageMs) / 1000),
        message: `Please wait before requesting another code.`,
      }, 429);
    }
  }

  const otp = generateOtp();
  const codeHash = await sha256(otp);
  const expires = new Date(Date.now() + OTP_TTL_MIN * 60 * 1000).toISOString();

  // Send via both channels
  const emailRes = await sendOtpEmail(target.email, target.fullName, otp);
  const smsRes = target.phone ? await sendOtpSms(target.phone, otp, target.schoolId) : { ok: false, reason: "no_phone" };

  const { data: row, error } = await admin
    .from("password_reset_otps")
    .insert({
      user_id: target.userId,
      identifier: body.identifier,
      code_hash: codeHash,
      expires_at: expires,
      ip_address: ip,
      user_agent: ua,
      delivery: { email: emailRes, sms: smsRes },
    })
    .select("id")
    .single();

  if (error) {
    console.error("otp insert failed", error);
    return json({ ok: false, message: "Could not generate code." }, 500);
  }

  await logAudit({
    schoolId: target.schoolId,
    actionType: "password_reset_otp_sent",
    entityId: target.userId,
    details: {
      identifier: body.identifier,
      delivery: { email: emailRes.ok, sms: smsRes.ok },
      ip,
    },
  });

  return json({
    ok: true,
    sent: true,
    request_id: row.id,
    email_sent: emailRes.ok,
    sms_sent: smsRes.ok,
    masked_email: maskEmail(target.email),
    masked_phone: maskPhone(target.phone),
    expires_in_minutes: OTP_TTL_MIN,
    message: `Code sent. Check your ${emailRes.ok && smsRes.ok ? "email and phone" : emailRes.ok ? "email" : smsRes.ok ? "phone" : "registered contacts"}.`,
  });
}

async function findValidOtp(identifier: string, code: string) {
  const target = await resolveTarget(identifier);
  if (!target || target.isStudent) return { target: null, row: null };
  const codeHash = await sha256(code);

  const { data: rows } = await admin
    .from("password_reset_otps")
    .select("id, code_hash, expires_at, attempts, max_attempts, verified_at, consumed_at")
    .eq("user_id", target.userId)
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1);

  const row = rows?.[0];
  if (!row) return { target, row: null, reason: "no_request" };
  if (row.consumed_at) return { target, row, reason: "consumed" };
  if (new Date(row.expires_at as string).getTime() < Date.now()) return { target, row, reason: "expired" };
  if ((row.attempts ?? 0) >= (row.max_attempts ?? 5)) return { target, row, reason: "too_many_attempts" };
  if (row.code_hash !== codeHash) {
    await admin
      .from("password_reset_otps")
      .update({ attempts: (row.attempts ?? 0) + 1 })
      .eq("id", row.id);
    return { target, row, reason: "invalid" };
  }
  return { target, row, reason: "ok" };
}

async function handleVerify(_req: Request, body: { identifier: string; code: string }) {
  const { target, row, reason } = await findValidOtp(body.identifier, body.code ?? "");
  if (!target) return json({ ok: false, message: "Invalid request." }, 400);
  if (reason !== "ok") {
    await logAudit({
      schoolId: target.schoolId,
      actionType: "password_reset_otp_verify_failed",
      entityId: target.userId,
      details: { reason },
    });
    return json({ ok: false, reason, message: friendlyReason(reason) }, 400);
  }
  await admin.from("password_reset_otps").update({ verified_at: new Date().toISOString() }).eq("id", row!.id);
  await logAudit({
    schoolId: target.schoolId,
    actionType: "password_reset_otp_verified",
    entityId: target.userId,
  });
  return json({ ok: true, message: "Code verified. You can now set a new password." });
}

async function handleReset(req: Request, body: { identifier: string; code: string; new_password: string }) {
  if (!body.new_password || body.new_password.length < 8) {
    return json({ ok: false, message: "Password must be at least 8 characters." }, 400);
  }
  const { target, row, reason } = await findValidOtp(body.identifier, body.code ?? "");
  if (!target) return json({ ok: false, message: "Invalid request." }, 400);
  if (reason !== "ok") {
    await logAudit({
      schoolId: target.schoolId,
      actionType: "password_reset_failed",
      entityId: target.userId,
      details: { reason },
    });
    return json({ ok: false, reason, message: friendlyReason(reason) }, 400);
  }

  const { error: updErr } = await admin.auth.admin.updateUserById(target.userId, {
    password: body.new_password,
  });
  if (updErr) {
    console.error("password update failed", updErr);
    return json({ ok: false, message: updErr.message }, 500);
  }

  await admin
    .from("password_reset_otps")
    .update({ consumed_at: new Date().toISOString(), verified_at: new Date().toISOString() })
    .eq("id", row!.id);

  await logAudit({
    schoolId: target.schoolId,
    actionType: "password_reset_success",
    entityId: target.userId,
    performedBy: target.userId,
    details: { via: "otp" },
  });

  return json({ ok: true, message: "Password updated. You can now sign in." });
}

function friendlyReason(r: string): string {
  switch (r) {
    case "no_request": return "No active reset code. Request a new one.";
    case "expired": return "This code has expired. Request a new one.";
    case "consumed": return "This code was already used.";
    case "too_many_attempts": return "Too many incorrect attempts. Request a new code.";
    case "invalid": return "Incorrect code. Please try again.";
    default: return "Could not verify code.";
  }
}

function generateTempPassword(): string {
  const upper = "ABCDEFGHJKMNPQRSTUVWXYZ";
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const all = upper + lower + digits;
  const arr = new Uint32Array(10);
  crypto.getRandomValues(arr);
  let pw = upper[arr[0] % upper.length] + lower[arr[1] % lower.length] + digits[arr[2] % digits.length];
  for (let i = 3; i < 10; i++) pw += all[arr[i] % all.length];
  return pw;
}

async function handleAdminResetStudent(req: Request, body: { student_user_id: string; force_change?: boolean }) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ ok: false, message: "Unauthorized" }, 401);
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: userData } = await userClient.auth.getUser();
  const actor = userData?.user;
  if (!actor) return json({ ok: false, message: "Unauthorized" }, 401);

  // Verify actor is admin or super_admin
  const { data: actorRoles } = await admin.from("user_roles").select("role").eq("user_id", actor.id);
  const roleList = (actorRoles ?? []).map((r: { role: string }) => r.role);
  const isAdmin = roleList.includes("admin") || roleList.includes("school_admin") || roleList.includes("super_admin");
  if (!isAdmin) return json({ ok: false, message: "Admin access required" }, 403);

  if (!body.student_user_id) return json({ ok: false, message: "student_user_id required" }, 400);

  // Verify target is in the same school (unless super_admin)
  const { data: actorProfile } = await admin.from("profiles").select("school_id").eq("id", actor.id).maybeSingle();
  const { data: studentProfile } = await admin
    .from("profiles")
    .select("id, school_id, email, full_name")
    .eq("id", body.student_user_id)
    .maybeSingle();
  if (!studentProfile) return json({ ok: false, message: "Student not found" }, 404);

  if (!roleList.includes("super_admin")) {
    if (!actorProfile?.school_id || actorProfile.school_id !== studentProfile.school_id) {
      return json({ ok: false, message: "Student is not in your school" }, 403);
    }
  }

  // Confirm target is a student
  const { data: targetRoles } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", body.student_user_id);
  const tRoles = (targetRoles ?? []).map((r: { role: string }) => r.role);
  if (!tRoles.includes("student")) {
    return json({ ok: false, message: "Target user is not a student" }, 400);
  }

  const tempPassword = generateTempPassword();
  const { error: updErr } = await admin.auth.admin.updateUserById(body.student_user_id, {
    password: tempPassword,
    user_metadata: { force_password_change: body.force_change !== false },
  });
  if (updErr) return json({ ok: false, message: updErr.message }, 500);

  await logAudit({
    schoolId: studentProfile.school_id,
    actionType: "admin_reset_student_password",
    entityId: body.student_user_id,
    performedBy: actor.id,
    details: { force_change: body.force_change !== false, student_email: studentProfile.email },
  });

  return json({
    ok: true,
    temporary_password: tempPassword,
    student_name: studentProfile.full_name,
    student_email: studentProfile.email,
    force_change_on_next_login: body.force_change !== false,
    message: "Temporary password generated. Share it securely with the student/guardian. It is shown once.",
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, message: "Method not allowed" }, 405);

  try {
    const body = await req.json();
    const action = body?.action;
    switch (action) {
      case "request": return await handleRequest(req, body);
      case "verify": return await handleVerify(req, body);
      case "reset": return await handleReset(req, body);
      case "admin_reset_student": return await handleAdminResetStudent(req, body);
      default: return json({ ok: false, message: "Unknown action" }, 400);
    }
  } catch (e) {
    console.error("password-reset-otp error:", e);
    return json({ ok: false, message: String(e) }, 500);
  }
});
