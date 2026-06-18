import { invokeEdgeFunction, isEdgeFunctionUnreachable } from "@/lib/invokeEdgeFunction";

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

const checkoutBody = (payload: PlatformSubscriptionCheckoutPayload) => ({
  plan_id: payload.plan_id,
  billing_cycle: payload.billing_cycle,
  enable_sms: payload.enable_sms,
  package_amount: payload.package_amount,
  sms_amount: payload.sms_amount,
  total_amount: payload.total_amount,
  callback_url: payload.callback_url,
});

/**
 * Start organization subscription checkout.
 * Uses `paystack` first (already deployed with CORS + verify_jwt off), then
 * `platform-subscription-init` if paystack is unreachable.
 */
export async function initPlatformSubscriptionCheckout(
  payload: PlatformSubscriptionCheckoutPayload,
): Promise<PlatformSubscriptionCheckoutInit> {
  const body = checkoutBody(payload);

  try {
    return await invokeEdgeFunction<PlatformSubscriptionCheckoutInit>("paystack", {
      action: "platform-subscription-init",
      ...body,
    });
  } catch (paystackError) {
    if (!isEdgeFunctionUnreachable(paystackError)) {
      throw paystackError;
    }
    return invokeEdgeFunction<PlatformSubscriptionCheckoutInit>("platform-subscription-init", body);
  }
}

export function normalizeCheckoutResponse(
  response: PlatformSubscriptionCheckoutInit,
  expectedTotal: number,
): PlatformSubscriptionCheckoutInit {
  if (typeof response.total_amount === "number") return response;

  const pkg = Number(response.package_amount ?? 0);
  const sms = Number(response.sms_amount ?? 0);
  if (pkg > 0 && sms > 0) {
    return { ...response, total_amount: pkg + sms };
  }
  if (typeof response.authorization_url === "string" && Math.abs(expectedTotal - pkg) <= 0.02) {
    return { ...response, total_amount: expectedTotal, sms_amount: 0 };
  }
  return response;
}

export function assertCheckoutTotalMatches(
  response: PlatformSubscriptionCheckoutInit,
  expectedTotal: number,
  smsEnabled: boolean,
  smsAmount: number,
): void {
  const normalized = normalizeCheckoutResponse(response, expectedTotal);

  if (typeof normalized.total_amount !== "number") {
    throw new Error(
      "Payment server did not return a total amount. Redeploy the paystack edge function from this repo (Supabase Dashboard → Edge Functions → paystack).",
    );
  }
  if (Math.abs(normalized.total_amount - expectedTotal) > 0.02) {
    throw new Error(
      `Paystack total (GHS ${normalized.total_amount}) does not match checkout (GHS ${expectedTotal}). Redeploy the paystack edge function.`,
    );
  }
  if (smsEnabled && smsAmount > 0 && (normalized.sms_amount ?? 0) <= 0) {
    throw new Error(
      "SMS fee was not included in the Paystack charge. Redeploy the paystack edge function.",
    );
  }
}
