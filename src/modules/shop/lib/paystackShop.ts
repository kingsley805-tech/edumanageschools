import { formatEdgeFunctionError, invokeEdgeFunction } from "@/lib/invokeEdgeFunction";
import { supabase } from "@/integrations/supabase/client";
import {
  clearPaystackPendingReference,
  readPaystackPendingReference,
  stashPaystackPendingReference,
} from "@/billing/lib/paystackConfirm";
import type { PaystackReturnState } from "@/billing/lib/paystackReturnParams";
import { isElectronDesktop } from "@/desktop";
import type { ShopPortalRole } from "@/modules/shop/lib/types";

const PENDING_SHOP_ORDER_KEY = "school_hub_shop_paystack_order_id";

type ShopCheckoutContext = {
  ok: boolean;
  error?: string;
  email?: string;
  amount?: number;
  order_number?: string;
};

type ConfirmResult = { ok: boolean; duplicate?: boolean; error?: string };

async function loadShopCheckoutContext(orderId: string): Promise<ShopCheckoutContext> {
  const { data, error } = await supabase.rpc("get_shop_paystack_checkout_context", {
    p_order_id: orderId,
  });
  if (error) {
    const msg = error.message ?? "";
    if (msg.includes("get_shop_paystack_checkout_context") || msg.includes("schema cache")) {
      return {
        ok: false,
        error:
          "Shop payment SQL is missing. Run public/sql/apply-shop-paystack.sql in Supabase, then reload schema.",
      };
    }
    return { ok: false, error: msg || "Could not load payment details." };
  }
  return (data ?? { ok: false, error: "Could not load payment details." }) as ShopCheckoutContext;
}

function isSyntheticEmail(email: string): boolean {
  return /@(students\.app|school\.local|local)$/i.test(email.trim());
}

export function shopPaystackReturnUrl(portalRole: ShopPortalRole): string {
  const path = `/${portalRole}/shop`;
  if (isElectronDesktop()) {
    return `${window.location.origin}/#${path}`;
  }
  return `${window.location.origin}${path}`;
}

export function stashShopPaystackOrderId(orderId: string) {
  try {
    sessionStorage.setItem(PENDING_SHOP_ORDER_KEY, orderId.trim());
  } catch {
    /* ignore */
  }
}

export function readShopPaystackOrderId(): string | null {
  try {
    return sessionStorage.getItem(PENDING_SHOP_ORDER_KEY)?.trim() || null;
  } catch {
    return null;
  }
}

export function clearShopPaystackOrderId() {
  try {
    sessionStorage.removeItem(PENDING_SHOP_ORDER_KEY);
  } catch {
    /* ignore */
  }
}

export async function confirmShopPaystackPayment(reference: string): Promise<ConfirmResult> {
  const ref = reference.trim();
  if (!ref) return { ok: false, error: "Missing payment reference." };

  const { data, error } = await supabase.rpc("confirm_shop_paystack_payment", {
    p_reference: ref,
  });

  if (error) {
    const msg = error.message ?? "";
    if (msg.includes("confirm_shop_paystack_payment") || msg.includes("schema cache")) {
      try {
        const edge = await invokeEdgeFunction<{ ok?: boolean; duplicate?: boolean; error?: string }>(
          "paystack",
          { action: "confirm", reference: ref },
        );
        if (edge?.error) return { ok: false, error: edge.error };
        return { ok: true, duplicate: Boolean(edge?.duplicate) };
      } catch (e) {
        return {
          ok: false,
          error: `${formatEdgeFunctionError(e, "paystack")} Run public/sql/apply-shop-paystack.sql in Supabase.`,
        };
      }
    }
    return { ok: false, error: msg || "Could not confirm payment." };
  }

  const payload = (data ?? {}) as { ok?: boolean; duplicate?: boolean; error?: string };
  if (payload.ok) return { ok: true, duplicate: Boolean(payload.duplicate) };
  return { ok: false, error: payload.error ?? "Could not confirm payment." };
}

let confirmInFlight: string | null = null;

export async function confirmShopPaystackPaymentFromReturn(
  returnState: PaystackReturnState | null,
): Promise<ConfirmResult> {
  const reference =
    returnState?.reference?.trim() || readPaystackPendingReference() || "";
  if (!reference) {
    return { ok: false, error: "No payment reference found. Try Pay again or contact the school." };
  }
  if (confirmInFlight === reference) {
    return { ok: false, error: "Confirmation already in progress." };
  }
  confirmInFlight = reference;
  try {
    const result = await confirmShopPaystackPayment(reference);
    if (result.ok) {
      clearPaystackPendingReference();
      clearShopPaystackOrderId();
    }
    return result;
  } finally {
    if (confirmInFlight === reference) confirmInFlight = null;
  }
}

export async function initializeShopPaystackCheckout(input: {
  shop_order_id: string;
  callback_url: string;
  email?: string;
}): Promise<string> {
  const ctx = await loadShopCheckoutContext(input.shop_order_id);
  if (!ctx.ok) {
    throw new Error(ctx.error ?? "Could not start payment.");
  }

  const { data: session } = await supabase.auth.getSession();
  const sessionEmail = session.session?.user?.email?.trim() ?? "";
  const explicit = input.email?.trim() ?? "";

  const payerEmail =
    (explicit && !isSyntheticEmail(explicit) ? explicit : "") ||
    (ctx.email?.trim() ?? "") ||
    (sessionEmail && !isSyntheticEmail(sessionEmail) ? sessionEmail : "");

  if (!payerEmail) {
    throw new Error(
      "Merchant email is not set. Admin: Payment gateways → enter merchant email → Save.",
    );
  }

  const amount = Number(ctx.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("This order has no amount to pay.");
  }

  stashShopPaystackOrderId(input.shop_order_id);

  const data = await invokeEdgeFunction<{
    authorization_url?: string;
    reference?: string;
    error?: string;
  }>("paystack", {
    action: "initialize-shop",
    shop_order_id: input.shop_order_id,
    callback_url: input.callback_url,
    email: payerEmail,
    amount,
  });

  if (data.error) throw new Error(data.error);
  if (!data.authorization_url) {
    throw new Error("No checkout URL returned from Paystack.");
  }

  if (data.reference?.trim()) {
    stashPaystackPendingReference(data.reference);
  }

  return data.authorization_url;
}
