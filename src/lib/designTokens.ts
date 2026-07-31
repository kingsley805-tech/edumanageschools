/**
 * Design tokens aligned with the updated system green:
 * active-chip style green (#065f46) + soft tint (#def7ec).
 */
export const MINGO = {
  bg: "#ffffff",
  surface: "#fafafa",
  ink: "#0a0a0a",
  inkSoft: "#52525b",
  inkFaint: "#a1a1aa",
  line: "#e4e4e7",
  lineStrong: "#18181b",
  /** Primary action green */
  brand: "#065f46",
  /** Hover/active accent green */
  brandHover: "#047857",
  /** Soft brand wash used for chips and subtle backgrounds */
  brandSoft: "#def7ec",
  critical: "#b91c1c",
  criticalBg: "#fef2f2",
  warn: "#92400e",
  warnBg: "#fffbeb",
  /** Status success — darker than brand CTA */
  positive: "#065f46",
  positiveBg: "#def7ec",
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
  /** #065f46 */
  brand: "164 86% 16%",
  /** #047857 */
  brandHover: "163 94% 24%",
  /** #def7ec */
  brandSoft: "152 76% 92%",
  critical: "0 72% 42%",
  criticalBg: "0 86% 97%",
  warn: "32 95% 31%",
  warnBg: "48 96% 89%",
  positive: "164 86% 16%",
  positiveBg: "152 76% 92%",
  info: "221 83% 48%",
  infoBg: "214 100% 97%",
  sidebarMute: "240 4% 16%",
  sidebarHover: "240 5% 12%",
  sidebarMutedText: "240 4% 46%",
  sidebarNav: "240 4% 65%",
} as const;
