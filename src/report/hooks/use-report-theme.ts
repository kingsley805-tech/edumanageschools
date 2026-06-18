import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/report/hooks/use-auth";
import { resolveUserSchoolId } from "@/lib/schoolFetch";
import { parseSchoolBrand } from "@/lib/themeColors";
import {
  buildReportBrandColors,
  DEFAULT_REPORT_THEME,
  resolveReportThemePrimary,
  type ReportBrandColors,
} from "@/report/lib/report-brand-colors";
import { isMissingSchemaError } from "@/report/lib/supabase-errors";

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

      const { data: school, error: schoolErr } = await supabase
        .from("schools")
        .select("theme_primary, theme_secondary, theme_accent, primary_color")
        .eq("id", schoolId)
        .maybeSingle();

      if (schoolErr && !isMissingSchemaError(schoolErr)) {
        throw schoolErr;
      }

      const schoolBrand = parseSchoolBrand(school);
      const hex = resolveReportThemePrimary(
        null,
        schoolBrand.primary ?? (school as { primary_color?: string } | null)?.primary_color,
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
