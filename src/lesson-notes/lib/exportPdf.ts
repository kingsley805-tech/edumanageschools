import jsPDF from "jspdf";
import type { LessonNoteRow } from "@/lesson-notes/lib/types";
import { CONTENT_FIELD_LABELS, DAYS_OF_WEEK } from "@/lesson-notes/lib/types";

export function downloadLessonNotePdf(note: LessonNoteRow, schoolName: string) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const margin = 14;
  let y = 16;
  const w = doc.internal.pageSize.getWidth();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(schoolName || "School", margin, y);
  y += 8;
  doc.setFontSize(12);
  doc.text("Lesson Note", margin, y);
  y += 10;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  const dayLabel = DAYS_OF_WEEK.find((d) => d.value === note.day_of_week)?.label ?? note.day_of_week;
  const meta: [string, string][] = [
    ["Teacher", note.teacher_name ?? "—"],
    ["Term", note.terms?.name ?? "—"],
    ["Session", note.session_label ?? note.terms?.session ?? "—"],
    ["Week", String(note.week_number)],
    ["Day", dayLabel],
    ["Date", note.lesson_date],
    ["Class", note.classes?.name ?? "—"],
    ["Subject", note.subjects?.name ?? "—"],
    ["Topic", note.topic],
    ["Sub Topic", note.sub_topic ?? "—"],
    ["Status", note.status.replace(/_/g, " ")],
  ];

  for (const [label, value] of meta) {
    doc.setFont("helvetica", "bold");
    doc.text(`${label}:`, margin, y);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(value, w - margin - 45);
    doc.text(lines, margin + 38, y);
    y += Math.max(5, lines.length * 4.5);
    if (y > 270) {
      doc.addPage();
      y = 16;
    }
  }

  y += 4;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, w - margin, y);
  y += 8;

  for (const field of CONTENT_FIELD_LABELS) {
    const text = String(note.content?.[field.key] ?? "").trim();
    if (!text) continue;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(field.label, margin, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const lines = doc.splitTextToSize(text, w - 2 * margin);
    for (const line of lines) {
      if (y > 275) {
        doc.addPage();
        y = 16;
      }
      doc.text(line, margin, y);
      y += 4.5;
    }
    y += 3;
  }

  doc.save(`LessonNote-${note.topic.slice(0, 30).replace(/\s+/g, "_")}.pdf`);
}
