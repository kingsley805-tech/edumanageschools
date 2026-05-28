import { formatEdgeFunctionError, invokeEdgeFunction } from "@/lib/invokeEdgeFunction";

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
}): Promise<string> {
  const data = await invokeEdgeFunction<PaystackInitializeResult>("paystack", {
    action: "initialize",
    invoice_id: input.invoice_id,
    callback_url: input.callback_url,
  });

  if (!data.authorization_url) {
    throw new Error("No checkout URL returned from Paystack.");
  }

  return data.authorization_url;
}
