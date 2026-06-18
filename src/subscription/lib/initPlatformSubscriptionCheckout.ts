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

/** Start organization subscription checkout — charges package + SMS on Paystack when SMS is enabled. */
export async function initPlatformSubscriptionCheckout(
  payload: PlatformSubscriptionCheckoutPayload,
): Promise<PlatformSubscriptionCheckoutInit> {
  const body = {
    plan_id: payload.plan_id,
    billing_cycle: payload.billing_cycle,
    enable_sms: payload.enable_sms,
    package_amount: payload.package_amount,
    sms_amount: payload.sms_amount,
    total_amount: payload.total_amount,
    callback_url: payload.callback_url,
  };

  try {
    return await invokeEdgeFunction<PlatformSubscriptionCheckoutInit>(
      "platform-subscription-init",
      body,
    );
  } catch (primaryError) {
    if (!isEdgeFunctionUnreachable(primaryError)) {
      throw primaryError;
    }
    return invokeEdgeFunction<PlatformSubscriptionCheckoutInit>("paystack", {
      action: "platform-subscription-init",
      ...body,
    });
  }
}

export function assertCheckoutTotalMatches(
  response: PlatformSubscriptionCheckoutInit,
  expectedTotal: number,
  smsEnabled: boolean,
  smsAmount: number,
): void {
  if (typeof response.total_amount !== "number") {
    throw new Error(
      "Payment server did not return a total amount. Deploy the platform-subscription-init edge function.",
    );
  }
  if (Math.abs(response.total_amount - expectedTotal) > 0.02) {
    throw new Error(
      `Paystack total (GHS ${response.total_amount}) does not match checkout (GHS ${expectedTotal}). Deploy the latest edge function.`,
    );
  }
  if (smsEnabled && smsAmount > 0 && (response.sms_amount ?? 0) <= 0) {
    throw new Error(
      "SMS fee was not included in the Paystack charge. Deploy the platform-subscription-init edge function.",
    );
  }
}
