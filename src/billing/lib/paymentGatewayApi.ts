import { supabase } from "@/integrations/supabase/client";
import { invokeEdgeFunction, formatEdgeFunctionError } from "@/lib/invokeEdgeFunction";
import type { Tables } from "@/integrations/supabase/types";

export type GatewayConfigRow = Tables<"tenant_payment_gateway_configs"> & {
  secret_key?: string;
  webhook_secret?: string;
  has_encrypted_secrets?: boolean;
  secret_key_is_stored?: boolean;
};

export type FetchGatewayListResult = {
  gateways: GatewayConfigRow[];
  /** False when only public fields were loaded from the database (edge function not deployed). */
  edgeFunctionAvailable: boolean;
  edgeFunctionWarning?: string;
};

function isEdgeFunctionUnreachable(error: unknown): boolean {
  const msg =
    error && typeof error === "object" && "message" in error
      ? String((error as { message?: string }).message ?? "")
      : error instanceof Error
        ? error.message
        : "";
  return (
    msg.includes("Failed to send a request to the Edge Function") ||
    msg.includes("FunctionsFetchError") ||
    msg.toLowerCase().includes("failed to fetch") ||
    msg.includes("404") ||
    msg.toLowerCase().includes("not found")
  );
}

async function fetchGatewayListFromDb(schoolId: string): Promise<GatewayConfigRow[]> {
  const { data, error } = await supabase
    .from("tenant_payment_gateway_configs")
    .select("*")
    .eq("school_id", schoolId)
    .order("provider");

  if (error) throw error;

  return (data ?? []).map((row) => ({
    ...row,
    secret_key: undefined,
    webhook_secret: undefined,
    has_encrypted_secrets: false,
    secret_key_is_stored: Boolean(String(row.paystack_secret_key ?? "").trim()),
  }));
}

/** Loads gateway configs via edge function; falls back to DB (no secrets) if paystack is not deployed. */
export async function fetchPaymentGatewayConfigs(schoolId: string): Promise<FetchGatewayListResult> {
  try {
    const body = await invokeEdgeFunction<{ gateways?: GatewayConfigRow[] }>("paystack", {
      action: "gateway-list",
    });
    return {
      gateways: body.gateways ?? [],
      edgeFunctionAvailable: true,
    };
  } catch (error) {
    if (!isEdgeFunctionUnreachable(error)) {
      throw error;
    }

    try {
      const gateways = await fetchGatewayListFromDb(schoolId);
      return {
        gateways,
        edgeFunctionAvailable: false,
        edgeFunctionWarning: formatEdgeFunctionError(error, "paystack"),
      };
    } catch {
      throw error;
    }
  }
}
