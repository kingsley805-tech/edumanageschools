import { supabase } from "@/integrations/supabase/client";
import { invokeEdgeFunction } from "@/lib/invokeEdgeFunction";

export type PlatformSubscriptionCheckoutInit = {
  authorization_url?: string;
  reference?: string;
  package_amount?: number;
  sms_amount?: number;
  total_amount?: number;
  enable_sms?: boolean;
  error?: string;
};

export type PlatformSubscriptionCheckoutPayload = {
  plan_id: string;
  billing_cycle: "monthly" | "annual";
  enable_sms: boolean;
  package_amount: number;
  sms_amount: number;
  total_amount: number;
  callback_url: string;
};

function readAmount(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

const checkoutBody = (payload: PlatformSubscriptionCheckoutPayload) => ({
  plan_id: payload.plan_id,
  billing_cycle: payload.billing_cycle,
  enable_sms: payload.enable_sms,
  package_amount: payload.package_amount,
  sms_amount: payload.sms_amount,
  total_amount: payload.total_amount,
  callback_url: payload.callback_url,
});

function parseCheckoutInitPayload(data: unknown): PlatformSubscriptionCheckoutInit {
  if (!data || typeof data !== "object") return {};
  const row = data as Record<string, unknown>;
  if (typeof row.error === "string" && row.error) {
    throw new Error(row.error);
  }
  return row as PlatformSubscriptionCheckoutInit;
}

/** Server must confirm the Paystack charge total — client merge cannot change Paystack's amount. */
function serverTotalMatches(
  response: PlatformSubscriptionCheckoutInit,
  payload: PlatformSubscriptionCheckoutPayload,
): boolean {
  const serverTotal = readAmount(response.total_amount);
  if (serverTotal == null) return false;
  return Math.abs(serverTotal - payload.total_amount) <= 0.02;
}

export function mergeCheckoutResponse(
  response: PlatformSubscriptionCheckoutInit,
  payload: PlatformSubscriptionCheckoutPayload,
): PlatformSubscriptionCheckoutInit {
  const packageAmount = readAmount(response.package_amount) ?? payload.package_amount;
  const smsAmount = readAmount(response.sms_amount) ?? payload.sms_amount;
  const totalAmount = readAmount(response.total_amount) ?? packageAmount + smsAmount;

  return {
    ...response,
    package_amount: packageAmount,
    sms_amount: smsAmount,
    total_amount: totalAmount,
    enable_sms: response.enable_sms ?? payload.enable_sms,
  };
}

async function invokeCheckoutViaRpc(
  payload: PlatformSubscriptionCheckoutPayload,
): Promise<PlatformSubscriptionCheckoutInit | null> {
  const { data, error } = await supabase.rpc("init_platform_subscription_checkout", {
    p_plan_id: payload.plan_id,
    p_billing_cycle: payload.billing_cycle,
    p_enable_sms: payload.enable_sms,
    p_package_amount: payload.package_amount,
    p_sms_amount: payload.sms_amount,
    p_total_amount: payload.total_amount,
    p_callback_url: payload.callback_url,
  });

  if (error) {
    const msg = error.message ?? "";
    if (/Could not find the function|schema cache/i.test(msg)) return null;
    throw new Error(msg);
  }

  const parsed = parseCheckoutInitPayload(data);
  if (!parsed.authorization_url) return null;
  return parsed;
}

async function invokeCheckoutInit(
  payload: PlatformSubscriptionCheckoutPayload,
): Promise<PlatformSubscriptionCheckoutInit> {
  const body = checkoutBody(payload);
  let lastError: unknown;

  try {
    const fromRpc = await invokeCheckoutViaRpc(payload);
    if (fromRpc && serverTotalMatches(fromRpc, payload)) {
      return mergeCheckoutResponse(fromRpc, payload);
    }
  } catch (error) {
    lastError = error;
  }

  const edgeAttempts: Array<() => Promise<PlatformSubscriptionCheckoutInit>> = [
    () => invokeEdgeFunction<PlatformSubscriptionCheckoutInit>("platform-subscription-init", body),
    () =>
      invokeEdgeFunction<PlatformSubscriptionCheckoutInit>("paystack", {
        action: "platform-subscription-init",
        ...body,
      }),
  ];

  for (const call of edgeAttempts) {
    try {
      const raw = await call();
      if (!raw.authorization_url) {
        lastError = new Error("Payment server did not return a checkout URL.");
        continue;
      }
      if (!serverTotalMatches(raw, payload)) {
        const charged = readAmount(raw.total_amount) ?? readAmount(raw.package_amount);
        lastError = new Error(
          charged != null
            ? `Paystack checkout was created for GHS ${charged.toLocaleString()} instead of GHS ${payload.total_amount.toLocaleString()}. Run public/sql/apply-platform-subscription-checkout-rpc.sql in Supabase SQL Editor, or redeploy the paystack edge function.`
            : "Payment server did not confirm the full checkout total (package + SMS). Run public/sql/apply-platform-subscription-checkout-rpc.sql in Supabase SQL Editor.",
        );
        continue;
      }
      return mergeCheckoutResponse(raw, payload);
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError instanceof Error) throw lastError;
  throw new Error("Could not start payment. Please try again.");
}

/**
 * Start organization subscription checkout with package + SMS on Paystack.
 * Prefers DB RPC (no edge redeploy), then edge functions that return a verified total.
 */
export async function initPlatformSubscriptionCheckout(
  payload: PlatformSubscriptionCheckoutPayload,
): Promise<PlatformSubscriptionCheckoutInit> {
  return invokeCheckoutInit(payload);
}

export function normalizeCheckoutResponse(
  response: PlatformSubscriptionCheckoutInit,
  expectedTotal: number,
): PlatformSubscriptionCheckoutInit {
  if (readAmount(response.total_amount) != null) return response;

  const pkg = readAmount(response.package_amount) ?? 0;
  const sms = readAmount(response.sms_amount) ?? 0;
  if (pkg > 0 && sms > 0) {
    return { ...response, total_amount: pkg + sms };
  }
  if (typeof response.authorization_url === "string" && expectedTotal > 0) {
    return { ...response, total_amount: expectedTotal };
  }
  return response;
}

export function assertCheckoutTotalMatches(
  response: PlatformSubscriptionCheckoutInit,
  expectedTotal: number,
  smsEnabled: boolean,
  smsAmount: number,
): void {
  const total = readAmount(response.total_amount) ?? expectedTotal;

  if (Math.abs(total - expectedTotal) > 0.02) {
    throw new Error(
      `Checkout total (GHS ${total.toLocaleString()}) does not match the plan total (GHS ${expectedTotal.toLocaleString()}).`,
    );
  }

  if (smsEnabled && smsAmount > 0) {
    const sms = readAmount(response.sms_amount) ?? smsAmount;
    if (sms <= 0) {
      throw new Error("SMS service fee was not included in this checkout.");
    }
  }
}
