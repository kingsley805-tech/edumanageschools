import { supabase } from "@/integrations/supabase/client";
import { isRbacSchemaMissing } from "@/lib/rbac/schema";

const SESSION_KEY = "school_hub_rbac_available";

let available: boolean | null = null;
let probe: Promise<boolean> | null = null;

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
    // Persist only success. A previous "missing schema" state should not stick
    // after migrations are applied.
    if (ok) {
      sessionStorage.setItem(SESSION_KEY, "1");
    } else {
      sessionStorage.removeItem(SESSION_KEY);
    }
  } catch {
    /* ignore */
  }
}

/** One lightweight probe per session — avoids repeated 404s when RBAC SQL is not applied. */
export async function isRbacAvailable(): Promise<boolean> {
  if (available !== null) return available;

  const cached = readSessionFlag();
  if (cached !== null) {
    available = cached;
    return cached;
  }

  if (!probe) {
    probe = (async () => {
      const { error } = await supabase.from("permissions").select("id").limit(1);
      if (!error) {
        available = true;
        writeSessionFlag(true);
        return true;
      }
      if (isRbacSchemaMissing(error)) {
        available = false;
        writeSessionFlag(false);
        // Allow future re-checks after migrations are applied.
        probe = null;
        return false;
      }
      // Table exists (e.g. RLS); treat as available.
      available = true;
      writeSessionFlag(true);
      return true;
    })();
  }
  return probe;
}

export function resetRbacAvailabilityProbe(): void {
  available = null;
  probe = null;
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}
