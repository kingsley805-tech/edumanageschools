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

/** Fill missing breakdown fields from the checkout the user confirmed in the UI. */
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

async function invokeCheckoutInit(
  payload: PlatformSubscriptionCheckoutPayload,
): Promise<PlatformSubscriptionCheckoutInit> {
  const body = checkoutBody(payload);

  const attempts: Array<{
    call: () => Promise<PlatformSubscriptionCheckoutInit>;
  }> = [
    {
      call: () => invokeEdgeFunction<PlatformSubscriptionCheckoutInit>("platform-subscription-init", body),
    },
    {
      call: () =>
        invokeEdgeFunction<PlatformSubscriptionCheckoutInit>("paystack", {
          action: "platform-subscription-init",
          ...body,
        }),
    },
  ];

  let lastError: unknown;

  for (const { call } of attempts) {
    try {
      const raw = await call();
      const merged = mergeCheckoutResponse(raw, payload);
      if (merged.authorization_url) return merged;
      lastError = new Error("Payment server did not return a checkout URL.");
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError instanceof Error) throw lastError;
  throw new Error("Could not start payment. Please try again.");
}

/**
 * Start organization subscription checkout.
 * Tries `platform-subscription-init` then `paystack`; merges UI amounts when the
 * deployed function omits `total_amount` (common with older paystack deployments).
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
