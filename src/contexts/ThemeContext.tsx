import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { clearBrandTheme } from "@/lib/themeColors";
import {
  PERSONAL_DEFAULT_COLORS,
  clearPersonalThemeInlineVars,
} from "@/lib/personalThemeDefaults";

type Theme = "default" | "dark" | "blue" | "purple" | "green" | "custom";

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

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("theme") as Theme) || "default";
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
    localStorage.setItem("customThemeColors", JSON.stringify(PERSONAL_DEFAULT_COLORS));
    setThemeState("default");
    localStorage.setItem("theme", "default");
    localStorage.setItem("preferPlatformTheme", "true");

    const root = document.documentElement;
    root.classList.remove("dark", "blue", "purple", "green", "custom");
    clearPersonalThemeInlineVars(root);
    clearBrandTheme();
  }, []);

  useEffect(() => {
    const root = document.documentElement;

    root.classList.remove("dark", "blue", "purple", "green", "custom");
    clearPersonalThemeInlineVars(root);

    if (theme === "default") {
      localStorage.setItem("theme", theme);
      return;
    }

    if (theme === "dark") {
      root.classList.add("dark");
    } else if (theme === "custom") {
      root.classList.add("custom");
      root.style.setProperty("--primary", customColors.primary);
      root.style.setProperty("--accent", customColors.accent);
      root.style.setProperty("--background", customColors.background);
      root.style.setProperty("--foreground", customColors.foreground);
      root.style.setProperty("--primary-foreground", "0 0% 9%");
      root.style.setProperty("--accent-foreground", "0 0% 9%");
      root.style.setProperty("--card", customColors.background);
      root.style.setProperty("--card-foreground", customColors.foreground);

      const bgParts = customColors.background.split(/\s+/);
      const bgL = parseInt(bgParts[2], 10) || 50;
      if (bgL < 50) {
        root.style.setProperty("--secondary", `${bgParts[0]} ${bgParts[1]} ${Math.min(bgL + 5, 20)}%`);
        root.style.setProperty("--muted", `${bgParts[0]} ${bgParts[1]} ${Math.min(bgL + 5, 20)}%`);
        root.style.setProperty("--border", `${bgParts[0]} ${bgParts[1]} ${Math.min(bgL + 8, 25)}%`);
      } else {
        root.style.setProperty("--secondary", `${bgParts[0]} ${bgParts[1]} ${Math.max(bgL - 2, 96)}%`);
        root.style.setProperty("--muted", `${bgParts[0]} ${bgParts[1]} ${Math.max(bgL - 2, 96)}%`);
        root.style.setProperty("--border", `${bgParts[0]} ${bgParts[1]} ${Math.max(bgL - 18, 82)}%`);
      }
    } else {
      root.classList.add(theme);
    }

    localStorage.setItem("theme", theme);
  }, [theme, customColors]);

  const setTheme = (newTheme: Theme) => {
    if (newTheme !== "default") {
      localStorage.removeItem("preferPlatformTheme");
    }
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
