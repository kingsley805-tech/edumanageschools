import { supabase } from "@/integrations/supabase/client";

const EXTENDED_PLAN_COLUMNS = [
  "sms_addon_fee_monthly",
  "sms_addon_fee_annual",
  "sms_included_quantity",
  "sms_price_per_message",
] as const;

function isMissingColumnError(error: { code?: string; message?: string }): boolean {
  const msg = (error.message ?? "").toLowerCase();
  return (
    error.code === "PGRST204" ||
    (msg.includes("column") && (msg.includes("does not exist") || msg.includes("could not find")))
  );
}

function stripMissingColumns(
  payload: Record<string, unknown>,
  errorMessage: string,
): Record<string, unknown> | null {
  const next = { ...payload };
  let stripped = false;
  const msg = errorMessage.toLowerCase();

  for (const col of EXTENDED_PLAN_COLUMNS) {
    if (col in next && msg.includes(col)) {
      delete next[col];
      stripped = true;
    }
  }

  if (!stripped && isMissingColumnError({ message: errorMessage })) {
    for (const col of EXTENDED_PLAN_COLUMNS) {
      if (col in next) {
        delete next[col];
        stripped = true;
      }
    }
  }

  return stripped ? next : null;
}

export type SaveSubscriptionPlanResult = {
  skippedExtendedColumns: boolean;
};

export async function saveSubscriptionPlanRow(
  row: Record<string, unknown>,
  planId?: string,
): Promise<SaveSubscriptionPlanResult> {
  let payload = { ...row };
  let skippedExtendedColumns = false;

  for (let attempt = 0; attempt < EXTENDED_PLAN_COLUMNS.length + 1; attempt++) {
    const query = planId
      ? supabase.from("subscription_plans").update(payload).eq("id", planId)
      : supabase.from("subscription_plans").insert({
          ...payload,
          created_at: new Date().toISOString(),
        });

    const { error } = await query;
    if (!error) {
      return { skippedExtendedColumns };
    }

    if (isMissingColumnError(error)) {
      const next = stripMissingColumns(payload, error.message ?? "");
      if (next) {
        payload = next;
        skippedExtendedColumns = true;
        continue;
      }
    }

    throw error;
  }

  throw new Error("Could not save subscription plan");
}
