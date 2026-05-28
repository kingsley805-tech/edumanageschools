import type { SupabaseClient } from "@supabase/supabase-js";

export async function confirmPaystackPayment(supabase: SupabaseClient, reference: string) {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session?.access_token) {
    return { ok: false as const, error: "Please sign in again." };
  }

  const { data, error } = await supabase.functions.invoke("paystack", {
    body: { action: "confirm", reference },
  });

  if (error) {
    return { ok: false as const, error: error.message || "Could not confirm payment" };
  }

  const payload = data as { ok?: boolean; duplicate?: boolean; error?: string } | null;
  if (payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string") {
    return { ok: false as const, error: payload.error };
  }

  return {
    ok: true as const,
    duplicate: Boolean(payload?.duplicate),
  };
}
