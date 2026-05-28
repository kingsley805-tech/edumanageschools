import { supabase } from "@/integrations/supabase/client";
import { isMissingTableError } from "@/lib/billing/availability";

const SESSION_KEY = "school_hub_payment_gateway_available";

let available: boolean | null = null;
let probe: Promise<boolean> | null = null;

export async function isPaymentGatewaySchemaAvailable(): Promise<boolean> {
  if (available !== null) return available;

  try {
    const cached = sessionStorage.getItem(SESSION_KEY);
    if (cached === "1") {
      available = true;
      return true;
    }
    if (cached === "0") {
      available = false;
      return false;
    }
  } catch {
    /* ignore */
  }

  if (!probe) {
    probe = (async () => {
      const { error } = await supabase.from("tenant_payment_gateway_configs").select("id").limit(1);
      if (!error) {
        available = true;
        try {
          sessionStorage.setItem(SESSION_KEY, "1");
        } catch {
          /* ignore */
        }
        return true;
      }
      if (isMissingTableError(error)) {
        available = false;
        probe = null;
        try {
          sessionStorage.setItem(SESSION_KEY, "0");
        } catch {
          /* ignore */
        }
        return false;
      }
      available = true;
      return true;
    })();
  }
  return probe;
}

export function resetPaymentGatewaySchemaProbe(): void {
  available = null;
  probe = null;
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export const PAYMENT_GATEWAY_SQL_PATH = "supabase/scripts/apply-payment-gateway.sql";
