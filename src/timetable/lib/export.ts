import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { ScheduleEntry, TimetablePeriod } from "@/timetable/lib/types";
import { WEEKDAYS } from "@/timetable/lib/types";

export function exportTimetableExcel(
  className: string,
  entries: ScheduleEntry[],
  periods: TimetablePeriod[],
) {
  const days = WEEKDAYS.filter((d) => d.value <= 5);
  const rows: string[][] = [[`${className} Timetable`, ...days.map((d) => d.label)]];

  const periodRows = periods.length
    ? periods
    : [...new Set(entries.map((e) => e.start_time))].sort().map((t, i) => ({
        name: `Slot ${i + 1}`,
        start_time: t,
        end_time: entries.find((e) => e.start_time === t)?.end_time ?? t,
        period_type: "period" as const,
      }));

  for (const period of periodRows) {
    if (period.period_type === "break" || period.period_type === "lunch") {
      rows.push([`${period.name} (${formatTime(period.start_time)} – ${formatTime(period.end_time)})`, ...days.map(() => period.name.toUpperCase())]);
      continue;
    }
    const row = [`${formatTime(period.start_time)} – ${formatTime(period.end_time)}`];
    for (const day of days) {
      const slot = entries.find(
        (e) =>
          e.day_of_week === day.value &&
          e.start_time.slice(0, 5) === period.start_time.slice(0, 5),
      );
      row.push(
        slot
          ? `${slot.subjects?.name}\n${slot.teachers?.profiles?.full_name ?? ""}\n${slot.room ?? ""}`
          : "",
      );
    }
    rows.push(row);
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 14 }, ...days.map(() => ({ wch: 22 }))];
  XLSX.utils.book_append_sheet(wb, ws, "Timetable");
  XLSX.writeFile(wb, `${className.replace(/[^a-z0-9]/gi, "_")}_Timetable.xlsx`);
}

export function exportTimetablePdf(opts: {
  schoolName: string;
  className: string;
  session: string;
  term: string;
  entries: ScheduleEntry[];
  periods: TimetablePeriod[];
}) {
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(16);
  doc.text(opts.schoolName, 14, 16);
  doc.setFontSize(11);
  doc.text(`${opts.className} — ${opts.session} · ${opts.term}`, 14, 24);
  doc.text(`Generated ${new Date().toLocaleDateString()}`, 14, 30);

  const days = WEEKDAYS.filter((d) => d.value <= 5);
  const head = ["Time", ...days.map((d) => d.short)];
  const body: string[][] = [];

  const periodRows = opts.periods.length ? opts.periods : [];
  for (const p of periodRows) {
    if (p.period_type !== "period") {
      body.push([p.name, ...days.map(() => p.name.toUpperCase())]);
      continue;
    }
    const row = [`${formatTime(p.start_time)}-${formatTime(p.end_time)}`];
    for (const day of days) {
      const slot = opts.entries.find(
        (e) => e.day_of_week === day.value && e.start_time.slice(0, 5) === p.start_time.slice(0, 5),
      );
      row.push(slot ? `${slot.subjects?.name}\n${slot.teachers?.profiles?.full_name ?? ""}` : "—");
    }
    body.push(row);
  }

  autoTable(doc, { head: [head], body, startY: 36, styles: { fontSize: 8 } });
  doc.save(`${opts.className.replace(/\s+/g, "_")}_Timetable.pdf`);
}

function formatTime(t: string): string {
  const [h, m] = t.slice(0, 5).split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}
