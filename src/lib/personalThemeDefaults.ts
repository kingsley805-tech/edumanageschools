/** Shared personal theme defaults — black canvas, white text, neutral accents. */
export const PERSONAL_DEFAULT_COLORS = {
  primary: "0 0% 98%",
  accent: "0 0% 85%",
  background: "0 0% 4%",
  foreground: "0 0% 98%",
} as const;

export const PERSONAL_THEME_INLINE_VARS = [
  "--primary",
  "--primary-foreground",
  "--primary-glow",
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
  "--sidebar-background",
  "--sidebar-foreground",
  "--sidebar-primary",
  "--sidebar-primary-foreground",
  "--sidebar-accent",
  "--sidebar-accent-foreground",
  "--sidebar-border",
  "--sidebar-ring",
  "--success",
  "--chart-1",
  "--gradient-hero",
  "--gradient-card",
  "--shadow-glow",
] as const;

export function clearPersonalThemeInlineVars(root: HTMLElement = document.documentElement) {
  for (const prop of PERSONAL_THEME_INLINE_VARS) {
    root.style.removeProperty(prop);
  }
}
