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

export async function initializePaystackCheckout(input: {
  invoice_id: string;
  callback_url: string;
  /** Optional partial amount (admins); students/parents pay full outstanding on the server. */
  amount?: number;
  email?: string;
}): Promise<string> {
  const { data: session } = await supabase.auth.getSession();
  const sessionEmail = session.session?.user?.email?.trim() ?? "";

  const data = await invokeEdgeFunction<PaystackInitializeResult>("paystack", {
    action: "initialize",
    invoice_id: input.invoice_id,
    callback_url: input.callback_url,
    email: (input.email?.trim() || sessionEmail) || undefined,
    ...(input.amount != null && Number.isFinite(input.amount) ? { amount: input.amount } : {}),
  });

  if (!data.authorization_url) {
    throw new Error("No checkout URL returned from Paystack.");
  }

  return data.authorization_url;
}
