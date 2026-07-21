/**
 * Design tokens — aligned with Auth/Landing color code:
 * black + white + green-500 (#22c55e) / green-400 (#4ade80).
 */
export const MINGO = {
  bg: "#ffffff",
  surface: "#fafafa",
  ink: "#0a0a0a",
  inkSoft: "#52525b",
  inkFaint: "#a1a1aa",
  line: "#e4e4e7",
  lineStrong: "#18181b",
  /** Auth/Landing CTA green (Tailwind green-500) */
  brand: "#22c55e",
  /** Auth/Landing accent / hover (Tailwind green-400) */
  brandHover: "#4ade80",
  /** Soft brand wash (≈ green-500/10 on white) */
  brandSoft: "#f0fdf4",
  critical: "#b91c1c",
  criticalBg: "#fef2f2",
  warn: "#92400e",
  warnBg: "#fffbeb",
  /** Status success — darker than brand CTA */
  positive: "#166534",
  positiveBg: "#f0fdf4",
  info: "#1d4ed8",
  infoBg: "#eff6ff",
  sidebarW: "252px",
  sidebarMute: "#27272a",
  sidebarHover: "#1c1c1f",
  sidebarBorder: "#27272a",
  sidebarMutedText: "#71717a",
  sidebarNav: "#a1a1aa",
  signOut: "#f87171",
} as const;

/** HSL channel strings for CSS variables (no hsl() wrapper). */
export const MINGO_HSL = {
  bg: "0 0% 100%",
  surface: "0 0% 98%",
  ink: "0 0% 4%",
  inkSoft: "240 5% 34%",
  inkFaint: "240 4% 65%",
  line: "240 5% 90%",
  lineStrong: "240 6% 10%",
  /** green-500 */
  brand: "142 71% 45%",
  /** green-400 */
  brandHover: "142 69% 58%",
  brandSoft: "138 76% 97%",
  critical: "0 72% 42%",
  criticalBg: "0 86% 97%",
  warn: "32 95% 31%",
  warnBg: "48 96% 89%",
  positive: "142 72% 24%",
  positiveBg: "138 76% 97%",
  info: "221 83% 48%",
  infoBg: "214 100% 97%",
  sidebarMute: "240 4% 16%",
  sidebarHover: "240 5% 12%",
  sidebarMutedText: "240 4% 46%",
  sidebarNav: "240 4% 65%",
} as const;
