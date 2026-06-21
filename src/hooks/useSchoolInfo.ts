import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { fetchSchoolById, resolveUserSchoolId } from "@/lib/schoolFetch";
import { getCurrencySymbol, normalizeCurrencyCode } from "@/lib/currency";

export interface SchoolInfo {
  id: string;
  school_name: string;
  school_code: string;
  logo_url: string | null;
  theme_primary?: string | null;
  theme_secondary?: string | null;
  theme_accent?: string | null;
  currency?: string | null;
  currencySymbol?: string;
}

export const SCHOOL_INFO_QUERY_KEY = "school-info";

export const useSchoolInfo = () => {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: [SCHOOL_INFO_QUERY_KEY, user?.id],
    enabled: Boolean(user?.id),
    queryFn: async (): Promise<SchoolInfo | null> => {
      const schoolId = await resolveUserSchoolId(user!.id);
      if (!schoolId) return null;
      const school = await fetchSchoolById(schoolId);
      if (!school) return null;
      const cur = normalizeCurrencyCode(school.currency);
      return {
        id: school.id,
        school_name: school.school_name,
        school_code: school.school_code,
        logo_url: school.logo_url,
        theme_primary: school.theme_primary,
        theme_secondary: school.theme_secondary,
        theme_accent: school.theme_accent,
        currency: cur,
        currencySymbol: getCurrencySymbol(cur),
      };
    },
    staleTime: 10 * 60 * 1000,
  });

  return {
    currentSchool: query.data ?? null,
    loading: query.isPending && query.data === undefined,
    refetch: query.refetch,
  };
};
