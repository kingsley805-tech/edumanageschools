import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
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

type NotificationRow = {
  school_id?: string;
  school_name?: string;
  type?: string;
  day?: number;
  email?: string | null;
  phone?: string | null;
  admin_name?: string | null;
  title?: string;
  body?: string;
};

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
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sender,
      message,
      recipients: [normalized],
    }),
  });
  if (!res.ok) {
    console.error("Arkesel error:", await res.text());
    return false;
  }
  return true;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const cronSecret = Deno.env.get("SUBSCRIPTION_CRON_SECRET");
  const headerSecret = req.headers.get("x-cron-secret");
  if (cronSecret && headerSecret !== cronSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: "Missing Supabase secrets" }), {
      status: 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const { data, error } = await admin.rpc("run_subscription_lifecycle_batch");
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const result = (data ?? {}) as {
    notifications?: NotificationRow[];
    expired?: number;
    reminded?: number;
    locked?: number;
  };

  let emailsSent = 0;
  let smsSent = 0;

  for (const n of result.notifications ?? []) {
    const title = n.title || "Subscription notice";
    const body = n.body || "";
    const email = typeof n.email === "string" ? n.email.trim() : "";
    const phone = typeof n.phone === "string" ? n.phone.trim() : "";

    if (email && !email.includes("@student.portal")) {
      const appUrl = Deno.env.get("SUBSCRIPTION_APP_URL") || Deno.env.get("APP_URL") || "";
      const renewLink = appUrl ? `${appUrl.replace(/\/$/, "")}/admin/subscription` : "/admin/subscription";
      const html = `
        <p>Hello ${n.admin_name || "Administrator"},</p>
        <p>${body.replace(/\n/g, "<br>")}</p>
        ${appUrl ? `<p><a href="${renewLink}">Renew subscription</a></p>` : ""}
        <p><em>${n.school_name || "Your organization"}</em></p>
      `;
      if (await sendEmail(email, title, html)) emailsSent++;
    }

    if (phone) {
      const smsBody = `${title}: ${body} Renew at your admin portal.`;
      if (await sendSms(phone, smsBody.slice(0, 160))) smsSent++;
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      result: {
        expired: result.expired ?? 0,
        reminded: result.reminded ?? 0,
        locked: result.locked ?? 0,
        emails_sent: emailsSent,
        sms_sent: smsSent,
      },
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
