import { useQuery } from "@tanstack/react-query";
import { fetchSupportContactSettings } from "@/lib/supportSettings";

export const SUPPORT_SETTINGS_QUERY_KEY = "support-contact-settings";

export function useSupportSettings() {
  return useQuery({
    queryKey: [SUPPORT_SETTINGS_QUERY_KEY],
    queryFn: fetchSupportContactSettings,
    staleTime: 5 * 60 * 1000,
  });
}
