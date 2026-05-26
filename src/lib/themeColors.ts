/** Platform default: green, black, white */
export const BRAND_DEFAULTS = {
  primary: "#16a34a",
  secondary: "#0a0a0a",
  accent: "#ffffff",
} as const;

export type BrandColors = {
  primary: string;
  secondary: string;
  accent: string;
};

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
  return luminance > 0.55 ? "0 0% 9%" : "0 0% 100%";
}

/**
 * Apply green / black / white brand palette to CSS variables.
 * primary = green actions, secondary = black sidebar/text, accent = white surfaces
 */
export function applyBrandTheme(colors: BrandColors): void {
  const root = document.documentElement;
  const primary = hslString(colors.primary);
  const secondary = hslString(colors.secondary);
  const accent = hslString(colors.accent);
  const secondaryParts = hexToHsl(colors.secondary);
  const accentParts = hexToHsl(colors.accent);

  root.classList.add("school-branded");
  root.dataset.brandPrimary = colors.primary;
  root.dataset.brandSecondary = colors.secondary;
  root.dataset.brandAccent = colors.accent;

  root.style.setProperty("--primary", primary);
  root.style.setProperty("--primary-foreground", contrastForeground(colors.primary));
  root.style.setProperty("--ring", primary);
  root.style.setProperty("--primary-glow", primary);

  root.style.setProperty("--foreground", secondary);
  root.style.setProperty("--background", accent);
  root.style.setProperty("--card", accent);
  root.style.setProperty("--card-foreground", secondary);
  root.style.setProperty("--popover", accent);
  root.style.setProperty("--popover-foreground", secondary);

  const mutedL = accentParts.l > 50 ? Math.max(accentParts.l - 4, 92) : Math.min(accentParts.l + 8, 25);
  const borderL = accentParts.l > 50 ? Math.max(accentParts.l - 12, 85) : Math.min(accentParts.l + 12, 30);
  root.style.setProperty("--secondary", `${accentParts.h} ${Math.max(accentParts.s - 20, 0)}% ${mutedL}%`);
  root.style.setProperty("--secondary-foreground", secondary);
  root.style.setProperty("--muted", `${accentParts.h} ${Math.max(accentParts.s - 20, 0)}% ${mutedL}%`);
  root.style.setProperty("--muted-foreground", `${secondaryParts.h} ${secondaryParts.s}% ${Math.min(secondaryParts.l + 35, 55)}%`);
  root.style.setProperty("--accent", primary);
  root.style.setProperty("--accent-foreground", contrastForeground(colors.primary));
  root.style.setProperty("--border", `${secondaryParts.h} ${Math.min(secondaryParts.s, 15)}% ${borderL}%`);
  root.style.setProperty("--input", `${secondaryParts.h} ${Math.min(secondaryParts.s, 15)}% ${borderL}%`);

  root.style.setProperty("--sidebar-background", secondary);
  root.style.setProperty("--sidebar-foreground", "0 0% 98%");
  root.style.setProperty("--sidebar-primary", primary);
  root.style.setProperty("--sidebar-primary-foreground", contrastForeground(colors.primary));
  root.style.setProperty(
    "--sidebar-accent",
    `${secondaryParts.h} ${secondaryParts.s}% ${Math.min(secondaryParts.l + 8, 22)}%`
  );
  root.style.setProperty("--sidebar-accent-foreground", "0 0% 98%");
  root.style.setProperty(
    "--sidebar-border",
    `${secondaryParts.h} ${secondaryParts.s}% ${Math.min(secondaryParts.l + 12, 25)}%`
  );
  root.style.setProperty("--sidebar-ring", primary);

  root.style.setProperty(
    "--gradient-hero",
    `linear-gradient(135deg, hsl(${primary} / 0.95), hsl(${secondary} / 0.92))`
  );
  root.style.setProperty(
    "--gradient-card",
    `linear-gradient(135deg, hsl(${accent}), hsl(${accentParts.h} ${accentParts.s}% ${Math.max(accentParts.l - 2, 96)}%))`
  );
  root.style.setProperty("--shadow-glow", `0 0 30px -5px hsl(${primary} / 0.35)`);

  root.style.setProperty("--success", primary);
  root.style.setProperty("--chart-1", primary);
}

export function clearBrandTheme(): void {
  const root = document.documentElement;
  root.classList.remove("school-branded");
  delete root.dataset.brandPrimary;
  delete root.dataset.brandSecondary;
  delete root.dataset.brandAccent;
  [
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
    "--chart-1",
  ].forEach((prop) => root.style.removeProperty(prop));
}

export function parseSchoolBrand(row: {
  theme_primary?: string | null;
  theme_secondary?: string | null;
  theme_accent?: string | null;
} | null): BrandColors {
  if (!row) return { ...BRAND_DEFAULTS };
  return {
    primary: normalizeHex(row.theme_primary || BRAND_DEFAULTS.primary),
    secondary: normalizeHex(row.theme_secondary || BRAND_DEFAULTS.secondary),
    accent: normalizeHex(row.theme_accent || BRAND_DEFAULTS.accent),
  };
}
