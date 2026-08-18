import { supabase } from "@/integrations/supabase/client";

const SIGNUP_ENABLED_STORAGE_KEY = "edumanage_public_signup_enabled";

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

/**
 * Persists the public sign-up state locally and in Supabase app settings if available.
 */
export async function setPublicSignupEnabled(enabled: boolean): Promise<boolean> {
  try {
    if (typeof window !== "undefined") {
      localStorage.setItem(SIGNUP_ENABLED_STORAGE_KEY, enabled ? "true" : "false");
      window.dispatchEvent(new CustomEvent("edumanage_signup_config_changed", { detail: { enabled } }));
    }

    // Attempt to persist in school_settings or platform_settings if table exists
    try {
      await supabase.from("system_settings" as any).upsert({
        key: "public_signup_enabled",
        value: enabled ? "true" : "false",
        updated_at: new Date().toISOString(),
      });
    } catch {
      // Fallback gracefully if custom system_settings table does not exist
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
