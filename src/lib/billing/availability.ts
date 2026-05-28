import { supabase } from "@/integrations/supabase/client";

const SESSION_KEY = "school_hub_billing_fee_categories_available";

let available: boolean | null = null;
let probe: Promise<boolean> | null = null;

function isMissingTableError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const msg = (error.message ?? "").toLowerCase();
  return (
    error.code === "PGRST205" ||
    error.code === "42P01" ||
    msg.includes("schema cache") ||
    msg.includes("fee_categories") && msg.includes("does not exist")
  );
}

function readSessionFlag(): boolean | null {
  try {
    const v = sessionStorage.getItem(SESSION_KEY);
    if (v === "1") return true;
    if (v === "0") return false;
  } catch {
    /* ignore */
  }
  return null;
}

function writeSessionFlag(ok: boolean) {
  try {
    if (ok) sessionStorage.setItem(SESSION_KEY, "1");
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

/** Probe whether billing fee_categories exists (one check per session). */
export async function isBillingFeeCategoriesAvailable(): Promise<boolean> {
  if (available !== null) return available;

  const cached = readSessionFlag();
  if (cached !== null) {
    available = cached;
    return cached;
  }

  if (!probe) {
    probe = (async () => {
      const { error } = await supabase.from("fee_categories").select("id").limit(1);
      if (!error) {
        available = true;
        writeSessionFlag(true);
        return true;
      }
      if (isMissingTableError(error)) {
        available = false;
        writeSessionFlag(false);
        probe = null;
        return false;
      }
      available = true;
      writeSessionFlag(true);
      return true;
    })();
  }
  return probe;
}

export function resetBillingAvailabilityProbe(): void {
  available = null;
  probe = null;
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export const BILLING_SETUP_SQL_PATH = "supabase/scripts/apply-all-missing-tables.sql";
