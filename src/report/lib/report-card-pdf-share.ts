import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";
import type { SubjectRow } from "@/report/lib/shepherd-grading";
import { fmtScore, formatRankLabel, totalFromSubjects } from "@/report/lib/shepherd-grading";
import { isMissingSchemaColumnError } from "@/report/lib/supabase-errors";

export type ReportCardPdfInput = {
  schoolId: string;
  reportId: string;
  schoolName: string;
  studentName: string;
  className?: string | null;
  termLabel?: string | null;
  academicYear?: string | null;
  classPosition?: string | null;
  subjects: SubjectRow[];
  teacherRemark?: string | null;
};

/** Build a compact printable PDF for SMS/WhatsApp sharing. */
export function buildReportCardPdfBlob(input: ReportCardPdfInput): Blob {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const margin = 14;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(input.schoolName || "School", margin, 18);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text("Student Report Card", margin, 26);

  doc.setFontSize(10);
  const meta = [
    `Student: ${input.studentName}`,
    `Class: ${input.className || "—"}`,
    `Term: ${input.termLabel || "—"}`,
    `Academic Year: ${input.academicYear || "—"}`,
    `Position: ${input.classPosition ? formatRankLabel(input.classPosition) : "—"}`,
  ];
  let y = 34;
  for (const line of meta) {
    doc.text(line, margin, y);
    y += 6;
  }

  const total = totalFromSubjects(input.subjects);
  const headers = ["Subject", "Class", "Exam", "Total", "Pos.", "Grade", "Remark"];
  const rows = input.subjects.map((s) => [
    s.name,
    fmtScore(s.classScore),
    fmtScore(s.examScore),
    fmtScore(s.total),
    s.position && s.position !== "—" ? formatRankLabel(s.position) : "—",
    s.grade || "—",
    s.remark || "—",
  ]);

  autoTable(doc, {
    startY: y + 2,
    head: [headers],
    body: rows,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [15, 23, 42], textColor: 255 },
    margin: { left: margin, right: margin },
  });

  // @ts-expect-error jspdf-autotable adds lastAutoTable
  const after = (doc as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? y + 40;
  doc.setFont("helvetica", "bold");
  doc.text(`Total: ${fmtScore(total)}`, margin, after + 10);
  if (input.teacherRemark) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const remark = doc.splitTextToSize(`Teacher remark: ${input.teacherRemark}`, 180);
    doc.text(remark, margin, after + 18);
  }

  return doc.output("blob");
}

/** Upload PDF to school-assets and persist URL on the report card. */
export async function uploadAndSaveReportCardPdf(
  input: ReportCardPdfInput,
): Promise<string | null> {
  const blob = buildReportCardPdfBlob(input);
  const path = `${input.schoolId}/report-cards/${input.reportId}.pdf`;
  const { error: upErr } = await supabase.storage.from("school-assets").upload(path, blob, {
    contentType: "application/pdf",
    upsert: true,
  });
  if (upErr) {
    console.warn("Report card PDF upload failed:", upErr.message);
    return null;
  }
  const { data } = supabase.storage.from("school-assets").getPublicUrl(path);
  const url = data.publicUrl ?? null;
  if (!url) return null;

  let { error } = await supabase
    .from("term_report_cards")
    .update({ report_pdf_url: url } as never)
    .eq("id", input.reportId);
  if (isMissingSchemaColumnError(error)) {
    // Column not migrated yet — still return the public URL for SMS body
    return url;
  }
  if (error) console.warn("Could not save report_pdf_url:", error.message);
  return url;
}

/** Ensure a public PDF URL exists for this report (generate if missing). */
export async function ensureReportCardPdfUrl(opts: {
  reportId: string;
  schoolId: string;
  existingUrl?: string | null;
  schoolName: string;
  studentName: string;
  className?: string | null;
  termLabel?: string | null;
  academicYear?: string | null;
  classPosition?: string | null;
  subjects: SubjectRow[];
  teacherRemark?: string | null;
}): Promise<string | null> {
  if (opts.existingUrl?.trim()) return opts.existingUrl.trim();
  return uploadAndSaveReportCardPdf({
    schoolId: opts.schoolId,
    reportId: opts.reportId,
    schoolName: opts.schoolName,
    studentName: opts.studentName,
    className: opts.className,
    termLabel: opts.termLabel,
    academicYear: opts.academicYear,
    classPosition: opts.classPosition,
    subjects: opts.subjects,
    teacherRemark: opts.teacherRemark,
  });
}
