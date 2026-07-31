import { useMemo } from "react";
import { Award, TrendingUp, CalendarCheck } from "lucide-react";
import { StatCard, type TrendDirection } from "@/report/portal/stat-card";
import { totalFromSubjects } from "@/report/lib/shepherd-grading";
import type { SubjectRow } from "@/report/lib/shepherd-grading";

type StatsReportRow = {
  total_score?: number | null;
  subjects?: SubjectRow[] | null;
  class_position?: number | string | null;
  attendance_made?: number | string | null;
  attendance_total?: number | string | null;
};

function displayTotal(row: StatsReportRow): number {
  const computed = totalFromSubjects((row.subjects ?? []) as SubjectRow[]);
  return computed > 0 ? computed : row.total_score ?? 0;
}

function attendancePct(row: StatsReportRow): number | null {
  const made = Number(row.attendance_made ?? 0);
  const total = Number(row.attendance_total ?? 0);
  if (!total || Number.isNaN(made) || Number.isNaN(total)) return null;
  return Math.round((made / total) * 1000) / 10;
}

function positionNumber(row: StatsReportRow): number | null {
  const raw = row.class_position;
  if (raw == null || raw === "" || raw === "—") return null;
  const n = typeof raw === "string" ? parseInt(raw.replace(/\D/g, ""), 10) : raw;
  return Number.isFinite(n) && n > 0 ? n : null;
}

function pctTrend(current: number, previous: number | null): { direction: TrendDirection; label: string } {
  if (previous == null) return { direction: "neutral", label: "No prior term to compare" };
  const delta = Math.round((current - previous) * 10) / 10;
  if (Math.abs(delta) < 0.1) return { direction: "neutral", label: "Same as last term" };
  return { direction: delta > 0 ? "up" : "down", label: `${delta > 0 ? "+" : ""}${delta} vs last term` };
}

function positionTrend(current: number | null, previous: number | null): { direction: TrendDirection; label: string } {
  if (current == null) return { direction: "neutral", label: "Not ranked yet" };
  if (previous == null) return { direction: "neutral", label: "No prior term to compare" };
  const delta = current - previous;
  if (delta === 0) return { direction: "neutral", label: "Same position as last term" };
  return {
    direction: delta < 0 ? "down" : "up",
    label: delta < 0 ? `Up ${Math.abs(delta)} place${Math.abs(delta) === 1 ? "" : "s"}` : `Down ${delta} place${delta === 1 ? "" : "s"}`,
  };
}

/**
 * Compact KPI strip shown above the printable ShepherdReportCard on the
 * parent and student "Report Card" screens — gives a quick, scannable
 * summary (score, attendance, class position) with a trend vs the previous
 * published term report, without turning the report card itself (a faithful
 * on-screen replica of the printed document) into a dashboard.
 */
export function ReportStatsStrip({
  current,
  previous,
}: {
  current: StatsReportRow;
  previous?: StatsReportRow | null;
}) {
  const total = useMemo(() => displayTotal(current), [current]);
  const prevTotal = previous ? displayTotal(previous) : null;
  const pct = attendancePct(current);
  const prevPct = previous ? attendancePct(previous) : null;
  const position = positionNumber(current);
  const prevPosition = previous ? positionNumber(previous) : null;

  const scoreTrend = pctTrend(total, prevTotal);
  const attendanceTrend = pctTrend(pct ?? 0, prevPct);
  const posTrend = positionTrend(position, prevPosition);

  return (
    <div className="grid gap-4 sm:grid-cols-3 no-print">
      <StatCard
        index={0}
        label="Term total score"
        value={total ? total.toFixed(1) : "—"}
        icon={TrendingUp}
        trend={scoreTrend.label}
        trendDirection={scoreTrend.direction}
      />
      <StatCard
        index={1}
        label="Attendance"
        value={pct != null ? `${pct}%` : "—"}
        icon={CalendarCheck}
        trend={pct != null ? attendanceTrend.label : "No attendance recorded"}
        trendDirection={pct != null ? attendanceTrend.direction : "neutral"}
      />
      <StatCard
        index={2}
        label="Class position"
        value={position != null ? position : "—"}
        icon={Award}
        trend={posTrend.label}
        trendDirection={posTrend.direction}
        invert
      />
    </div>
  );
}
