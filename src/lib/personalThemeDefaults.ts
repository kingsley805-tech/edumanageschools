import { THEME_INLINE_VARS } from "@/lib/themeColors";

/** Personal theme defaults — Auth/Landing green primary */
export const PERSONAL_DEFAULT_COLORS = {
  primary: "142 71% 45%",
  accent: "142 69% 58%",
  background: "0 0% 100%",
  foreground: "0 0% 4%",
} as const;

export const PERSONAL_THEME_INLINE_VARS = THEME_INLINE_VARS;

export function clearPersonalThemeInlineVars(
  root: HTMLElement = document.documentElement,
) {
  for (const prop of PERSONAL_THEME_INLINE_VARS) {
    root.style.removeProperty(prop);
  }
}
