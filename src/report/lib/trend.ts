import type { TrendDirection } from "@/report/portal/stat-card";

/**
 * Term-over-term (or any current-vs-previous-period) trend label, shared by
 * the admin Report Card review dashboard and the teacher Report Card
 * history page so KPI trend pills read consistently across both.
 */
export function trendFor(
  current: number,
  previous: number,
  hasPreviousPeriod: boolean,
): { direction: TrendDirection; label: string } {
  if (!hasPreviousPeriod) return { direction: "neutral", label: "No prior term yet" };
  if (previous === 0) {
    return current > 0
      ? { direction: "up", label: "New this term" }
      : { direction: "neutral", label: "No change vs last term" };
  }
  const delta = Math.round(((current - previous) / previous) * 100);
  if (Math.abs(delta) < 1) return { direction: "neutral", label: "No change vs last term" };
  return { direction: delta > 0 ? "up" : "down", label: `${delta > 0 ? "+" : ""}${delta}% vs last term` };
}

/** Sorts terms chronologically by start_date (falling back to created_at). */
export function sortTermsChronologically<T extends { start_date: string | null; created_at: string }>(
  terms: T[],
): T[] {
  return [...terms].sort((a, b) => {
    const aTime = a.start_date ? new Date(a.start_date).getTime() : new Date(a.created_at).getTime();
    const bTime = b.start_date ? new Date(b.start_date).getTime() : new Date(b.created_at).getTime();
    return aTime - bTime;
  });
}
