import { formatEdgeFunctionError, invokeEdgeFunction } from "@/lib/invokeEdgeFunction";
import { supabase } from "@/integrations/supabase/client";

const PENDING_REF_KEY = "school_hub_paystack_pending_reference";

export async function confirmPaystackPayment(reference: string) {
  try {
    const data = await invokeEdgeFunction<{ ok?: boolean; duplicate?: boolean; error?: string }>(
      "paystack",
      { action: "confirm", reference },
    );

    if (data && typeof data === "object" && "error" in data && typeof data.error === "string") {
      return { ok: false as const, error: data.error };
    }

    return {
      ok: true as const,
      duplicate: Boolean(data?.duplicate),
    };
  } catch (e) {
    return { ok: false as const, error: formatEdgeFunctionError(e, "paystack") };
  }
}

export type PaystackInitializeResult = {
  authorization_url?: string;
  reference?: string;
  error?: string;
};

function isSyntheticStudentLoginEmail(email: string): boolean {
  return /@(students\.app|school\.local|local)$/i.test(email.trim());
}

type CheckoutContext = {
  ok: boolean;
  error?: string;
  email?: string;
  amount?: number;
};

async function loadCheckoutContext(invoiceId: string): Promise<CheckoutContext> {
  const { data, error } = await supabase.rpc("get_paystack_checkout_context", {
    p_invoice_id: invoiceId,
  });

  if (error) {
    const msg = error.message ?? "";
    if (msg.includes("schema cache") || msg.includes("get_paystack_checkout_context")) {
      return {
        ok: false,
        error:
          "Payment setup SQL is missing. Ask admin to run public/sql/apply-paystack-checkout-context.sql in Supabase.",
      };
    }
    return { ok: false, error: msg || "Could not load payment details." };
  }

  return (data ?? { ok: false, error: "Could not load payment details." }) as CheckoutContext;
}

export function stashPaystackPendingReference(reference: string) {
  try {
    sessionStorage.setItem(PENDING_REF_KEY, reference.trim());
  } catch {
    /* ignore */
  }
}

export function clearPaystackPendingReference() {
  try {
    sessionStorage.removeItem(PENDING_REF_KEY);
  } catch {
    /* ignore */
  }
}

export function readPaystackPendingReference(): string | null {
  try {
    const v = sessionStorage.getItem(PENDING_REF_KEY)?.trim();
    return v || null;
  } catch {
    return null;
  }
}

let confirmInFlight: string | null = null;

const confirmSuccessKey = (ref: string) => `school_hub_paystack_confirm_ok_${ref}`;
const confirmThrottleKey = (ref: string) => `school_hub_paystack_confirm_at_${ref}`;
const CONFIRM_THROTTLE_MS = 45_000;

function wasConfirmSuccessful(ref: string): boolean {
  try {
    return sessionStorage.getItem(confirmSuccessKey(ref)) === "1";
  } catch {
    return false;
  }
}

function markConfirmSuccessful(ref: string) {
  try {
    sessionStorage.setItem(confirmSuccessKey(ref), "1");
  } catch {
    /* ignore */
  }
}

function isConfirmThrottled(ref: string): boolean {
  try {
    const at = Number(sessionStorage.getItem(confirmThrottleKey(ref)) || 0);
    return at > 0 && Date.now() - at < CONFIRM_THROTTLE_MS;
  } catch {
    return false;
  }
}

function markConfirmAttemptTime(ref: string) {
  try {
    sessionStorage.setItem(confirmThrottleKey(ref), String(Date.now()));
  } catch {
    /* ignore */
  }
}

/** Confirm using URL query or sessionStorage (after Paystack redirect). */
export async function confirmPaystackPaymentFromReturn(
  returnState: { reference: string; status: string } | null,
): Promise<{ ok: boolean; error?: string; duplicate?: boolean }> {
  const reference =
    returnState?.reference?.trim() || readPaystackPendingReference() || "";
  if (!reference) {
    return { ok: false, error: "No payment reference found. Try Pay again or contact the school." };
  }

  if (confirmInFlight === reference) {
    return { ok: false, error: "Confirmation already in progress." };
  }
  if (wasConfirmSuccessful(reference)) {
    return { ok: true, duplicate: true };
  }
  if (isConfirmThrottled(reference)) {
    return { ok: false, error: "Payment sync was just attempted. Wait a moment, then use Sync Paystack payment." };
  }
  confirmInFlight = reference;
  markConfirmAttemptTime(reference);

  try {
    const result = await confirmPaystackPayment(reference);
    if (result.ok) {
      markConfirmSuccessful(reference);
      clearPaystackPendingReference();
    }
    return result;
  } finally {
    if (confirmInFlight === reference) confirmInFlight = null;
  }
}

export async function initializePaystackCheckout(input: {
  invoice_id: string;
  callback_url: string;
  amount?: number;
  email?: string;
}): Promise<string> {
  const ctx = await loadCheckoutContext(input.invoice_id);
  if (!ctx.ok) {
    throw new Error(ctx.error ?? "Could not start payment.");
  }

  const { data: session } = await supabase.auth.getSession();
  const sessionEmail = session.session?.user?.email?.trim() ?? "";
  const explicit = input.email?.trim() ?? "";

  const payerEmail =
    (explicit && !isSyntheticStudentLoginEmail(explicit) ? explicit : "") ||
    (ctx.email?.trim() ?? "") ||
    (sessionEmail && !isSyntheticStudentLoginEmail(sessionEmail) ? sessionEmail : "");

  if (!payerEmail) {
    throw new Error(
      "Merchant email is not set. Admin: Payment gateways → enter merchant email → Save.",
    );
  }

  const amount =
    input.amount != null && Number.isFinite(input.amount) ? input.amount : Number(ctx.amount);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("This invoice has no balance left to pay.");
  }

  const data = await invokeEdgeFunction<PaystackInitializeResult>("paystack", {
    action: "initialize",
    invoice_id: input.invoice_id,
    callback_url: input.callback_url,
    email: payerEmail,
    amount,
  });

  if (!data.authorization_url) {
    throw new Error("No checkout URL returned from Paystack.");
  }

  if (data.reference?.trim()) {
    stashPaystackPendingReference(data.reference);
  }

  return data.authorization_url;
}
