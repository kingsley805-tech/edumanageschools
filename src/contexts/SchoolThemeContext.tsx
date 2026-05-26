import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  applyBrandTheme,
  clearBrandTheme,
  parseSchoolBrand,
  BRAND_DEFAULTS,
  type BrandColors,
} from "@/lib/themeColors";

interface SchoolThemeContextType {
  brandColors: BrandColors;
  schoolId: string | null;
  loading: boolean;
  applyColors: (colors: BrandColors) => void;
  refreshSchoolTheme: () => Promise<void>;
}

const SchoolThemeContext = createContext<SchoolThemeContextType | undefined>(
  undefined
);

export const SchoolThemeProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [brandColors, setBrandColors] = useState<BrandColors>({ ...BRAND_DEFAULTS });
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const applyColors = useCallback((colors: BrandColors) => {
    setBrandColors(colors);
    applyBrandTheme(colors);
  }, []);

  const refreshSchoolTheme = useCallback(async () => {
    if (!user) {
      setSchoolId(null);
      setBrandColors({ ...BRAND_DEFAULTS });
      applyBrandTheme(BRAND_DEFAULTS);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("school_id")
        .eq("id", user.id)
        .single();

      if (!profile?.school_id) {
        setSchoolId(null);
        applyColors({ ...BRAND_DEFAULTS });
        return;
      }

      setSchoolId(profile.school_id);

      const { data: school } = await supabase
        .from("schools")
        .select("theme_primary, theme_secondary, theme_accent")
        .eq("id", profile.school_id)
        .single();

      const colors = parseSchoolBrand(school);
      applyColors(colors);
    } catch (e) {
      console.error("School theme load failed:", e);
      applyColors({ ...BRAND_DEFAULTS });
    } finally {
      setLoading(false);
    }
  }, [user, applyColors]);

  useEffect(() => {
    refreshSchoolTheme();
  }, [refreshSchoolTheme]);

  useEffect(() => {
    return () => {
      clearBrandTheme();
    };
  }, []);

  return (
    <SchoolThemeContext.Provider
      value={{
        brandColors,
        schoolId,
        loading,
        applyColors,
        refreshSchoolTheme,
      }}
    >
      {children}
    </SchoolThemeContext.Provider>
  );
};

export const useSchoolTheme = () => {
  const ctx = useContext(SchoolThemeContext);
  if (!ctx) {
    throw new Error("useSchoolTheme must be used within SchoolThemeProvider");
  }
  return ctx;
};
