/// <reference path="../deno-shim.d.ts" />
/**
 * Send WhatsApp messages to linked parent contacts.
 *
 * Providers (env):
 *   WHATSAPP_PROVIDER = cloud_api | gupshup | log (default: cloud_api if token set, else log)
 *   WHATSAPP_CLOUD_ACCESS_TOKEN / WHATSAPP_CLOUD_PHONE_NUMBER_ID / WHATSAPP_CLOUD_API_VERSION
 *   GUPSHUP_API_KEY / GUPSHUP_APP_NAME / GUPSHUP_SOURCE_NUMBER / GUPSHUP_BASE_URL
 *
 * Body:
 *   { delivery_id } — process one pending row
 *   { delivery_ids: string[] } — process many
 *   { school_id, message_type, student_id?, parent_id?, message_body, related_entity_type?, related_entity_id?, force? }
 *     — create + send immediately
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type DeliveryRow = {
  id: string;
  school_id: string;
  student_id: string | null;
  parent_id: string | null;
  recipient_phone: string | null;
  recipient_name: string | null;
  message_type: string;
  related_entity_type: string | null;
  related_entity_id: string | null;
  message_body: string | null;
  document_url: string | null;
  status: string;
  attempt_count: number;
  max_attempts: number;
  idempotency_key: string | null;
  metadata: Record<string, unknown> | null;
};

function normalizePhone(raw: string, defaultCountry = "233"): string | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith(defaultCountry) && digits.length >= 11) return digits;
  if (digits.startsWith("0") && digits.length >= 10) return `${defaultCountry}${digits.slice(1)}`;
  let local = digits;
  if (local.startsWith("0")) local = local.slice(1);
  if (local.length >= 8 && local.length <= 10) return `${defaultCountry}${local}`;
  return local.length >= 10 ? local : null;
}

function providerType(): string {
  const env = (Deno.env.get("WHATSAPP_PROVIDER") || "").trim().toLowerCase();
  if (env) return env;
  if (Deno.env.get("WHATSAPP_CLOUD_ACCESS_TOKEN") && Deno.env.get("WHATSAPP_CLOUD_PHONE_NUMBER_ID")) {
    return "cloud_api";
  }
  if (Deno.env.get("GUPSHUP_API_KEY")) return "gupshup";
  return "log";
}

async function sendCloudApi(toE164: string, body: string, documentUrl?: string | null): Promise<{ ok: boolean; id?: string; error?: string }> {
  const token = Deno.env.get("WHATSAPP_CLOUD_ACCESS_TOKEN") || "";
  const phoneNumberId = Deno.env.get("WHATSAPP_CLOUD_PHONE_NUMBER_ID") || "";
  const version = Deno.env.get("WHATSAPP_CLOUD_API_VERSION") || "v20.0";
  if (!token || !phoneNumberId) {
    return { ok: false, error: "WhatsApp Cloud API credentials are not configured" };
  }

  const url = `https://graph.facebook.com/${version}/${phoneNumberId}/messages`;
  const payload = documentUrl
    ? {
        messaging_product: "whatsapp",
        to: toE164,
        type: "document",
        document: { link: documentUrl, caption: body.slice(0, 1024) },
      }
    : {
        messaging_product: "whatsapp",
        to: toE164,
        type: "text",
        text: { body: body.slice(0, 4096) },
      };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err =
      (json as { error?: { message?: string } })?.error?.message ||
      `Cloud API HTTP ${res.status}`;
    return { ok: false, error: err };
  }
  const id = (json as { messages?: Array<{ id?: string }> })?.messages?.[0]?.id;
  return { ok: true, id };
}

async function sendGupshup(toE164: string, body: string): Promise<{ ok: boolean; id?: string; error?: string }> {
  const apiKey = Deno.env.get("GUPSHUP_API_KEY") || "";
  const appName = Deno.env.get("GUPSHUP_APP_NAME") || "";
  const source = Deno.env.get("GUPSHUP_SOURCE_NUMBER") || "";
  const baseUrl = (Deno.env.get("GUPSHUP_BASE_URL") || "https://api.gupshup.io").replace(/\/$/, "");
  if (!apiKey || !source) {
    return { ok: false, error: "Gupshup WhatsApp credentials are not configured" };
  }

  const form = new URLSearchParams();
  form.set("channel", "whatsapp");
  form.set("source", source.replace(/\D/g, ""));
  form.set("destination", toE164);
  form.set("message", JSON.stringify({ type: "text", text: body.slice(0, 4096) }));
  if (appName) form.set("src.name", appName);

  const res = await fetch(`${baseUrl}/wa/api/v1/msg`, {
    method: "POST",
    headers: {
      apikey: apiKey,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false,
      error: (json as { message?: string }).message || `Gupshup HTTP ${res.status}`,
    };
  }
  return {
    ok: true,
    id: String((json as { messageId?: string }).messageId || (json as { id?: string }).id || ""),
  };
}

async function sendViaProvider(
  toE164: string,
  body: string,
  documentUrl?: string | null,
): Promise<{ ok: boolean; id?: string; error?: string; provider: string }> {
  const provider = providerType();
  if (provider === "log") {
    console.log("[whatsapp:log]", { to: toE164, body: body.slice(0, 200), documentUrl });
    return { ok: true, id: `log-${crypto.randomUUID()}`, provider: "log" };
  }
  if (provider === "gupshup") {
    const r = await sendGupshup(toE164, body);
    return { ...r, provider: "gupshup" };
  }
  const r = await sendCloudApi(toE164, body, documentUrl);
  return { ...r, provider: "cloud_api" };
}

async function resolveParentPhone(
  admin: SupabaseClient,
  parentId: string | null,
  fallbackPhone: string | null,
  defaultCountry: string,
): Promise<{ phone: string | null; name: string | null; parentId: string | null }> {
  if (!parentId && fallbackPhone) {
    return { phone: normalizePhone(fallbackPhone, defaultCountry), name: null, parentId: null };
  }
  if (!parentId) return { phone: null, name: null, parentId: null };

  const { data } = await admin
    .from("parents")
    .select("id, phone, emergency_contact, whatsapp_number, profiles:user_id(full_name, phone)")
    .eq("id", parentId)
    .maybeSingle();

  const row = data as {
    id: string;
    phone?: string | null;
    emergency_contact?: string | null;
    whatsapp_number?: string | null;
    profiles?: { full_name?: string | null; phone?: string | null } | null;
  } | null;

  const raw =
    row?.whatsapp_number?.trim() ||
    row?.phone?.trim() ||
    row?.profiles?.phone?.trim() ||
    row?.emergency_contact?.trim() ||
    fallbackPhone ||
    "";

  return {
    phone: normalizePhone(raw, defaultCountry),
    name: row?.profiles?.full_name?.trim() || null,
    parentId: row?.id ?? parentId,
  };
}

async function loadCountryCode(admin: SupabaseClient, schoolId: string): Promise<string> {
  const { data } = await admin
    .from("school_settings")
    .select("whatsapp_default_country_code, whatsapp_enabled")
    .eq("school_id", schoolId)
    .maybeSingle();
  const code = (data as { whatsapp_default_country_code?: string } | null)?.whatsapp_default_country_code;
  return (code || "233").replace(/\D/g, "") || "233";
}

async function processDelivery(
  admin: SupabaseClient,
  delivery: DeliveryRow,
): Promise<{ ok: boolean; error?: string }> {
  const country = await loadCountryCode(admin, delivery.school_id);

  const { data: settings } = await admin
    .from("school_settings")
    .select("whatsapp_enabled")
    .eq("school_id", delivery.school_id)
    .maybeSingle();

  if ((settings as { whatsapp_enabled?: boolean } | null)?.whatsapp_enabled === false) {
    await admin
      .from("whatsapp_deliveries")
      .update({
        status: "skipped",
        error_message: "WhatsApp is disabled for this school",
        updated_at: new Date().toISOString(),
      })
      .eq("id", delivery.id);
    return { ok: false, error: "WhatsApp disabled" };
  }

  let phone = delivery.recipient_phone
    ? normalizePhone(delivery.recipient_phone, country)
    : null;
  let recipientName = delivery.recipient_name;

  if (!phone && delivery.parent_id) {
    const resolved = await resolveParentPhone(admin, delivery.parent_id, null, country);
    phone = resolved.phone;
    recipientName = recipientName || resolved.name;
  }

  if (!phone) {
    await admin
      .from("whatsapp_deliveries")
      .update({
        status: "failed",
        error_message: "No valid linked WhatsApp / phone number for parent contact",
        recipient_name: recipientName,
        attempt_count: delivery.attempt_count + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", delivery.id);
    return { ok: false, error: "No valid phone" };
  }

  const body = (delivery.message_body || "").trim();
  if (!body) {
    await admin
      .from("whatsapp_deliveries")
      .update({
        status: "failed",
        error_message: "Message body is empty",
        attempt_count: delivery.attempt_count + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", delivery.id);
    return { ok: false, error: "Empty message" };
  }

  await admin
    .from("whatsapp_deliveries")
    .update({
      status: "sending",
      recipient_phone: phone,
      recipient_name: recipientName,
      attempt_count: delivery.attempt_count + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", delivery.id);

  const result = await sendViaProvider(phone, body, delivery.document_url);

  if (!result.ok) {
    const failed =
      delivery.attempt_count + 1 >= (delivery.max_attempts || 3) ? "failed" : "pending";
    await admin
      .from("whatsapp_deliveries")
      .update({
        status: failed,
        provider: result.provider,
        error_message: result.error || "Send failed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", delivery.id);
    return { ok: false, error: result.error };
  }

  await admin
    .from("whatsapp_deliveries")
    .update({
      status: "sent",
      provider: result.provider,
      provider_message_id: result.id || null,
      recipient_phone: phone,
      recipient_name: recipientName,
      sent_at: new Date().toISOString(),
      error_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", delivery.id);

  return { ok: true };
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

    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const ids: string[] = [];

    if (typeof body.delivery_id === "string") ids.push(body.delivery_id);
    if (Array.isArray(body.delivery_ids)) {
      for (const id of body.delivery_ids) {
        if (typeof id === "string") ids.push(id);
      }
    }

    // Create-and-send path
    if (ids.length === 0 && body.school_id && body.message_type && body.message_body) {
      const insertRow = {
        school_id: body.school_id,
        student_id: body.student_id ?? null,
        parent_id: body.parent_id ?? null,
        recipient_phone: body.recipient_phone ?? null,
        recipient_name: body.recipient_name ?? null,
        message_type: body.message_type,
        related_entity_type: body.related_entity_type ?? null,
        related_entity_id: body.related_entity_id ?? null,
        message_body: body.message_body,
        document_url: body.document_url ?? null,
        status: "queued",
        queued_at: new Date().toISOString(),
        created_by: user.id,
        idempotency_key: body.idempotency_key ?? null,
        metadata: body.metadata ?? {},
      };

      let deliveryId: string | null = null;
      if (insertRow.idempotency_key && !body.force) {
        const { data: existing } = await admin
          .from("whatsapp_deliveries")
          .select("id, status")
          .eq("school_id", insertRow.school_id)
          .eq("idempotency_key", insertRow.idempotency_key)
          .maybeSingle();
        if (existing && (existing as { status: string }).status === "sent") {
          return new Response(
            JSON.stringify({ ok: true, skipped: true, delivery_id: (existing as { id: string }).id }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        if (existing) deliveryId = (existing as { id: string }).id;
      }

      if (!deliveryId) {
        const { data: created, error } = await admin
          .from("whatsapp_deliveries")
          .insert(insertRow)
          .select("id")
          .single();
        if (error) throw error;
        deliveryId = (created as { id: string }).id;
      } else if (body.force) {
        await admin
          .from("whatsapp_deliveries")
          .update({
            status: "queued",
            message_body: insertRow.message_body,
            document_url: insertRow.document_url,
            error_message: null,
            queued_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", deliveryId);
      }

      ids.push(deliveryId!);
    }

    if (ids.length === 0) {
      return new Response(JSON.stringify({ error: "No delivery_id or create payload provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: Array<{ id: string; ok: boolean; error?: string }> = [];
    for (const id of ids) {
      const { data, error } = await admin.from("whatsapp_deliveries").select("*").eq("id", id).maybeSingle();
      if (error || !data) {
        results.push({ id, ok: false, error: error?.message || "Delivery not found" });
        continue;
      }
      const r = await processDelivery(admin, data as DeliveryRow);
      results.push({ id, ...r });
    }

    const sent = results.filter((r) => r.ok).length;
    return new Response(JSON.stringify({ ok: true, sent, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-whatsapp error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
