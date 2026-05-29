import { cn } from "@/lib/utils";
import type { ScheduleEntry, TimetablePeriod } from "@/timetable/lib/types";
import { WEEKDAYS } from "@/timetable/lib/types";
import { TimetableCellCard } from "@/timetable/components/TimetableCellCard";
import { entryHasConflict, type TimetableConflict } from "@/timetable/lib/conflicts";

function formatTimeRange(start: string, end: string) {
  const fmt = (t: string) => {
    const [h, m] = t.slice(0, 5).split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
  };
  return `${fmt(start)} – ${fmt(end)}`;
}

export function TimetableGrid({
  periods,
  entries,
  conflicts = [],
  editable = false,
  includeSaturday = false,
  onCellClick,
  onMoveEntry,
}: {
  periods: TimetablePeriod[];
  entries: ScheduleEntry[];
  conflicts?: TimetableConflict[];
  editable?: boolean;
  includeSaturday?: boolean;
  onCellClick?: (day: number, period: TimetablePeriod) => void;
  onMoveEntry?: (entryId: string, day: number, period: TimetablePeriod) => void;
}) {
  const days = WEEKDAYS.filter((d) => (includeSaturday ? true : d.value <= 5));
  const dragIdRef = { current: "" as string };

  const findEntry = (day: number, period: TimetablePeriod) =>
    entries.find(
      (e) =>
        e.day_of_week === day &&
        period.period_type === "period" &&
        e.start_time.slice(0, 5) === period.start_time.slice(0, 5),
    );

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr className="bg-muted/40">
            <th className="sticky left-0 z-10 bg-muted/40 p-3 text-left text-xs font-semibold text-muted-foreground w-[100px] border-b border-border">
              Time
            </th>
            {days.map((d) => (
              <th key={d.value} className="p-3 text-center text-xs font-semibold border-b border-border">
                {d.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {periods.map((period) => {
            if (period.period_type !== "period") {
              return (
                <tr key={period.id} className="bg-muted/30">
                  <td
                    colSpan={days.length + 1}
                    className="py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border"
                  >
                    {period.name} · {formatTimeRange(period.start_time, period.end_time)}
                  </td>
                </tr>
              );
            }

            return (
              <tr key={period.id} className="border-b border-border/60">
                <td className="sticky left-0 z-10 bg-card p-2 text-[10px] text-muted-foreground border-r border-border/60 align-top">
                  <div className="font-medium">{period.name}</div>
                  <div>{formatTimeRange(period.start_time, period.end_time)}</div>
                </td>
                {days.map((day) => {
                  const entry = findEntry(day.value, period);
                  return (
                    <td key={`${day.value}-${period.id}`} className="p-1.5 align-top bg-card">
                      <TimetableCellCard
                        entry={entry}
                        hasConflict={entry ? entryHasConflict(entry.id, conflicts) : false}
                        editable={editable}
                        onClick={() => onCellClick?.(day.value, period)}
                        onDragStart={(e) => {
                          if (!entry) return;
                          dragIdRef.current = entry.id;
                          e.dataTransfer.setData("text/plain", entry.id);
                        }}
                        onDragOver={(e) => {
                          if (editable) e.preventDefault();
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          const id = e.dataTransfer.getData("text/plain") || dragIdRef.current;
                          if (id && onMoveEntry) onMoveEntry(id, day.value, period);
                        }}
                      />
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
