import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/report/hooks/use-auth";
import { resolveUserSchoolId } from "@/lib/schoolFetch";
import {
  buildReportBrandColors,
  DEFAULT_REPORT_THEME,
  reportThemeFromSettings,
  type ReportBrandColors,
} from "@/report/lib/report-brand-colors";
import { isMissingSchemaColumnError } from "@/report/lib/supabase-errors";

export function useReportTheme(schoolIdOverride?: string | null) {
  const { profile, user } = useAuth();

  const query = useQuery({
    queryKey: ["report-theme", schoolIdOverride ?? profile?.school_id, user?.id],
    enabled: !!(schoolIdOverride ?? user?.id),
    staleTime: 60_000,
    queryFn: async (): Promise<ReportBrandColors> => {
      const schoolId =
        schoolIdOverride ?? profile?.school_id ?? (user ? await resolveUserSchoolId(user.id) : null);
      if (!schoolId) return buildReportBrandColors(DEFAULT_REPORT_THEME);

      const { data, error } = await supabase
        .from("school_settings")
        .select("report_theme_primary")
        .eq("school_id", schoolId)
        .maybeSingle();

      if (error && isMissingSchemaColumnError(error)) {
        return buildReportBrandColors(DEFAULT_REPORT_THEME);
      }
      if (error) throw error;

      const hex = reportThemeFromSettings(
        (data as { report_theme_primary?: string | null } | null)?.report_theme_primary,
      );
      return buildReportBrandColors(hex);
    },
  });

  return {
    brand: query.data ?? buildReportBrandColors(DEFAULT_REPORT_THEME),
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}
