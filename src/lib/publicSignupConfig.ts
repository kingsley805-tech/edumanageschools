import { supabase } from "@/integrations/supabase/client";

const SIGNUP_ENABLED_STORAGE_KEY = "edumanage_public_signup_enabled";
const REMOTE_UNAVAILABLE_KEY = "edumanage_system_settings_unavailable";

function isMissingRelationError(error: { code?: string; message?: string; status?: number } | null): boolean {
  if (!error) return false;
  const msg = (error.message ?? "").toLowerCase();
  return (
    error.code === "PGRST205" ||
    error.code === "42P01" ||
    error.status === 404 ||
    msg.includes("could not find the table") ||
    msg.includes("does not exist") ||
    msg.includes("schema cache")
  );
}

function isRemoteUnavailable(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(REMOTE_UNAVAILABLE_KEY) === "1";
  } catch {
    return false;
  }
}

function markRemoteUnavailable(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(REMOTE_UNAVAILABLE_KEY, "1");
  } catch {
    /* ignore */
  }
}

/**
 * Checks if public sign-up is currently enabled.
 * Defaults to true if no explicit setting is found.
 */
export function getStoredSignupEnabled(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const val = localStorage.getItem(SIGNUP_ENABLED_STORAGE_KEY);
    if (val === null) return true;
    return val === "true";
  } catch {
    return true;
  }
}

export async function fetchRemoteSignupEnabled(): Promise<boolean | null> {
  if (isRemoteUnavailable()) return null;

  try {
    const { data, error } = await supabase
      .from("system_settings" as never)
      .select("value")
      .eq("key", "public_signup_enabled")
      .maybeSingle();

    if (error) {
      if (isMissingRelationError(error as { code?: string; message?: string })) {
        markRemoteUnavailable();
      }
      return null;
    }

    const row = data as { value?: string | boolean } | null;
    if (!row || row.value === undefined || row.value === null) return null;
    return row.value === "true" || row.value === true;
  } catch {
    return null;
  }
}

/**
 * Persists the public sign-up state locally and in Supabase when available.
 */
export async function setPublicSignupEnabled(enabled: boolean): Promise<boolean> {
  try {
    if (typeof window !== "undefined") {
      localStorage.setItem(SIGNUP_ENABLED_STORAGE_KEY, enabled ? "true" : "false");
      window.dispatchEvent(new CustomEvent("edumanage_signup_config_changed", { detail: { enabled } }));
    }

    if (!isRemoteUnavailable()) {
      const { error } = await supabase.from("system_settings" as never).upsert({
        key: "public_signup_enabled",
        value: enabled ? "true" : "false",
        updated_at: new Date().toISOString(),
      } as never);

      if (error) {
        if (isMissingRelationError(error as { code?: string; message?: string })) {
          markRemoteUnavailable();
        } else {
          console.warn("Failed to persist public signup setting remotely:", error.message);
        }
      }
    }

    return true;
  } catch (err) {
    console.warn("Failed to set public signup enabled:", err);
    return false;
  }
}

/**
 * Generates an auth URL with a valid session / school UUID.
 */
export function getAuthUrl(uuid?: string): string {
  if (uuid) {
    return `/auth/${uuid}`;
  }
  return `/auth`;
}
