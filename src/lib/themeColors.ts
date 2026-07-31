import { MINGO, MINGO_HSL } from "@/lib/designTokens";

/** Platform default brand — Auth/Landing green + ink sidebar */
export const BRAND_DEFAULTS = {
  primary: MINGO.brand,
  secondary: MINGO.ink,
  accent: MINGO.brandHover,
} as const;

/** Portal shell surfaces from mingo (light content, dark sidebar) */
export const PORTAL_CANVAS = MINGO.bg;
export const PORTAL_PANEL = MINGO.bg;
export const PORTAL_BORDER = MINGO.line;
export const PORTAL_SURFACE = MINGO.surface;
export const PORTAL_SIDEBAR = MINGO.ink;

export type BrandColors = {
  primary: string;
  secondary: string;
  accent: string;
};

/** Inline CSS vars written by applyBrandTheme / personal themes */
export const THEME_INLINE_VARS = [
  "--primary",
  "--primary-foreground",
  "--accent",
  "--accent-foreground",
  "--background",
  "--foreground",
  "--card",
  "--card-foreground",
  "--popover",
  "--popover-foreground",
  "--secondary",
  "--secondary-foreground",
  "--muted",
  "--muted-foreground",
  "--border",
  "--input",
  "--ring",
  "--primary-glow",
  "--sidebar-background",
  "--sidebar-foreground",
  "--sidebar-primary",
  "--sidebar-primary-foreground",
  "--sidebar-accent",
  "--sidebar-accent-foreground",
  "--sidebar-border",
  "--sidebar-ring",
  "--gradient-hero",
  "--gradient-card",
  "--shadow-glow",
  "--success",
  "--warning",
  "--info",
  "--destructive",
  "--chart-1",
  "--chart-2",
  "--chart-3",
  "--chart-4",
  "--chart-5",
  "--surface",
  "--ink-soft",
  "--ink-faint",
  "--line-strong",
  "--critical",
  "--critical-bg",
  "--warn",
  "--warn-bg",
  "--positive",
  "--positive-bg",
  "--info-bg",
  "--brand",
  "--brand-hover",
  "--portal-accent",
  "--portal-accent-soft",
] as const;

export function normalizeHex(hex: string): string {
  let h = hex.trim();
  if (!h.startsWith("#")) h = `#${h}`;
  if (h.length === 4) {
    h = `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`;
  }
  return h.toLowerCase();
}

export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const n = normalizeHex(hex).replace("#", "");
  const r = parseInt(n.slice(0, 2), 16) / 255;
  const g = parseInt(n.slice(2, 4), 16) / 255;
  const b = parseInt(n.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      default:
        h = ((r - g) / d + 4) / 6;
    }
  }
  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

export function hslString(hex: string): string {
  const { h, s, l } = hexToHsl(hex);
  return `${h} ${s}% ${l}%`;
}

/** Pick white or black text on a colored background */
export function contrastForeground(hex: string): string {
  const n = normalizeHex(hex).replace("#", "");
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55 ? MINGO_HSL.ink : "0 0% 100%";
}

export function getStoredPersonalTheme(): string {
  if (typeof window === "undefined") return "default";
  return localStorage.getItem("theme") || "default";
}

/** True when a non-default personal theme owns CSS vars (dark/color/custom) */
export function isPersonalThemeActive(): boolean {
  const t = getStoredPersonalTheme();
  return t !== "default";
}

/** @deprecated use isPersonalThemeActive */
export function isDarkThemeActive(): boolean {
  return getStoredPersonalTheme() === "dark";
}

/**
 * Apply portal black & white theme (light content + dark sidebar).
 * Skipped while a personal theme is active so switching works.
 */
