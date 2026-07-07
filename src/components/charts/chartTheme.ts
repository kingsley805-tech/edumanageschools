/** Shared analytics chart palette (ISP-style emerald bars + white comparison line). */
export const CHART_CURRENT_GRADIENT = {
  start: "#064e3b",
  end: "#34d399",
};

export const CHART_CURRENT_SOLID = "#10b981";
export const CHART_PREVIOUS_LINE = "#f8fafc";
export const CHART_SECONDARY_LINE = "#94a3b8";
export const CHART_GRID = "rgba(148, 163, 184, 0.15)";
export const CHART_AXIS = "rgba(148, 163, 184, 0.55)";

export const CHART_PERIOD_OPTIONS = [
  { value: 7, label: "7d" },
  { value: 14, label: "14d" },
  { value: 30, label: "30d" },
  { value: 90, label: "90d" },
] as const;
