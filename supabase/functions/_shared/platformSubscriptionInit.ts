import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type PlatformSubscriptionInitBody = Record<string, unknown>;

export type PlatformSubscriptionInitResult = {
  authorization_url: string;
  reference: string;
  package_amount: number;
  sms_amount: number;
  total_amount: number;
  enable_sms: boolean;
};

const parseTruthyBoolean = (value: unknown): boolean =>
  value === true || value === "true" || value === 1 || value === "1";

const validateCallbackUrl = (raw: string | undefined | null, origin: string): string => {
  const fallback = `${origin}/admin/subscription`;
  if (raw == null || String(raw).trim() === "") return fallback;
  let u: URL;
  try {
    u = new URL(String(raw).trim());
  } catch {
    return fallback;
  }
  if (u.protocol === "https:") return u.toString();
  if (u.protocol === "http:" && (u.hostname === "localhost" || u.hostname === "127.0.0.1")) {
    return u.toString();
  }
  return fallback;
};

const getPlatformPaystackSecretFromDb = async (admin: SupabaseClient): Promise<string> => {
  try {
    const { data } = await admin.rpc("get_platform_paystack_config");
    const cfg = (data ?? {}) as { secret_key?: string; is_enabled?: boolean };
    if (cfg && cfg.is_enabled !== false && cfg.secret_key?.trim()) {
      return cfg.secret_key.trim();
    }
  } catch {
    /* ignore */
  }
  return "";
};

const getPlatformPaystackSecret = () =>
  Deno.env.get("PLATFORM_PAYSTACK_SECRET_KEY")?.trim() ||
  Deno.env.get("PAYSTACK_SECRET_KEY")?.trim() ||
  "";

function resolveCheckoutAmounts(
  body: PlatformSubscriptionInitBody,
  plan: Record<string, unknown>,
  billingCycle: "monthly" | "annual",
): { packageAmount: number; smsAmount: number; amount: number; enableSms: boolean } {
  const enableSms = parseTruthyBoolean(body.enable_sms);
  const planPackageAmount =
    billingCycle === "annual" ? Number(plan.price_annual) : Number(plan.price_monthly);
  const planSmsAmount =
    billingCycle === "annual"
      ? Number(plan.sms_addon_fee_annual ?? 0)
      : Number(plan.sms_addon_fee_monthly ?? 0);

  const clientPackageAmount = Number(body.package_amount);
  const clientSmsAmount = Number(body.sms_amount);
  const clientTotalAmount = Number(body.total_amount);

  const packageAmount =
    Number.isFinite(clientPackageAmount) && clientPackageAmount >= 0
      ? clientPackageAmount
      : planPackageAmount;

  let smsAmount = 0;
  if (Number.isFinite(clientSmsAmount) && clientSmsAmount > 0) {
    smsAmount = clientSmsAmount;
  } else if (enableSms && planSmsAmount > 0) {
    smsAmount = planSmsAmount;
  }

  // Checkout UI total is authoritative: Paystack must charge package + SMS together.
  let amount = packageAmount + smsAmount;
  if (Number.isFinite(clientTotalAmount) && clientTotalAmount >= packageAmount) {
    amount = clientTotalAmount;
    smsAmount = Math.max(0, amount - packageAmount);
  }

  const smsEnabled = enableSms || smsAmount > 0;
  if (smsEnabled && smsAmount <= 0) {
    throw new Error("SMS add-on is enabled but no SMS fee is configured");
  }

  if (!Number.isFinite(packageAmount) || packageAmount < 0) {
    throw new Error("Invalid plan price");
  }
  if (!Number.isFinite(amount) || amount < packageAmount) {
    throw new Error("Invalid checkout total");
  }

  return { packageAmount, smsAmount, amount, enableSms: smsEnabled };
}

export async function initPlatformSubscriptionCheckout(
  body: PlatformSubscriptionInitBody,
  authHeader: string,
  origin: string,
): Promise<PlatformSubscriptionInitResult> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const admin = createClient(supabaseUrl, serviceKey);

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) throw new Error("Unauthorized");

  const { data: profile } = await supabase
    .from("profiles")
    .select("school_id, email, full_name")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.school_id) throw new Error("Organization not found");

  const { data: roleRows } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  const roles = (roleRows ?? []).map((r) => r.role);
  if (!roles.includes("admin")) throw new Error("Forbidden");

  const planId = typeof body.plan_id === "string" ? body.plan_id.trim() : "";
  const billingCycle = body.billing_cycle === "annual" ? "annual" : "monthly";
  if (!planId) throw new Error("Missing plan_id");

  const { data: plan, error: planErr } = await admin
    .from("subscription_plans")
    .select("*")
    .eq("id", planId)
    .maybeSingle();
  if (planErr || !plan || !plan.is_active) throw new Error("Plan not found");

  const { packageAmount, smsAmount, amount, enableSms } = resolveCheckoutAmounts(
    body,
    plan as Record<string, unknown>,
    billingCycle,
  );

  let platformSecret = getPlatformPaystackSecret();
  if (!platformSecret) {
    platformSecret = await getPlatformPaystackSecretFromDb(admin);
  }
  if (!platformSecret) {
    throw new Error(
      "Platform Paystack is not configured. Super Admin: Platform → Payment gateway → save Secret key.",
    );
  }

  const email =
    (typeof profile.email === "string" && profile.email.trim()) ||
    (typeof user.email === "string" && user.email.trim()) ||
    "";
  if (!email) throw new Error("Admin email is required for payment");

  const effectiveCallback = validateCallbackUrl(
    typeof body.callback_url === "string" ? body.callback_url : null,
    origin,
  );

  const reference = `ORG-SUB-${String(profile.school_id).slice(0, 8)}-${Date.now()}`;

  const checkoutPayload = {
    reference,
    school_id: profile.school_id,
    plan_id: planId,
    billing_cycle: billingCycle,
    amount,
    package_amount: packageAmount,
    sms_amount: smsAmount,
    enable_sms: enableSms,
    created_by: user.id,
  };

  let { error: checkoutErr } = await admin.from("platform_subscription_checkouts").insert(checkoutPayload);
  if (checkoutErr?.message?.toLowerCase().includes("column")) {
    ({ error: checkoutErr } = await admin.from("platform_subscription_checkouts").insert({
      reference,
      school_id: profile.school_id,
      plan_id: planId,
      billing_cycle: billingCycle,
      amount,
      created_by: user.id,
    }));
  }
  if (checkoutErr) throw new Error(checkoutErr.message);

  const paystackRes = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${platformSecret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      amount: Math.round(amount * 100),
      currency: "GHS",
      reference,
      callback_url: effectiveCallback,
      metadata: {
        payment_context: "platform_subscription",
        school_id: profile.school_id,
        plan_id: planId,
        billing_cycle: billingCycle,
        enable_sms: enableSms,
        package_amount: packageAmount,
        sms_amount: smsAmount,
        total_amount: amount,
        payer_user_id: user.id,
        payer_name: profile.full_name || email,
      },
    }),
  });

  const paystackData = await paystackRes.json();
  if (!paystackData.status) {
    throw new Error(paystackData.message || "Paystack initialization failed");
  }

  return {
    authorization_url: paystackData.data.authorization_url,
    reference: paystackData.data.reference,
    package_amount: packageAmount,
    sms_amount: smsAmount,
    total_amount: amount,
    enable_sms: enableSms,
  };
}
