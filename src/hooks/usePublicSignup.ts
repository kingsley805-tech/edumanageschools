import { useState, useEffect } from "react";
import {
  fetchRemoteSignupEnabled,
  getStoredSignupEnabled,
  setPublicSignupEnabled,
} from "@/lib/publicSignupConfig";

export function usePublicSignup() {
  const [isSignupEnabled, setIsSignupEnabledState] = useState<boolean>(getStoredSignupEnabled);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const fetchRemoteSetting = async () => {
      const remoteEnabled = await fetchRemoteSignupEnabled();
      if (cancelled || remoteEnabled === null) return;
      setIsSignupEnabledState(remoteEnabled);
      try {
        localStorage.setItem("edumanage_public_signup_enabled", remoteEnabled ? "true" : "false");
      } catch {
        /* ignore */
      }
    };

    void fetchRemoteSetting();

    const handleConfigChange = (e: Event) => {
      const detail = (e as CustomEvent<{ enabled?: boolean }>).detail;
      if (detail && typeof detail.enabled === "boolean") {
        setIsSignupEnabledState(detail.enabled);
      }
    };

    window.addEventListener("edumanage_signup_config_changed", handleConfigChange);
    return () => {
      cancelled = true;
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
