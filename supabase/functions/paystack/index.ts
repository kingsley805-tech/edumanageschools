import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const MAX_WEBHOOK_ATTEMPTS = 5;

type SupabaseAdmin = ReturnType<typeof createClient>;

const jsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const bytesToBase64 = (bytes: Uint8Array) => {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
};

const base64ToBytes = (b64: string) => {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

const getEncryptionKey = async (): Promise<CryptoKey | null> => {
  const b64 = Deno.env.get("PAYMENT_SECRETS_ENCRYPTION_KEY");
  if (!b64) return null;
  const raw = base64ToBytes(b64.trim());
  if (raw.length !== 32) return null;
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
};

const encryptSecretsPayload = async (secrets: Record<string, string>): Promise<string> => {
  const key = await getEncryptionKey();
  if (!key) throw new Error("PAYMENT_SECRETS_ENCRYPTION_KEY is not set or not 32 bytes (base64)");
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(secrets));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext));
  return `v1:${bytesToBase64(iv)}:${bytesToBase64(ciphertext)}`;
};

const decryptSecretsPayload = async (payload: string): Promise<Record<string, string>> => {
  const key = await getEncryptionKey();
  if (!key) throw new Error("PAYMENT_SECRETS_ENCRYPTION_KEY is not set or not 32 bytes (base64)");
  const parts = payload.split(":");
  if (parts.length !== 3 || parts[0] !== "v1") throw new Error("Invalid ciphertext");
  const iv = base64ToBytes(parts[1]);
  const ciphertext = base64ToBytes(parts[2]);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  const text = new TextDecoder().decode(decrypted);
  return JSON.parse(text) as Record<string, string>;
};

const validateCallbackUrl = (raw: string | undefined | null): string | null => {
  if (raw == null || String(raw).trim() === "") return null;
  let u: URL;
  try {
    u = new URL(String(raw).trim());
  } catch {
    throw new Error("Invalid callback URL");
  }
  if (u.protocol === "https:") return u.toString();
  if (u.protocol === "http:" && (u.hostname === "localhost" || u.hostname === "127.0.0.1")) {
    return u.toString();
  }
  throw new Error("Callback URL must use HTTPS (or http://localhost for development)");
};

const verifyPaystackSignature = async (rawBody: string, signature: string | null, secret: string) => {
  if (!signature) return false;
  const key = new TextEncoder().encode(secret);
  const data = new TextEncoder().encode(rawBody);
  const hmacKey = await globalThis.crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-512" }, false, ["sign"]);
  const signatureBuffer = await globalThis.crypto.subtle.sign("HMAC", hmacKey, data);
  const computedSignature = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return computedSignature === signature;
};

type PaystackCreds = {
  secretKey: string;
  webhookSecret: string;
  configId: string | null;
  callbackUrl: string | null;
};

const loadPaystackGatewayRow = async (
  admin: SupabaseAdmin,
  schoolId: string,
  configId?: string | null,
) => {
  if (configId) {
    const { data, error } = await admin
      .from("tenant_payment_gateway_configs")
      .select(
        "id, school_id, provider, is_enabled, is_test_mode, is_default, callback_url, public_key, merchant_email, paystack_secret_key",
      )
      .eq("id", configId)
      .eq("school_id", schoolId)
      .eq("provider", "paystack")
      .maybeSingle();
    if (error) throw error;
    if (data?.is_enabled) return data;
  }
  const { data: primary } = await admin
    .from("tenant_payment_gateway_configs")
    .select(
      "id, school_id, provider, is_enabled, is_test_mode, is_default, callback_url, public_key, merchant_email, paystack_secret_key",
    )
    .eq("school_id", schoolId)
    .eq("provider", "paystack")
    .eq("is_enabled", true)
    .order("is_default", { ascending: false })
    .limit(1)
    .maybeSingle();
  return primary ?? null;
};

const getSecretsForConfig = async (admin: SupabaseAdmin, configId: string): Promise<Record<string, string>> => {
  const { data, error } = await admin
    .from("tenant_payment_gateway_secrets")
    .select("ciphertext")
    .eq("gateway_config_id", configId)
    .maybeSingle();
  if (error) throw error;
  if (!data?.ciphertext) return {};
  return await decryptSecretsPayload(data.ciphertext);
};

const getPaystackCredentialsForOrg = async (
  admin: SupabaseAdmin,
  schoolId: string,
  preferConfigId?: string | null,
): Promise<PaystackCreds | null> => {
  const row = await loadPaystackGatewayRow(admin, schoolId, preferConfigId);
  if (row) {
    const plain = String((row as { paystack_secret_key?: string | null }).paystack_secret_key ?? "").trim();
    const secrets = await getSecretsForConfig(admin, row.id);
    const sk = plain || secrets.secret_key?.trim() || "";
    if (!sk) return null;
    const wh = secrets.webhook_secret?.trim() || sk;
    return {
      secretKey: sk,
      webhookSecret: wh,
      configId: row.id,
      callbackUrl: row.callback_url ? String(row.callback_url) : null,
    };
  }
  return null;
};

const paystackVerifySignature = async (rawBody: string, headerSig: string | null, secret: string) =>
  verifyPaystackSignature(rawBody, headerSig, secret);