export function applyBrandTheme(_colors?: BrandColors): void {
  if (isPersonalThemeActive()) return;

  const root = document.documentElement;

  root.classList.add("school-branded");
  root.dataset.brandPrimary = BRAND_DEFAULTS.primary;
  root.dataset.brandSecondary = BRAND_DEFAULTS.secondary;
  root.dataset.brandAccent = BRAND_DEFAULTS.accent;

  root.style.setProperty("--primary", MINGO_HSL.brand);
  root.style.setProperty("--primary-foreground", "0 0% 100%");
  root.style.setProperty("--ring", MINGO_HSL.brand);
  root.style.setProperty("--primary-glow", MINGO_HSL.brandHover);

  root.style.setProperty("--background", MINGO_HSL.bg);
  root.style.setProperty("--foreground", MINGO_HSL.ink);
  root.style.setProperty("--card", MINGO_HSL.bg);
  root.style.setProperty("--card-foreground", MINGO_HSL.ink);
  root.style.setProperty("--popover", MINGO_HSL.bg);
  root.style.setProperty("--popover-foreground", MINGO_HSL.ink);
  root.style.setProperty("--secondary", MINGO_HSL.surface);
  root.style.setProperty("--secondary-foreground", MINGO_HSL.ink);
  root.style.setProperty("--muted", MINGO_HSL.surface);
  root.style.setProperty("--muted-foreground", MINGO_HSL.inkSoft);
  root.style.setProperty("--accent", MINGO_HSL.brandSoft);
  root.style.setProperty("--accent-foreground", MINGO_HSL.ink);
  root.style.setProperty("--border", MINGO_HSL.line);
  root.style.setProperty("--input", MINGO_HSL.line);

  /* Sidebar vars are deliberately NOT pinned here. They are owned by the
     `--sidebar-*` tokens in index.css so the drawer follows light/dark
     like the rest of the shell. */

  root.style.setProperty("--destructive", MINGO_HSL.critical);
  root.style.setProperty("--success", MINGO_HSL.positive);
  root.style.setProperty("--warning", MINGO_HSL.warn);
  root.style.setProperty("--info", MINGO_HSL.info);

  root.style.setProperty("--surface", MINGO_HSL.surface);
  root.style.setProperty("--ink-soft", MINGO_HSL.inkSoft);
  root.style.setProperty("--ink-faint", MINGO_HSL.inkFaint);
  root.style.setProperty("--line-strong", MINGO_HSL.lineStrong);
  root.style.setProperty("--brand", MINGO_HSL.brand);
  root.style.setProperty("--brand-hover", MINGO_HSL.brandHover);
  root.style.setProperty("--portal-accent", MINGO_HSL.brand);
  root.style.setProperty("--portal-accent-soft", `${MINGO_HSL.brand} / 0.15`);
  root.style.setProperty("--critical", MINGO_HSL.critical);
  root.style.setProperty("--critical-bg", MINGO_HSL.criticalBg);
  root.style.setProperty("--warn", MINGO_HSL.warn);
  root.style.setProperty("--warn-bg", MINGO_HSL.warnBg);
  root.style.setProperty("--positive", MINGO_HSL.positive);
  root.style.setProperty("--positive-bg", MINGO_HSL.positiveBg);
  root.style.setProperty("--info-bg", MINGO_HSL.infoBg);

  root.style.setProperty(
    "--gradient-hero",
    `linear-gradient(135deg, hsl(${MINGO_HSL.bg}), hsl(${MINGO_HSL.brandSoft}))`,
  );
  root.style.setProperty(
    "--gradient-card",
    `linear-gradient(135deg, hsl(${MINGO_HSL.bg}), hsl(${MINGO_HSL.surface}))`,
  );
  root.style.setProperty("--shadow-glow", `0 0 24px -6px hsl(${MINGO_HSL.brand} / 0.25)`);
  root.style.setProperty("--chart-1", MINGO_HSL.brand);
  root.style.setProperty("--chart-2", MINGO_HSL.brandHover);
  root.style.setProperty("--chart-3", MINGO_HSL.inkSoft);
  root.style.setProperty("--chart-4", MINGO_HSL.line);
  root.style.setProperty("--chart-5", MINGO_HSL.surface);
}

/** Force mingo light theme (used by boot/reset helpers). */
export function forceMingoTheme(): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("theme", "default");
  }
  const root = document.documentElement;
  root.classList.remove("dark", "blue", "purple", "green", "custom");
  clearBrandTheme();
  applyBrandTheme(BRAND_DEFAULTS);
}

export function clearBrandTheme(): void {
  const root = document.documentElement;
  root.classList.remove("school-branded");
  delete root.dataset.brandPrimary;
  delete root.dataset.brandSecondary;
  delete root.dataset.brandAccent;
  for (const prop of THEME_INLINE_VARS) {
    root.style.removeProperty(prop);
  }
}

export function parseSchoolBrand(row: {
  theme_primary?: string | null;
  theme_secondary?: string | null;
  theme_accent?: string | null;
} | null): BrandColors {
  // Stored school colors (logos / report metadata). Portal chrome stays mingo.
  if (!row) return { ...BRAND_DEFAULTS };
  return {
    primary: row.theme_primary?.trim()
      ? normalizeHex(row.theme_primary)
      : BRAND_DEFAULTS.primary,
    secondary: row.theme_secondary?.trim()
      ? normalizeHex(row.theme_secondary)
      : BRAND_DEFAULTS.secondary,
    accent: row.theme_accent?.trim()
      ? normalizeHex(row.theme_accent)
      : BRAND_DEFAULTS.accent,
  };
}
