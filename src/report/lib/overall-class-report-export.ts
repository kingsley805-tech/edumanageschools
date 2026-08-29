import type { OverallClassReportData } from "@/report/lib/overall-class-report";
import { formatRankLabel } from "@/report/lib/overall-class-report";
import { exportTable, type ExportFormat } from "@/modules/lib/exportTable";

export function overallClassReportToTable(data: OverallClassReportData): {
  headers: string[];
  rows: (string | number)[][];
  title: string;
} {
  const headers = [
    "No.",
    "Student Name",
    ...data.subjects.flatMap((s) => [`${s} Score`, `${s} Pos.`]),
    "Total",
    "Average",
    "Overall Position",
  ];

  const rows = data.students.map((student, idx) => [
    idx + 1,
    student.name,
    ...student.scores.flatMap((cell) => [
      cell.score != null ? cell.score : "—",
      cell.rank != null ? formatRankLabel(cell.rank) : "—",
    ]),
    student.total != null ? student.total : "—",
    student.average != null ? Number(student.average.toFixed(1)) : "—",
    student.overallRank != null ? student.overallRank : "—",
  ]);

  const title = `Overall Class Report — ${data.className} — ${data.termLabel}`;
  return { headers, rows, title };
}

export function exportOverallClassReport(
  data: OverallClassReportData,
  format: ExportFormat,
) {
  const { headers, rows, title } = overallClassReportToTable(data);
  const safeClass = data.className.replace(/\s+/g, "_");
  const safeTerm = data.termLabel.replace(/\s+/g, "_");
  exportTable({
    filename: `Overall_Class_Report_${safeClass}_${safeTerm}`,
    headers,
    rows,
    format,
    title,
  });
}
