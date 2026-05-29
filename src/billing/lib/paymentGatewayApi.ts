// @ts-nocheck
import { supabase } from "@/integrations/supabase/client";
import { invokeEdgeFunction, formatEdgeFunctionError } from "@/lib/invokeEdgeFunction";
import { isMissingTableError } from "@/lib/billing/availability";
import type { Tables } from "@/integrations/supabase/types";

export type GatewayConfigRow = Tables<"tenant_payment_gateway_configs"> & {
  secret_key?: string;
  webhook_secret?: string;
  has_encrypted_secrets?: boolean;
  secret_key_is_stored?: boolean;
};

export type FetchGatewayListResult = {
  gateways: GatewayConfigRow[];
  edgeFunctionAvailable: boolean;
  edgeFunctionWarning?: string;
  dbSchemaMissing?: boolean;
};

function isEdgeFunctionUnreachable(error: unknown): boolean {
  if (error && typeof error === "object") {
    const e = error as { message?: string; name?: string };
    const msg = (e.message ?? "").trim();
    if (
      e.name === "FunctionsFetchError" ||
      msg.includes("Failed to send a request to the Edge Function") ||
      msg.includes("FunctionsFetchError") ||
      msg.includes("Edge Function") && msg.includes("not found") ||
      msg.toLowerCase().includes("failed to fetch") ||
      msg.includes("404") ||
      msg.toLowerCase().includes("not reachable")
    ) {
      return true;
    }
  }
  if (error instanceof Error) {
    const msg = error.message;
    return (
      msg.includes("Failed to send a request to the Edge Function") ||
      msg.includes("not reachable") ||
      msg.includes("not found")
    );
  }
  return false;
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
  let edgeWarning: string | undefined;

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
    edgeWarning = formatEdgeFunctionError(error, "paystack");
  }

  try {
    const gateways = await fetchGatewayListFromDb(schoolId);
    return {
      gateways,
      edgeFunctionAvailable: false,
      edgeFunctionWarning: edgeWarning,
    };
  } catch (dbError) {
    const schemaMissing = isMissingTableError(
      dbError as { code?: string; message?: string } | null,
    );
    return {
      gateways: [],
      edgeFunctionAvailable: false,
      edgeFunctionWarning: edgeWarning,
      dbSchemaMissing: schemaMissing,
    };
  }
}

export type PaystackGatewayUpsertInput = {
  id?: string;
  is_enabled: boolean;
  is_test_mode: boolean;
  is_default: boolean;
  public_key: string;
  merchant_email?: string | null;
  callback_url?: string | null;
  secret_key?: string;
};

/**
 * Save Paystack public settings directly (when edge function is not deployed).
 * Secret key is stored in paystack_secret_key column — deploy edge function for encrypted storage.
 */
export async function upsertPaystackGatewayDirect(
  schoolId: string,
  input: PaystackGatewayUpsertInput,
): Promise<{ id: string }> {
  const now = new Date().toISOString();
  const base = {
    school_id: schoolId,
    provider: "paystack" as const,
    is_enabled: input.is_enabled,
    is_test_mode: input.is_test_mode,
    is_default: input.is_default,
    public_key: input.public_key,
    merchant_email: input.merchant_email ?? null,
    callback_url: input.callback_url ?? null,
    updated_at: now,
  };

  if (input.id) {
    const patch: Record<string, unknown> = { ...base };
    if (input.secret_key?.trim()) {
      patch.paystack_secret_key = input.secret_key.trim();
    }
    const { data, error } = await supabase
      .from("tenant_payment_gateway_configs")
      .update(patch)
      .eq("id", input.id)
      .eq("school_id", schoolId)
      .select("id")
      .single();
    if (error) throw error;
    return { id: data.id };
  }

  const insertRow: Record<string, unknown> = { ...base };
  if (input.secret_key?.trim()) {
    insertRow.paystack_secret_key = input.secret_key.trim();
  }

  const { data, error } = await supabase
    .from("tenant_payment_gateway_configs")
    .upsert(insertRow, { onConflict: "school_id,provider" })
    .select("id")
    .single();

  if (error) throw error;
  return { id: data.id };
}