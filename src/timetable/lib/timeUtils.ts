import type { ScheduleEntry, TimetablePeriod } from "@/timetable/lib/types";

/** HH:mm or HH:mm:ss → HH:mm for &lt;input type="time"&gt; */
export function toTimeInputValue(time: string): string {
  if (!time) return "08:00";
  const parts = time.slice(0, 8).split(":");
  const h = parts[0]?.padStart(2, "0") ?? "08";
  const m = parts[1]?.padStart(2, "0") ?? "00";
  return `${h}:${m}`;
}

export function timeToMinutes(time: string): number {
  const [h, m] = toTimeInputValue(time).split(":").map(Number);
  return h * 60 + m;
}

export function isValidTimeRange(start: string, end: string): boolean {
  return timeToMinutes(end) > timeToMinutes(start);
}

export function durationMinutes(start: string, end: string): number {
  return Math.max(0, timeToMinutes(end) - timeToMinutes(start));
}

export function formatTimeDisplay(time: string): string {
  const [h, m] = toTimeInputValue(time).split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

export function formatTimeRange(start: string, end: string): string {
  return `${formatTimeDisplay(start)} – ${formatTimeDisplay(end)}`;
}

/** Place schedule entry in the grid row where its start time falls (one row per entry). */
export function findEntryForPeriod(
  day: number,
  period: TimetablePeriod,
  entries: ScheduleEntry[],
): ScheduleEntry | undefined {
  if (period.period_type !== "period") return undefined;
  const pStart = timeToMinutes(period.start_time);
  const pEnd = timeToMinutes(period.end_time);

  return entries.find((e) => {
    if (e.day_of_week !== day) return false;
    const eStart = timeToMinutes(e.start_time);
    return eStart >= pStart && eStart < pEnd;
  });
}
