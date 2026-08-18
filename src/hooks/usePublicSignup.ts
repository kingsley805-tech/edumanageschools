import { useState, useEffect } from "react";
import { getStoredSignupEnabled, setPublicSignupEnabled } from "@/lib/publicSignupConfig";
import { supabase } from "@/integrations/supabase/client";

export function usePublicSignup() {
  const [isSignupEnabled, setIsSignupEnabledState] = useState<boolean>(getStoredSignupEnabled);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Initial fetch from Supabase if table exists
    const fetchRemoteSetting = async () => {
      try {
        const { data, error } = await supabase
          .from("system_settings" as any)
          .select("value")
          .eq("key", "public_signup_enabled")
          .maybeSingle();

        if (!error && data && data.value !== undefined) {
          const remoteEnabled = data.value === "true" || data.value === true;
          setIsSignupEnabledState(remoteEnabled);
          localStorage.setItem("edumanage_public_signup_enabled", remoteEnabled ? "true" : "false");
        }
      } catch {
        // Fallback to localStorage
      }
    };

    fetchRemoteSetting();

    // Listen to local window events
    const handleConfigChange = (e: any) => {
      if (e.detail && typeof e.detail.enabled === "boolean") {
        setIsSignupEnabledState(e.detail.enabled);
      }
    };

    window.addEventListener("edumanage_signup_config_changed", handleConfigChange);
    return () => {
      window.removeEventListener("edumanage_signup_config_changed", handleConfigChange);
    };
  }, []);

  const updateSignupEnabled = async (enabled: boolean) => {
    setIsLoading(true);
    try {
      const success = await setPublicSignupEnabled(enabled);
      if (success) {
        setIsSignupEnabledState(enabled);
      }
      return success;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isSignupEnabled,
    isLoading,
    setSignupEnabled: updateSignupEnabled,
  };
}
