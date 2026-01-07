import { createContext, useContext, useEffect, useState, ReactNode } from "react";

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
  glassmorphism: boolean;
  setGlassmorphism: (enabled: boolean) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const defaultCustomColors: CustomThemeColors = {
  primary: "217 91% 60%",
  accent: "189 94% 43%",
  background: "0 0% 100%",
  foreground: "220 13% 13%",
};

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
      return saved ? JSON.parse(saved) : defaultCustomColors;
    }
    return defaultCustomColors;
  });

  const [glassmorphism, setGlassmorphismState] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("glassmorphism");
      return saved ? JSON.parse(saved) : false;
    }
    return false;
  });

  useEffect(() => {
    const root = document.documentElement;
    
    // Remove all theme classes first
    root.classList.remove("dark", "blue", "purple", "green", "custom");
    
    // Remove any custom CSS variables
    root.style.removeProperty("--primary");
    root.style.removeProperty("--accent");
    root.style.removeProperty("--background");
    root.style.removeProperty("--foreground");
    root.style.removeProperty("--primary-foreground");
    root.style.removeProperty("--accent-foreground");
    root.style.removeProperty("--card");
    root.style.removeProperty("--card-foreground");
    
    // Apply the selected theme
    if (theme === "default") {
      // Default theme - no class needed, uses :root variables
      // Ensure dark class is removed
      root.classList.remove("dark");
    } else if (theme === "dark") {
      // Dark theme - add dark class
      root.classList.add("dark");
    } else if (theme === "custom") {
      // Custom theme - apply custom colors via inline styles
      root.classList.add("custom");
      root.style.setProperty("--primary", customColors.primary);
      root.style.setProperty("--accent", customColors.accent);
      root.style.setProperty("--background", customColors.background);
      root.style.setProperty("--foreground", customColors.foreground);
      // Set other derived colors
      root.style.setProperty("--primary-foreground", "0 0% 100%");
      root.style.setProperty("--accent-foreground", "0 0% 100%");
      root.style.setProperty("--card", customColors.background);
      root.style.setProperty("--card-foreground", customColors.foreground);
      // Set secondary and muted colors based on background
      const bgParts = customColors.background.split(/\s+/);
      const bgL = parseInt(bgParts[2]) || 50;
      if (bgL < 50) {
        // Dark background
        root.style.setProperty("--secondary", `${bgParts[0]} ${bgParts[1]} ${Math.min(bgL + 5, 20)}%`);
        root.style.setProperty("--muted", `${bgParts[0]} ${bgParts[1]} ${Math.min(bgL + 5, 20)}%`);
        root.style.setProperty("--border", `${bgParts[0]} ${bgParts[1]} ${Math.min(bgL + 8, 25)}%`);
      } else {
        // Light background
        root.style.setProperty("--secondary", `${bgParts[0]} ${bgParts[1]} ${Math.max(bgL - 2, 96)}%`);
        root.style.setProperty("--muted", `${bgParts[0]} ${bgParts[1]} ${Math.max(bgL - 2, 96)}%`);
        root.style.setProperty("--border", `${bgParts[0]} ${bgParts[1]} ${Math.max(bgL - 18, 82)}%`);
      }
    } else {
      // Other themes (blue, purple, green) - add theme class
      root.classList.add(theme);
    }
    
    localStorage.setItem("theme", theme);
  }, [theme, customColors]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  const setCustomColors = (colors: CustomThemeColors) => {
    setCustomColorsState(colors);
    localStorage.setItem("customThemeColors", JSON.stringify(colors));
  };

  const setGlassmorphism = (enabled: boolean) => {
    setGlassmorphismState(enabled);
    localStorage.setItem("glassmorphism", JSON.stringify(enabled));
    // Apply class to body for global glassmorphism effect
    if (enabled) {
      document.body.classList.add("glassmorphism-enabled");
    } else {
      document.body.classList.remove("glassmorphism-enabled");
    }
  };

  useEffect(() => {
    // Apply glassmorphism class on mount and when it changes
    if (glassmorphism) {
      document.body.classList.add("glassmorphism-enabled");
    } else {
      document.body.classList.remove("glassmorphism-enabled");
    }
  }, [glassmorphism]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, customColors, setCustomColors, glassmorphism, setGlassmorphism }}>
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
