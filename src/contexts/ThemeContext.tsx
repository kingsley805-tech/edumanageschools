import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { clearBrandTheme } from "@/lib/themeColors";
import { clearPersonalThemeInlineVars } from "@/lib/personalThemeDefaults";

/**
 * Two themes: light and dark.
 *
 * The former palette themes (blue / purple / green / custom) were retired in
 * favour of a single high-contrast pair. `normalizeStoredTheme` migrates any
 * value already sitting in localStorage so existing sessions don't break.
 */
export type Theme = "light" | "dark";

const STORAGE_KEY = "theme";
const THEME_CLASSES = ["dark", "blue", "purple", "green", "custom"] as const;

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  isDark: boolean;
  /** Reverts to the light default and clears any legacy personal colours. */
  resetPersonalTheme: () => void;
  glassmorphism: boolean;
  setGlassmorphism: (enabled: boolean) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/** Legacy values map onto light so nobody is stranded on a retired palette. */
function normalizeStoredTheme(raw: string | null): Theme {
  if (raw === "dark") return "dark";
  if (raw === "light") return "light";
  if (raw === null) {
    if (
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ) {
      return "dark";
    }
  }
  return "light";
}

function readInitialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  return normalizeStoredTheme(localStorage.getItem(STORAGE_KEY));
}

/**
 * Legacy inline pins that forced an ink sidebar regardless of theme.
 * Cleared on mount so the `--sidebar-*` tokens in index.css can do their
 * job — the drawer now follows light/dark like everything else.
 */
const LEGACY_SIDEBAR_VARS = [
  "--sidebar-background",
  "--sidebar-foreground",
  "--sidebar-primary",
  "--sidebar-primary-foreground",
  "--sidebar-accent",
  "--sidebar-accent-foreground",
  "--sidebar-border",
  "--sidebar-ring",
] as const;

function clearSidebarPins(root: HTMLElement) {
  LEGACY_SIDEBAR_VARS.forEach((name) => root.style.removeProperty(name));
}

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setThemeState] = useState<Theme>(readInitialTheme);

  const [glassmorphism, setGlassmorphismState] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const saved = localStorage.getItem("glassmorphism");
    try {
      return saved ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const root = document.documentElement;

    root.classList.remove(...THEME_CLASSES);
    clearPersonalThemeInlineVars(root);
    clearBrandTheme();

    if (theme === "dark") {
      root.classList.add("dark");
    }
    /* Nothing is pinned inline — the `.dark` class and the token blocks in
       index.css own every colour, which is what lets the sidebar, charts and
       popovers all flip together. */
    root.style.colorScheme = theme;
    clearSidebarPins(root);

    localStorage.setItem(STORAGE_KEY, theme);
    localStorage.removeItem("preferPlatformTheme");
  }, [theme]);

  /* Enable colour transitions only after the first paint, so loading the app
     already on dark doesn't animate from light. */
  useEffect(() => {
    const root = document.documentElement;
    const frame = requestAnimationFrame(() => root.classList.add("theme-ready"));
    return () => cancelAnimationFrame(frame);
  }, []);

  /* Follow the OS only while the user hasn't made an explicit choice. */
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    if (localStorage.getItem(STORAGE_KEY)) return;

    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (event: MediaQueryListEvent) => {
      setThemeState(event.matches ? "dark" : "light");
    };
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((current) => (current === "dark" ? "light" : "dark"));
  }, []);

  const resetPersonalTheme = useCallback(() => {
    localStorage.removeItem("customThemeColors");
    localStorage.removeItem("preferPlatformTheme");
    setThemeState("light");
  }, []);

  const setGlassmorphism = useCallback((enabled: boolean) => {
    setGlassmorphismState(enabled);
    localStorage.setItem("glassmorphism", JSON.stringify(enabled));
  }, []);

  useEffect(() => {
    document.body.classList.toggle("glassmorphism-enabled", glassmorphism);
  }, [glassmorphism]);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        toggleTheme,
        isDark: theme === "dark",
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
