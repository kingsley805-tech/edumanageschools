import { formatEdgeFunctionError, invokeEdgeFunction } from "@/lib/invokeEdgeFunction";
import { supabase } from "@/integrations/supabase/client";

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
  error?: string;
};

type CheckoutContext = {
  ok: boolean;
  error?: string;
  email?: string;
  amount?: number;
};

/** Student login addresses are not valid Paystack payer emails. */
function isSyntheticStudentLoginEmail(email: string): boolean {
  return /@(students\.app|school\.local|local)$/i.test(email.trim());
}

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
      "Merchant email is not set. Admin: Payment gateways → enter kingsleyyeboah805@gmail.com (or school email) → Save.",
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

  return data.authorization_url;
}