const applySuccessfulCharge = async (
  adminSupabase: SupabaseAdmin,
  input: {
    reference: string;
    amountSubunit: number;
    currency: string;
    channel: string;
    metadata: Record<string, unknown>;
    providerEventLabel: string;
    webhookEventId?: string | null;
    /** Paystack `data.id` from verify / charge object */
    paystackTransactionId?: string | null;
  },
): Promise<{ duplicate: boolean }> => {
  const { reference, amountSubunit, currency, channel, metadata, providerEventLabel, webhookEventId, paystackTransactionId } = input;
  const invoiceId = String(metadata.invoice_id || "");
  const schoolId = String(metadata.school_id || "");
  const gatewayConfigId =
    metadata.gateway_config_id != null && String(metadata.gateway_config_id).trim() !== ""
      ? String(metadata.gateway_config_id)
      : null;

  if (!invoiceId || !schoolId || !reference) {
    throw new Error("Missing metadata or reference");
  }

  const { data: existingPayment } = await adminSupabase
    .from("billing_payments")
    .select("id")
    .eq("gateway_ref", reference)
    .maybeSingle();

  if (existingPayment) {
    return { duplicate: true };
  }

  const paymentAmount = Number(amountSubunit || 0) / 100;
  if (paymentAmount <= 0) {
    throw new Error("Invalid payment amount");
  }

  const method =
    channel === "mobile_money"
      ? "mobile_money"
      : channel === "card"
        ? "card"
        : "bank_transfer";

  const paymentMeta: Record<string, unknown> = {
    provider_event: providerEventLabel,
    provider_channel: channel || null,
  };
  if (webhookEventId) {
    paymentMeta.webhook_event_id = webhookEventId;
  } else {
    paymentMeta.confirmed_via = "return_url";
  }

  const { data: insertedPayment, error: payInsertError } = await adminSupabase
    .from("billing_payments")
    .insert({
      school_id: schoolId,
      invoice_id: invoiceId,
      amount: paymentAmount,
      currency,
      method,
      gateway: "paystack",
      gateway_ref: reference,
      paystack_transaction_id: paystackTransactionId != null && String(paystackTransactionId).trim() !== ""
        ? String(paystackTransactionId).trim()
        : null,
      gateway_config_id: gatewayConfigId,
      payer_user_id: typeof metadata.payer_user_id === "string" ? metadata.payer_user_id : null,
      payer_role: typeof metadata.payer_role === "string" ? metadata.payer_role : null,
      payer_name: typeof metadata.payer_name === "string" ? metadata.payer_name : null,
      payment_context: typeof metadata.payment_context === "string" ? metadata.payment_context : "school_fee",
      status: "paid",
      paid_at: new Date().toISOString(),
      metadata: paymentMeta,
    })
    .select("id")
    .single();

  if (payInsertError) throw payInsertError;

  const { data: invoice } = await adminSupabase
    .from("billing_invoices")
    .select("total_amount, amount_paid, school_id, invoice_number, student_id")
    .eq("id", invoiceId)
    .eq("school_id", schoolId)
    .single();

  if (invoice) {
    const newAmountPaid = Number(invoice.amount_paid) + paymentAmount;
    const totalAmount = Number(invoice.total_amount);
    const newBalance = totalAmount - newAmountPaid;

    await adminSupabase
      .from("billing_invoices")
      .update({
        amount_paid: newAmountPaid,
        balance_due: Math.max(0, newBalance),
        status: newBalance <= 0 ? "paid" : "partially_paid",
        paid_at: newBalance <= 0 ? new Date().toISOString() : null,
      })
      .eq("id", invoiceId);
  }

  let studentDisplay = "";
  if (invoice?.student_id) {
    const { data: st } = await adminSupabase
      .from("students")
      .select("first_name, last_name, student_id, user_id")
      .eq("id", invoice.student_id)
      .maybeSingle();
    if (st) {
      const fn = String(st.first_name ?? "").trim();
      const ln = String(st.last_name ?? "").trim();
      const isPlaceholder = fn.toLowerCase() === "pending" && ln.toLowerCase() === "enrollment";
      let displayName = isPlaceholder ? "" : `${fn} ${ln}`.trim();
      if (isPlaceholder && st.user_id) {
        const { data: prof } = await adminSupabase
          .from("profiles")
          .select("first_name, last_name")
          .eq("user_id", st.user_id)
          .maybeSingle();
        if (prof) {
          displayName = `${prof.first_name ?? ""} ${prof.last_name ?? ""}`.trim();
        }
      }
      if (!displayName) displayName = String(st.student_id ?? "").trim();
      studentDisplay = `${displayName} — ${st.student_id}`;
    }
  }

  await adminSupabase.from("audit_logs").insert({
    school_id: schoolId,
    user_id: typeof metadata.payer_user_id === "string" ? metadata.payer_user_id : null,
    action: "online_payment_received",
    entity: "payments",
    entity_id: insertedPayment?.id ?? invoiceId,
    after_data: {
      payment_id: insertedPayment?.id,
      invoice_id: invoiceId,
      invoice_number: invoice?.invoice_number ?? null,
      amount: paymentAmount,
      currency,
      method,
      gateway: "paystack",
      gateway_ref: reference,
      paystack_transaction_id: paystackTransactionId != null && String(paystackTransactionId).trim() !== ""
        ? String(paystackTransactionId).trim()
        : null,
      gateway_config_id: gatewayConfigId,
      student_display: studentDisplay || null,
      payer_name: typeof metadata.payer_name === "string" ? metadata.payer_name : null,
      invoice_status_after: invoice
        ? (Number(invoice.amount_paid) + paymentAmount >= Number(invoice.total_amount) ? "paid" : "partially_paid")
        : null,
    },
  });

  return { duplicate: false };
};

const processWebhookEvent = async (adminSupabase: SupabaseAdmin, event: Record<string, unknown>, eventId: string) => {
  const eventType = String(event?.event || "");
  if (eventType !== "charge.success") {
    await adminSupabase
      .from("paystack_webhook_events")
      .update({ status: "ignored", processed_at: new Date().toISOString() })
      .eq("id", eventId);
    return;
  }

  const eventData = (event.data as Record<string, unknown>) || {};
  const reference = String(eventData.reference || "");
  const amount = Number(eventData.amount || 0);
  const metadata = (eventData.metadata as Record<string, unknown>) || {};
  const channel = String(eventData.channel || "");

  const paystackTransactionId = eventData.id != null && eventData.id !== "" ? String(eventData.id) : null;

  await applySuccessfulCharge(adminSupabase, {
    reference,
    amountSubunit: amount,
    currency: String(eventData.currency || "GHS"),
    channel,
    metadata,
    providerEventLabel: eventType,
    webhookEventId: eventId,
    paystackTransactionId,
  });

  await adminSupabase
    .from("paystack_webhook_events")
    .update({ status: "processed", processed_at: new Date().toISOString(), last_error: null, next_retry_at: null })
    .eq("id", eventId);
};

