import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
} from "react";
import { applyBrandTheme, clearBrandTheme, BRAND_DEFAULTS } from "@/lib/themeColors";
import {
  PERSONAL_DEFAULT_COLORS,
  clearPersonalThemeInlineVars,
} from "@/lib/personalThemeDefaults";

export type Theme = "default" | "dark" | "blue" | "purple" | "green" | "custom";

interface CustomThemeColors {
  primary: string;
  accent: string;
  background: string;
  foreground: string;
}

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  customColors: CustomThemeColors;
  setCustomColors: (colors: CustomThemeColors) => void;
  resetPersonalTheme: () => void;
  glassmorphism: boolean;
  setGlassmorphism: (enabled: boolean) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_IDS: Theme[] = ["default", "dark", "blue", "purple", "green", "custom"];

function normalizeStoredTheme(raw: string | null): Theme {
  if (raw && THEME_IDS.includes(raw as Theme)) return raw as Theme;
  return "default";
}

function contrastForPrimary(hsl: string): string {
  const parts = hsl.trim().split(/\s+/);
  const l = parseInt(parts[2], 10);
  if (Number.isFinite(l) && l > 55) return "0 0% 4%";
  return "0 0% 100%";
}

/** Keep black sidebar chrome across personal color themes */
function applyDarkSidebar(root: HTMLElement) {
  root.style.setProperty("--sidebar-background", "0 0% 4%");
  root.style.setProperty("--sidebar-foreground", "240 5% 90%");
  root.style.setProperty("--sidebar-primary", "0 0% 100%");
  root.style.setProperty("--sidebar-primary-foreground", "0 0% 4%");
  root.style.setProperty("--sidebar-accent", "240 5% 12%");
  root.style.setProperty("--sidebar-accent-foreground", "0 0% 100%");
  root.style.setProperty("--sidebar-border", "240 4% 16%");
  root.style.setProperty("--sidebar-ring", "0 0% 100%");
}

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window !== "undefined") {
      return normalizeStoredTheme(localStorage.getItem("theme"));
    }
    return "default";
  });

  const [customColors, setCustomColorsState] = useState<CustomThemeColors>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("customThemeColors");
      return saved ? JSON.parse(saved) : { ...PERSONAL_DEFAULT_COLORS };
    }
    return { ...PERSONAL_DEFAULT_COLORS };
  });

  const [glassmorphism, setGlassmorphismState] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("glassmorphism");
      return saved ? JSON.parse(saved) : false;
    }
    return false;
  });

  const resetPersonalTheme = useCallback(() => {
    setCustomColorsState({ ...PERSONAL_DEFAULT_COLORS });
    localStorage.setItem(
      "customThemeColors",
      JSON.stringify(PERSONAL_DEFAULT_COLORS),
    );
    setThemeState("default");
    localStorage.setItem("theme", "default");
    localStorage.removeItem("preferPlatformTheme");

    const root = document.documentElement;
    root.classList.remove("dark", "blue", "purple", "green", "custom");
    clearPersonalThemeInlineVars(root);
    clearBrandTheme();
    applyBrandTheme(BRAND_DEFAULTS);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("dark", "blue", "purple", "green", "custom");
    clearPersonalThemeInlineVars(root);

    if (theme === "default") {
      localStorage.setItem("theme", "default");
      clearBrandTheme();
      applyBrandTheme(BRAND_DEFAULTS);
      return;
    }

    // Personal theme owns vars — clear brand inline so class / custom styles apply
    clearBrandTheme();
    localStorage.setItem("theme", theme);

    if (theme === "dark") {
      root.classList.add("dark");
      return;
    }

    if (theme === "custom") {
      root.classList.add("custom");
      root.style.setProperty("--primary", customColors.primary);
      root.style.setProperty("--accent", customColors.accent);
      root.style.setProperty("--background", customColors.background);
      root.style.setProperty("--foreground", customColors.foreground);
      root.style.setProperty(
        "--primary-foreground",
        contrastForPrimary(customColors.primary),
      );
      root.style.setProperty("--accent-foreground", "0 0% 9%");
      root.style.setProperty("--card", customColors.background);
      root.style.setProperty("--card-foreground", customColors.foreground);
      root.style.setProperty("--ring", customColors.primary);
      root.style.setProperty("--line-strong", customColors.primary);
      applyDarkSidebar(root);

      const bgParts = customColors.background.split(/\s+/);
      const bgL = parseInt(bgParts[2], 10) || 50;
      if (bgL < 50) {
        root.style.setProperty(
          "--secondary",
          `${bgParts[0]} ${bgParts[1]} ${Math.min(bgL + 5, 20)}%`,
        );
        root.style.setProperty(
          "--muted",
          `${bgParts[0]} ${bgParts[1]} ${Math.min(bgL + 5, 20)}%`,
        );
        root.style.setProperty(
          "--border",
          `${bgParts[0]} ${bgParts[1]} ${Math.min(bgL + 8, 25)}%`,
        );
        root.style.setProperty(
          "--surface",
          `${bgParts[0]} ${bgParts[1]} ${Math.min(bgL + 5, 20)}%`,
        );
      } else {
        root.style.setProperty(
          "--secondary",
          `${bgParts[0]} ${bgParts[1]} ${Math.max(bgL - 2, 96)}%`,
        );
        root.style.setProperty(
          "--muted",
          `${bgParts[0]} ${bgParts[1]} ${Math.max(bgL - 2, 96)}%`,
        );
        root.style.setProperty(
          "--border",
          `${bgParts[0]} ${bgParts[1]} ${Math.max(bgL - 18, 82)}%`,
        );
        root.style.setProperty(
          "--surface",
          `${bgParts[0]} ${bgParts[1]} ${Math.max(bgL - 2, 96)}%`,
        );
      }
      return;
    }

    // blue | purple | green — CSS class themes; force black sidebar after class paints
    root.classList.add(theme);
    // Re-assert dark sidebar so colorful themes don't lighten the nav
    applyDarkSidebar(root);
  }, [theme, customColors]);

  const setTheme = (newTheme: Theme) => {
    localStorage.removeItem("preferPlatformTheme");
    setThemeState(newTheme);
  };

  const setCustomColors = (colors: CustomThemeColors) => {
    setCustomColorsState(colors);
    localStorage.setItem("customThemeColors", JSON.stringify(colors));
  };

  const setGlassmorphism = (enabled: boolean) => {
    setGlassmorphismState(enabled);
    localStorage.setItem("glassmorphism", JSON.stringify(enabled));
    if (enabled) {
      document.body.classList.add("glassmorphism-enabled");
    } else {
      document.body.classList.remove("glassmorphism-enabled");
    }
  };

  useEffect(() => {
    if (glassmorphism) {
      document.body.classList.add("glassmorphism-enabled");
    } else {
      document.body.classList.remove("glassmorphism-enabled");
    }
  }, [glassmorphism]);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        customColors,
        setCustomColors,
        resetPersonalTheme,
        glassmorphism,
        setGlassmorphism,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