const assertOrgGatewayAdmin = async (
  supabase: SupabaseAdmin,
  userId: string,
): Promise<{ schoolId: string }> => {
  const { data: profile, error: pErr } = await supabase.from("profiles").select("school_id").eq("id", userId).maybeSingle();
  if (pErr) throw pErr;

  const { data: roleRows, error: rErr } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (rErr) throw rErr;
  const roles = (roleRows || []).map((r) => r.role);
  const ok = roles.includes("admin") || roles.includes("super_admin") || roles.includes("accountant") || roles.includes("org_admin");
  if (!ok) throw new Error("Forbidden");
  if (!profile?.school_id && !roles.includes("super_admin")) throw new Error("Organization not found");
  return { schoolId: profile?.school_id ?? "" };
};

const validatePaystackSecretKey = async (secretKey: string): Promise<boolean> => {
  const res = await fetch("https://api.paystack.co/bank?currency=NGN", {
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  return res.ok;
};

const isValidPaystackPublicKeyFormat = (k: string) =>
  k.startsWith("pk_test_") || k.startsWith("pk_live_");
const isValidPaystackSecretKeyFormat = (k: string) =>
  k.startsWith("sk_test_") || k.startsWith("sk_live_");

const logPaymentWebhook = async (
  admin: SupabaseAdmin,
  row: {
    school_id: string | null;
    provider: string;
    event_type: string | null;
    reference: string | null;
    signature_valid: boolean;
    processing_status: string;
    payload: unknown;
    error_message?: string | null;
  },
) => {
  await admin.from("payment_webhook_logs").insert({
    school_id: row.school_id,
    provider: row.provider,
    event_type: row.event_type,
    reference: row.reference,
    signature_valid: row.signature_valid,
    processing_status: row.processing_status,
    payload: row.payload,
    error_message: row.error_message ?? null,
  });
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const url = new URL(req.url);
    const pathLast = url.pathname.split("/").filter(Boolean).pop() || "";

    if (pathLast === "webhook" && req.method === "POST") {
      const rawBody = await req.text();
      const signature = req.headers.get("x-paystack-signature");
      let event: Record<string, unknown>;
      try {
        event = JSON.parse(rawBody) as Record<string, unknown>;
      } catch {
        return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: corsHeaders });
      }

      const eventData = (event.data as Record<string, unknown>) || {};
      const metadata = (eventData.metadata as Record<string, unknown>) || {};
      const orgIdMeta = metadata.school_id != null ? String(metadata.school_id) : null;

      const adminSupabase = createClient(supabaseUrl, serviceKey);

      let verified = false;

      if (orgIdMeta) {
        const creds = await getPaystackCredentialsForOrg(adminSupabase, orgIdMeta);
        if (creds && (await paystackVerifySignature(rawBody, signature, creds.webhookSecret))) {
          verified = true;
        }
      }

      await logPaymentWebhook(adminSupabase, {
        school_id: orgIdMeta,
        provider: "paystack",
        event_type: typeof event.event === "string" ? event.event : null,
        reference: eventData.reference != null ? String(eventData.reference) : null,
        signature_valid: verified,
        processing_status: verified ? "verified" : "failed",
        payload: event,
        error_message: verified ? null : "Invalid Paystack signature",
      });

      if (!verified) {
        return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 401, headers: corsHeaders });
      }

      const reference = event?.data?.reference || null;
      const schoolId = event?.data?.metadata?.school_id || null;

      const { data: existingEvent } = reference
        ? await adminSupabase
            .from("paystack_webhook_events")
            .select("id, status")
            .eq("reference", reference)
            .maybeSingle()
        : { data: null };

      let eventId = existingEvent?.id as string | undefined;
      if (!eventId) {
        const { data: createdEvent, error: insertEventError } = await adminSupabase
          .from("paystack_webhook_events")
          .insert({
            event_type: event?.event || "unknown",
            reference,
            school_id: schoolId,
            payload: event,
            signature,
            status: "pending",
            attempts: 0,
          })
          .select("id")
          .single();

        if (insertEventError || !createdEvent) {
          return jsonResponse({ error: "Unable to queue webhook event" }, 500);
        }
        eventId = createdEvent.id;
      }
      if (!eventId) {
        return jsonResponse({ error: "Unable to resolve webhook event id" }, 500);
      }

      try {
        const { data: row } = await adminSupabase
          .from("paystack_webhook_events")
          .select("attempts")
          .eq("id", eventId)
          .single();
        const attempts = Number(row?.attempts || 0) + 1;

        await adminSupabase
          .from("paystack_webhook_events")
          .update({ status: "processing", attempts, last_error: null })
          .eq("id", eventId);

        await processWebhookEvent(adminSupabase, event, eventId);
      } catch (err: unknown) {
        const { data: retryRow } = await adminSupabase
          .from("paystack_webhook_events")
          .select("attempts")
          .eq("id", eventId)
          .single();
        const retryCount = Number(retryRow?.attempts || 1);
        const nextRetryMinutes = Math.min(60, 2 ** Math.max(retryCount, 1));
        const now = new Date();
        now.setMinutes(now.getMinutes() + nextRetryMinutes);

        await adminSupabase
          .from("paystack_webhook_events")
          .update({
            status: retryCount >= MAX_WEBHOOK_ATTEMPTS ? "failed" : "pending",
            last_error: err instanceof Error ? err.message : "Webhook processing failed",
            next_retry_at: retryCount >= MAX_WEBHOOK_ATTEMPTS ? null : now.toISOString(),
          })
          .eq("id", eventId);

        return jsonResponse({ received: true, queued: true });
      }

      return jsonResponse({ received: true, processed: true });
    }

    let jsonBody: Record<string, unknown> = {};
    if (req.method === "POST") {
      const raw = await req.text();
      if (raw) {
        try {
          jsonBody = JSON.parse(raw) as Record<string, unknown>;
        } catch {
          jsonBody = {};
        }
      }
    }

    const route =
      pathLast === "paystack" && typeof jsonBody.action === "string"
        ? jsonBody.action
        : pathLast;

    if (route === "gateway-list" && req.method === "POST") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) return jsonResponse({ error: "Unauthorized" }, 401);

      const supabase = createClient(supabaseUrl, supabaseKey, {
        global: { headers: { Authorization: authHeader } },
      });

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) return jsonResponse({ error: "Unauthorized" }, 401);

      try {
        const { schoolId } = await assertOrgGatewayAdmin(supabase, user.id);
        const { data: rows, error } = await supabase
          .from("tenant_payment_gateway_configs")
          .select("*")
          .eq("school_id", schoolId)
          .order("provider");
        if (error) throw error;
        const admin = createClient(supabaseUrl, serviceKey);
        const gateways = await Promise.all(
          (rows ?? []).map(async (row: { id: string; paystack_secret_key?: string | null } & Record<string, unknown>) => {
            const plainSk = String(row.paystack_secret_key ?? "").trim();
            const { data: secRow, error: secErr } = await admin
              .from("tenant_payment_gateway_secrets")
              .select("ciphertext")
              .eq("gateway_config_id", row.id)
              .maybeSingle();
            if (secErr) throw secErr;

            let secret_key = plainSk;
            let webhook_secret = "";
            const has_encrypted_secrets = Boolean(secRow?.ciphertext);

            if (secRow?.ciphertext) {
              try {
                const decrypted = await decryptSecretsPayload(secRow.ciphertext);
                if (!secret_key) secret_key = decrypted.secret_key ?? "";
                webhook_secret = decrypted.webhook_secret ?? "";
              } catch (e) {
                if (!plainSk) throw e;
              }
            }

            const secret_key_is_stored =
              Boolean(String(secret_key ?? "").trim()) ||
              Boolean(plainSk) ||
              Boolean(secRow?.ciphertext);

            return {
              ...row,
              secret_key,
              webhook_secret,
              has_encrypted_secrets,
              secret_key_is_stored,
            };
          }),
        );
        return jsonResponse({ gateways });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Forbidden";
        const m = msg.toLowerCase();
        const decryptOrKey =
          m.includes("payment_secrets") ||
          m.includes("decrypt") ||
          m.includes("invalid ciphertext") ||
          m.includes("encrypt");
        return jsonResponse(
          {
            error: decryptOrKey
              ? `${msg} — Set PAYMENT_SECRETS_ENCRYPTION_KEY on the paystack function (Dashboard → Edge Functions → Secrets, or supabase secrets). It must be the same base64-32-byte key used when saving.`
              : msg,
          },
          decryptOrKey ? 500 : 403,
        );
      }
    }

    if (route === "gateway-test" && req.method === "POST") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) return jsonResponse({ error: "Unauthorized" }, 401);

      const supabase = createClient(supabaseUrl, supabaseKey, {
        global: { headers: { Authorization: authHeader } },
      });

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) return jsonResponse({ error: "Unauthorized" }, 401);

      const provider = String(jsonBody.provider || "");
      const secretKeyIn = typeof jsonBody.secret_key === "string" ? jsonBody.secret_key.trim() : "";

      try {
        const { schoolId } = await assertOrgGatewayAdmin(supabase, user.id);
        const admin = createClient(supabaseUrl, serviceKey);

        let secret = secretKeyIn;
        if (!secret && jsonBody.gateway_config_id) {
          const cfgId = String(jsonBody.gateway_config_id);
          const { data: owned } = await admin
            .from("tenant_payment_gateway_configs")
            .select("id")
            .eq("id", cfgId)
            .eq("school_id", schoolId)
            .maybeSingle();
          if (!owned?.id) return jsonResponse({ error: "Gateway configuration not found" }, 404);
          const { data: cfgForTest } = await admin
            .from("tenant_payment_gateway_configs")
            .select("paystack_secret_key")
            .eq("id", cfgId)
            .maybeSingle();
          secret = (cfgForTest?.paystack_secret_key ?? "").trim();
          if (!secret) {
            const secrets = await getSecretsForConfig(admin, cfgId);
            secret = secrets.secret_key?.trim() || "";
          }
        }
        if (provider === "paystack") {
          if (!secret) return jsonResponse({ error: "Missing secret_key or gateway_config_id" }, 400);
          if (!isValidPaystackSecretKeyFormat(secret)) {
            return jsonResponse({
              error: "Paystack secret must start with sk_test_ or sk_live_",
            }, 400);
          }
          const ok = await validatePaystackSecretKey(secret);
          return jsonResponse({ ok, provider: "paystack" });
        }
        return jsonResponse({ ok: false, error: "Provider test not implemented" }, 400);
      } catch (e) {
        return jsonResponse({ error: e instanceof Error ? e.message : "Forbidden" }, 403);
      }
    }

    if (route === "gateway-upsert" && req.method === "POST") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) return jsonResponse({ error: "Unauthorized" }, 401);

      const supabase = createClient(supabaseUrl, supabaseKey, {
        global: { headers: { Authorization: authHeader } },
      });

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) return jsonResponse({ error: "Unauthorized" }, 401);

      let schoolId: string;
      try {
        const r = await assertOrgGatewayAdmin(supabase, user.id);
        schoolId = r.schoolId;
      } catch (e) {
        return jsonResponse({ error: e instanceof Error ? e.message : "Forbidden" }, 403);
      }

      const admin = createClient(supabaseUrl, serviceKey);
      const provider = String(jsonBody.provider || "").trim();
      const allowed = ["paystack", "flutterwave", "stripe", "paypal", "mobile_money", "bank_transfer"];
      if (!allowed.includes(provider)) return jsonResponse({ error: "Invalid provider" }, 400);

      const is_enabled = jsonBody.is_enabled !== false;
      const is_test_mode = jsonBody.is_test_mode !== false;
      const is_default = jsonBody.is_default === true;
      const merchant_email = typeof jsonBody.merchant_email === "string" ? jsonBody.merchant_email.trim() || null : null;
      let callback_url: string | null = null;
      try {
        callback_url = validateCallbackUrl(typeof jsonBody.callback_url === "string" ? jsonBody.callback_url : null);
      } catch (e) {
        return jsonResponse({ error: e instanceof Error ? e.message : "Invalid callback" }, 400);
      }
      const public_key = typeof jsonBody.public_key === "string" ? jsonBody.public_key.trim() || null : null;
      const config_json = typeof jsonBody.config_json === "object" && jsonBody.config_json !== null
        ? jsonBody.config_json as Record<string, unknown>
        : {};

      const existingId = typeof jsonBody.id === "string" ? jsonBody.id : null;
      const secret_key_in = typeof jsonBody.secret_key === "string" ? jsonBody.secret_key.trim() : "";
      const webhook_secret_in = typeof jsonBody.webhook_secret === "string" ? jsonBody.webhook_secret.trim() : "";

      /** Resolved secret used for Paystack API check and connection_status (may be empty for public-key-only draft). */
      let paystackSecretResolved = "";
      if (provider === "paystack") {
        if (!public_key) return jsonResponse({ error: "Paystack public_key is required" }, 400);
        if (!isValidPaystackPublicKeyFormat(public_key)) {
          return jsonResponse({
            error: "Paystack public_key must start with pk_test_ or pk_live_",
          }, 400);
        }
        if (secret_key_in && !isValidPaystackSecretKeyFormat(secret_key_in)) {
          return jsonResponse({
            error: "Paystack secret_key must start with sk_test_ or sk_live_",
          }, 400);
        }

        let secretToValidate = secret_key_in;
        if (existingId && !secret_key_in) {
          const { data: cfgRow } = await admin
            .from("tenant_payment_gateway_configs")
            .select("paystack_secret_key")
            .eq("id", existingId)
            .eq("school_id", schoolId)
            .maybeSingle();
          secretToValidate = (cfgRow?.paystack_secret_key ?? "").trim();
          if (!secretToValidate) {
            const secrets = await getSecretsForConfig(admin, existingId);
            secretToValidate = secrets.secret_key?.trim() || "";
          }
        }

        if (secretToValidate) {
          const valid = await validatePaystackSecretKey(secretToValidate);
          if (!valid) return jsonResponse({ error: "Paystack rejected these credentials" }, 400);
        }
        paystackSecretResolved = secretToValidate;
      }

      let configId = existingId;

      if (!configId) {
        const { data: inserted, error: insErr } = await admin
          .from("tenant_payment_gateway_configs")
          .insert({
            school_id: schoolId,
            provider,
            is_enabled,
            is_test_mode,
            is_default,
            connection_status: provider === "paystack"
              ? (paystackSecretResolved ? "connected" : "disconnected")
              : "disconnected",
            last_validated_at: provider === "paystack" && paystackSecretResolved
              ? new Date().toISOString()
              : null,
            merchant_email,
            callback_url,
            public_key,
            config_json,
            paystack_secret_key: provider === "paystack" && secret_key_in ? secret_key_in : null,
          })
          .select("id")
          .single();
        if (insErr) return jsonResponse({ error: insErr.message }, 400);
        configId = inserted!.id;
      } else {
        const updatePayload: Record<string, unknown> = {
          is_enabled,
          is_test_mode,
          is_default,
          merchant_email,
          callback_url,
          public_key,
          config_json,
          connection_status: provider === "paystack"
            ? (paystackSecretResolved ? "connected" : "disconnected")
            : "disconnected",
          last_validated_at: provider === "paystack" && paystackSecretResolved
            ? new Date().toISOString()
            : null,
          updated_at: new Date().toISOString(),
        };
        if (provider === "paystack" && secret_key_in) {
          updatePayload.paystack_secret_key = secret_key_in;
        }
        const { error: updErr } = await admin
          .from("tenant_payment_gateway_configs")
          .update(updatePayload)
          .eq("id", configId)
          .eq("school_id", schoolId);
        if (updErr) return jsonResponse({ error: updErr.message }, 400);
      }

      if (is_default) {
        await admin
          .from("tenant_payment_gateway_configs")
          .update({ is_default: false, updated_at: new Date().toISOString() })
          .eq("school_id", schoolId)
          .neq("id", configId!);
      }

      if (provider === "paystack" && (secret_key_in || webhook_secret_in)) {
        const prev = existingId ? await getSecretsForConfig(admin, configId!) : {};
        const nextSecrets: Record<string, string> = { ...prev };
        if (secret_key_in) nextSecrets.secret_key = secret_key_in;
        if (webhook_secret_in) nextSecrets.webhook_secret = webhook_secret_in;
        const ciphertext = await encryptSecretsPayload(nextSecrets);
        const { error: secErr } = await admin.from("tenant_payment_gateway_secrets").upsert(
          {
            gateway_config_id: configId!,
            ciphertext,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "gateway_config_id" },
        );
        if (secErr) return jsonResponse({ error: secErr.message }, 400);
      } else if (provider !== "paystack" && secret_key_in) {
        const ciphertext = await encryptSecretsPayload({ secret_key: secret_key_in, ...(webhook_secret_in ? { webhook_secret: webhook_secret_in } : {}) });
        const { error: secErr } = await admin.from("tenant_payment_gateway_secrets").upsert(
          {
            gateway_config_id: configId!,
            ciphertext,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "gateway_config_id" },
        );
        if (secErr) return jsonResponse({ error: secErr.message }, 400);
      }

      await admin.from("tenant_payment_gateway_audit").insert({
        school_id: schoolId,
        user_id: user.id,
        action: existingId ? "update" : "create",
        provider,
        gateway_config_id: configId!,
        summary: {
          is_enabled,
          is_test_mode,
          is_default,
          has_callback: Boolean(callback_url),
        },
      });

      return jsonResponse({ id: configId, ok: true });
    }

    if (route === "initialize" && req.method === "POST") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return jsonResponse({ error: "Unauthorized" }, 401);
      }

      const supabase = createClient(supabaseUrl, supabaseKey, {
        global: { headers: { Authorization: authHeader } },
      });

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) {
        return jsonResponse({ error: "Unauthorized" }, 401);
      }

      const invoice_id = typeof jsonBody.invoice_id === "string" ? jsonBody.invoice_id.trim() : "";
      const callback_url = jsonBody.callback_url;

      if (!invoice_id) {
        return jsonResponse({ error: "Missing required field: invoice_id" }, 400);
      }

      const { data: invoice, error: invError } = await supabase
        .from("billing_invoices")
        .select("id, invoice_number, total_amount, amount_paid, balance_due, status, currency, school_id")
        .eq("id", invoice_id)
        .single();

      if (invError || !invoice) {
        return jsonResponse({ error: "Invoice not found" }, 404);
      }

      const totalAmount = Number(invoice.total_amount);
      const alreadyPaid = Number(invoice.amount_paid || 0);
      const outstanding = Number(invoice.balance_due ?? Math.max(0, totalAmount - alreadyPaid));

      const [{ data: rolesData }, { data: profileData }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user.id).limit(1),
        supabase.from("profiles").select("email, full_name").eq("id", user.id).maybeSingle(),
      ]);

      const payerRole = rolesData?.[0]?.role ?? null;

      // Treat auto-generated student logins (e.g. "<uuid>.<admno>@students.app"
      // or "...@school.local") as not real emails — Paystack rejects them.
      const isSyntheticEmail = (e: string) =>
        !e || /@(students\.app|school\.local|local)$/i.test(e) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

      const emailFromBody = typeof jsonBody.email === "string" ? jsonBody.email.trim() : "";
      const authEmail = typeof user.email === "string" ? user.email.trim() : "";
      const profileEmail = typeof profileData?.email === "string" ? profileData.email.trim() : "";

      let email = [emailFromBody, authEmail, profileEmail].find((e) => e && !isSyntheticEmail(e)) ?? "";

      // Students: fall back to their guardian/parent email, then the school merchant email.
      if (!email && payerRole === "student") {
        const adminClient = createClient(supabaseUrl, serviceKey);
        const { data: studentRow } = await adminClient
          .from("students")
          .select("guardian_id")
          .eq("user_id", user.id)
          .maybeSingle();
        if (studentRow?.guardian_id) {
          const { data: parentRow } = await adminClient
            .from("parents")
            .select("user_id")
            .eq("id", studentRow.guardian_id)
            .maybeSingle();
          if (parentRow?.user_id) {
            const { data: parentProfile } = await adminClient
              .from("profiles")
              .select("email")
              .eq("id", parentRow.user_id)
              .maybeSingle();
            const pe = typeof parentProfile?.email === "string" ? parentProfile.email.trim() : "";
            if (pe && !isSyntheticEmail(pe)) email = pe;
          }
        }
      }

      // Last-resort: use the school's merchant email so checkout can proceed.
      if (!email) {
        const adminClient = createClient(supabaseUrl, serviceKey);
        const { data: gw } = await adminClient
          .from("payment_gateway_configs")
          .select("merchant_email")
          .eq("school_id", invoice.school_id)
          .eq("is_default", true)
          .maybeSingle();
        const me = typeof gw?.merchant_email === "string" ? gw.merchant_email.trim() : "";
        if (me && !isSyntheticEmail(me)) email = me;
      }

      if (!email) {
        return jsonResponse({
          error:
            payerRole === "student"
              ? "No payer email available. Ask an admin to link a parent with a valid email to this student, or set a merchant email on the school's payment gateway."
              : "No email on your account. Add an email in profile settings before paying online.",
        }, 400);
      }


      const amountIn = jsonBody.amount;
      let paymentAmount =
        amountIn != null && amountIn !== "" ? Number(amountIn) : outstanding;
      if (payerRole === "student" || payerRole === "parent") {
        paymentAmount = outstanding;
      }
      if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
        return jsonResponse({ error: "Amount must be greater than zero" }, 400);
      }
      if (invoice.status === "paid" || invoice.status === "void" || outstanding <= 0) {
        return jsonResponse({ error: "This invoice is already settled and cannot be paid again" }, 400);
      }
      if (paymentAmount > outstanding + 0.005) {
        return jsonResponse({ error: "Amount exceeds outstanding balance" }, 400);
      }

      const admin = createClient(supabaseUrl, serviceKey);
      const creds = await getPaystackCredentialsForOrg(admin, invoice.school_id);
      if (!creds?.secretKey) {
        return jsonResponse({ error: "Payment gateway not configured for this school" }, 400);
      }
      const metadataFullName =
        typeof user.user_metadata?.full_name === "string" ? String(user.user_metadata.full_name).trim() : "";
      const profileName = typeof profileData?.full_name === "string" ? profileData.full_name.trim() : "";
      const payerName = profileName || metadataFullName || String(email);

      let effectiveCallback =
        typeof callback_url === "string" && callback_url.trim()
          ? callback_url.trim()
          : creds.callbackUrl || `${req.headers.get("origin")}/portal/parent`;

      try {
        effectiveCallback = validateCallbackUrl(effectiveCallback) || effectiveCallback;
      } catch {
        effectiveCallback = creds.callbackUrl || `${req.headers.get("origin")}/portal/parent`;
      }

      const reference = `SCH-${String(invoice_id).slice(0, 8)}-${Date.now()}`;

      const paystackRes = await fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${creds.secretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          amount: Math.round(paymentAmount * 100),
          currency: invoice.currency === "GHS" ? "GHS" : invoice.currency === "NGN" ? "NGN" : "USD",
          reference,
          callback_url: effectiveCallback,
          metadata: {
            invoice_id,
            invoice_number: invoice.invoice_number,
            school_id: invoice.school_id,
            ...(creds.configId ? { gateway_config_id: creds.configId } : {}),
            payer_user_id: user.id,
            payer_role: payerRole,
            payer_name: payerName,
            payment_context: "school_fee",
          },
        }),
      });

      const paystackData = await paystackRes.json();

      if (!paystackData.status) {
        return jsonResponse({ error: paystackData.message || "Paystack initialization failed" }, 400);
      }

      await admin.from("payment_checkout_sessions").upsert({
        reference: paystackData.data.reference,
        school_id: invoice.school_id,
        gateway_config_id: creds.configId,
        invoice_id: String(invoice_id),
        created_at: new Date().toISOString(),
      }, { onConflict: "reference" });

      return jsonResponse({
        authorization_url: paystackData.data.authorization_url,
        reference: paystackData.data.reference,
        access_code: paystackData.data.access_code,
      });
    }

    if (route === "retry-webhooks" && req.method === "POST") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) return jsonResponse({ error: "Unauthorized" }, 401);

      const supabase = createClient(supabaseUrl, supabaseKey, {
        global: { headers: { Authorization: authHeader } },
      });

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) return jsonResponse({ error: "Unauthorized" }, 401);

      const { data: profile } = await supabase.from("profiles").select("school_id").eq("user_id", user.id).maybeSingle();
      if (!profile?.school_id) return jsonResponse({ error: "Organization not found" }, 400);

      const { data: roleRows } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      const roles = (roleRows || []).map((r) => r.role);
      const isAdmin = roles.includes("org_admin") || roles.includes("super_admin");
      if (!isAdmin) return jsonResponse({ error: "Only admins can retry webhooks" }, 403);

      const adminSupabase = createClient(supabaseUrl, serviceKey);

      const nowIso = new Date().toISOString();
      const { data: events } = await adminSupabase
        .from("paystack_webhook_events")
        .select("id, payload, attempts")
        .eq("school_id", profile.school_id)
        .in("status", ["pending", "failed"])
        .or(`next_retry_at.is.null,next_retry_at.lte.${nowIso}`)
        .order("created_at", { ascending: true })
        .limit(20);

      if (!events || events.length === 0) return jsonResponse({ retried: 0, processed: 0, failed: 0 });

      let processed = 0;
      let failed = 0;
      for (const evt of events) {
        const attempts = Number(evt.attempts || 0) + 1;
        await adminSupabase.from("paystack_webhook_events").update({ status: "processing", attempts }).eq("id", evt.id);
        try {
          await processWebhookEvent(adminSupabase, evt.payload, evt.id);
          processed += 1;
        } catch (err: unknown) {
          const nextRetryMinutes = Math.min(60, 2 ** attempts);
          const nextRetry = new Date();
          nextRetry.setMinutes(nextRetry.getMinutes() + nextRetryMinutes);
          await adminSupabase
            .from("paystack_webhook_events")
            .update({
              status: attempts >= MAX_WEBHOOK_ATTEMPTS ? "failed" : "pending",
              last_error: err instanceof Error ? err.message : "Retry failed",
              next_retry_at: attempts >= MAX_WEBHOOK_ATTEMPTS ? null : nextRetry.toISOString(),
            })
            .eq("id", evt.id);
          failed += 1;
        }
      }

      return jsonResponse({ retried: events.length, processed, failed });
    }

    if (route === "transfer" && req.method === "POST") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return jsonResponse({ error: "Unauthorized" }, 401);
      }

      const supabase = createClient(supabaseUrl, supabaseKey, {
        global: { headers: { Authorization: authHeader } },
      });

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        return jsonResponse({ error: "Unauthorized" }, 401);
      }

      const adminSupabase = createClient(supabaseUrl, serviceKey);

      const { data: profile } = await supabase
        .from("profiles")
        .select("school_id")
        .eq("user_id", user.id)
        .maybeSingle();

      let schoolId: string | null = profile?.school_id ? String(profile.school_id) : null;
      if (!schoolId) {
        const { data: rpcOrg } = await supabase.rpc("get_user_school_id", { _user_id: user.id });
        if (rpcOrg != null && String(rpcOrg).trim() !== "") {
          schoolId = String(rpcOrg);
        }
      }
      if (!schoolId) {
        return jsonResponse(
          { error: "Organization not found. Link your account to a school or contact support." },
          400,
        );
      }

      const { data: roleRows } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      const roles = (roleRows || []).map((r) => r.role);
      const isAdmin = roles.includes("org_admin") || roles.includes("super_admin");
      let canPaySalary = isAdmin;
      if (!canPaySalary) {
        const { data: permOk } = await adminSupabase.rpc("user_has_payroll_permission", {
          _uid: user.id,
          _org_id: schoolId,
          _require_manage: true,
        });
        canPaySalary = Boolean(permOk);
      }
      if (!canPaySalary) {
        return jsonResponse({ error: "Only admins or users with payroll payment rights can pay salaries" }, 403);
      }

      const paystackSecret = await getPaystackCredentialsForOrg(adminSupabase, schoolId);
      if (!paystackSecret?.secretKey) {
        return jsonResponse({ error: "Paystack not configured for this school" }, 400);
      }
      const PAYSTACK_SECRET_KEY = paystackSecret.secretKey;

      const { salary_id, amount, staff_user_id, month, description, bank_code, account_number, account_name } = jsonBody;

      if (!salary_id || !amount || !staff_user_id || !month) {
        return jsonResponse({ error: "Missing required fields: salary_id, amount, staff_user_id, month" }, 400);
      }

      const { data: salary } = await adminSupabase
        .from("staff_salaries")
        .select("id, school_id, staff_user_id, amount, status")
        .eq("id", salary_id)
        .maybeSingle();

      if (!salary || salary.school_id !== schoolId || salary.staff_user_id !== staff_user_id) {
        return jsonResponse({ error: "Salary record not found" }, 404);
      }

      if (salary.status === "paid") {
        return jsonResponse({ error: "Salary already paid" }, 409);
      }

      const { data: orgRow } = await adminSupabase
        .from("schools")
        .select("currency")
        .eq("id", schoolId)
        .maybeSingle();
      const rawCurrency = String(orgRow?.currency || "GHS").toUpperCase().slice(0, 3);
      const transferCurrency = rawCurrency === "NGN" ? "NGN" : "GHS";
      const recipientType = transferCurrency === "GHS" ? "ghipss" : "nuban";

      let recipientCode: string | null = null;
      const { data: existingBank } = await adminSupabase
        .from("staff_bank_accounts")
        .select("account_number, bank_code, account_name, recipient_code")
        .eq("school_id", schoolId)
        .eq("staff_user_id", staff_user_id)
        .maybeSingle();

      const acctNumber = account_number || existingBank?.account_number;
      const bankCode = bank_code || existingBank?.bank_code;
      const acctName = account_name || existingBank?.account_name || null;
      recipientCode = existingBank?.recipient_code || null;

      if (!recipientCode) {
        if (!acctNumber || !bankCode) {
          return jsonResponse({ error: "Teacher bank details are required for first transfer" }, 400);
        }

        const recipientRes = await fetch("https://api.paystack.co/transferrecipient", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type: recipientType,
            name: acctName || `Teacher ${staff_user_id.slice(0, 8)}`,
            account_number: acctNumber,
            bank_code: bankCode,
            currency: transferCurrency,
          }),
        });

        const recipientData = await recipientRes.json();
        if (!recipientData.status || !recipientData?.data?.recipient_code) {
          return jsonResponse({ error: recipientData?.message || "Failed to create transfer recipient" }, 400);
        }

        recipientCode = recipientData.data.recipient_code;

        await adminSupabase.from("staff_bank_accounts").upsert({
          school_id: schoolId,
          staff_user_id,
          account_number: acctNumber,
          bank_code: bankCode,
          account_name: acctName,
          recipient_code: recipientCode,
        }, { onConflict: "school_id,staff_user_id" });
      }

      const reference = `SAL-${salary_id.slice(0, 8)}-${Date.now()}`;
      const transferRes = await fetch("https://api.paystack.co/transfer", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          source: "balance",
          currency: transferCurrency,
          amount: Math.round(Number(amount) * 100),
          recipient: recipientCode,
          reason: description || `Salary for ${month}`,
          reference,
        }),
      });

      const transferData = await transferRes.json();
      if (!transferData.status) {
        await adminSupabase
          .from("staff_salaries")
          .update({ status: "failed", gateway: "paystack", gateway_ref: reference, notes: transferData?.message || "Transfer failed" })
          .eq("id", salary_id);
        return jsonResponse({ error: transferData?.message || "Transfer failed" }, 400);
      }

      await adminSupabase
        .from("staff_salaries")
        .update({
          status: "paid",
          method: "paystack",
          gateway: "paystack",
          gateway_ref: transferData?.data?.reference || reference,
          paid_at: new Date().toISOString(),
        })
        .eq("id", salary_id)
        .eq("school_id", schoolId);

      await adminSupabase.from("audit_logs").insert({
        school_id: schoolId,
        user_id: user.id,
        action: "salary_transfer_paid",
        entity: "staff_salaries",
        entity_id: salary_id,
        after_data: {
          salary_id,
          staff_user_id,
          amount: Number(amount),
          month,
          reference: transferData?.data?.reference || reference,
          gateway: "paystack",
        },
      });

      return jsonResponse({
        success: true,
        salary_id,
        reference: transferData?.data?.reference || reference,
      });
    }

    if (route === "confirm" && req.method === "POST") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return jsonResponse({ error: "Unauthorized" }, 401);
      }

      const supabase = createClient(supabaseUrl, supabaseKey, {
        global: { headers: { Authorization: authHeader } },
      });

      const {
        data: { user: confirmUser },
        error: confirmUserError,
      } = await supabase.auth.getUser();
      if (confirmUserError || !confirmUser) {
        return jsonResponse({ error: "Unauthorized" }, 401);
      }

      const reference = typeof jsonBody?.reference === "string" ? jsonBody.reference.trim() : "";
      if (!reference) {
        return jsonResponse({ error: "Missing reference" }, 400);
      }

      const adminSupabase = createClient(supabaseUrl, serviceKey);
      const { data: session } = await adminSupabase
        .from("payment_checkout_sessions")
        .select("school_id, gateway_config_id")
        .eq("reference", reference)
        .maybeSingle();

      const secretHolder = session?.school_id
        ? await getPaystackCredentialsForOrg(adminSupabase, session.school_id, session.gateway_config_id)
        : null;
      const paystackSecretKey = secretHolder?.secretKey;
      if (!paystackSecretKey) {
        return jsonResponse(
          { error: "Configure Paystack under Payment gateways for this school, then try again" },
          400,
        );
      }

      const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
        headers: { Authorization: `Bearer ${paystackSecretKey}` },
      });

      const verifyJson = await verifyRes.json();
      const txn = verifyJson?.data as Record<string, unknown> | undefined;
      if (!verifyJson?.status || String(txn?.status || "") !== "success") {
        return jsonResponse(
          { error: typeof verifyJson?.message === "string" ? verifyJson.message : "Payment not successful" },
          400,
        );
      }

      let metadata = (txn?.metadata as Record<string, unknown>) || {};
      if (typeof metadata !== "object" || metadata === null) {
        metadata = {};
      }

      const invoiceId = String(metadata.invoice_id || "");
      const metaOrgId = String(metadata.school_id || "");
      if (!invoiceId || !metaOrgId) {
        return jsonResponse({ error: "Invalid transaction metadata" }, 400);
      }

      const { data: inv, error: invErr } = await supabase
        .from("billing_invoices")
        .select("id, school_id")
        .eq("id", invoiceId)
        .maybeSingle();

      if (invErr || !inv) {
        return jsonResponse({ error: "Invoice not found or access denied" }, 403);
      }
      if (inv.school_id !== metaOrgId) {
        return jsonResponse({ error: "Metadata mismatch" }, 400);
      }

      const channel = String(txn?.channel || "");
      const amountSubunit = Number(txn?.amount || 0);
      const currency = String(txn?.currency || "GHS");
      const ref = String(txn?.reference || reference);
      const paystackTransactionId = txn?.id != null && String(txn.id).trim() !== "" ? String(txn.id) : null;

      const result = await applySuccessfulCharge(adminSupabase, {
        reference: ref,
        amountSubunit,
        currency,
        channel,
        metadata,
        providerEventLabel: "charge.success",
        webhookEventId: null,
        paystackTransactionId,
      });

      return jsonResponse({ ok: true, duplicate: result.duplicate });
    }

    if (route === "verify" && req.method === "GET") {
      const reference = url.searchParams.get("reference");
      if (!reference) {
        return jsonResponse({ error: "Missing reference" }, 400);
      }

      const adminSupabase = createClient(supabaseUrl, serviceKey);
      const { data: session } = await adminSupabase
        .from("payment_checkout_sessions")
        .select("school_id, gateway_config_id")
        .eq("reference", reference)
        .maybeSingle();

      const secretHolder = session?.school_id
        ? await getPaystackCredentialsForOrg(adminSupabase, session.school_id, session.gateway_config_id)
        : null;
      const paystackSecretKey = secretHolder?.secretKey;
      if (!paystackSecretKey) {
        return jsonResponse(
          { error: "Configure Paystack under Payment gateways for this school, then try again" },
          400,
        );
      }

      const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
        headers: { Authorization: `Bearer ${paystackSecretKey}` },
      });

      const verifyData = await verifyRes.json();
      return jsonResponse(verifyData);
    }

    return jsonResponse({ error: "Not found" }, 404);
  } catch (error) {
    console.error("Paystack function error:", error);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
