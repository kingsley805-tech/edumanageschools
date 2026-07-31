import * as XLSX from "xlsx";
import { Document, Page, Text, View, StyleSheet, pdf } from "@react-pdf/renderer";
import React from "react";

// PDF Styles
const pdfStyles = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: "Helvetica",
  },
  header: {
    fontSize: 20,
    marginBottom: 20,
    textAlign: "center",
    fontWeight: "bold",
  },
  subheader: {
    fontSize: 14,
    marginBottom: 10,
    fontWeight: "bold",
  },
  section: {
    marginBottom: 15,
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
    paddingVertical: 5,
  },
  headerRow: {
    flexDirection: "row",
    borderBottomWidth: 2,
    borderBottomColor: "#333",
    paddingVertical: 5,
    backgroundColor: "#f5f5f5",
  },
  cell: {
    flex: 1,
    fontSize: 10,
    paddingHorizontal: 5,
  },
  headerCell: {
    flex: 1,
    fontSize: 10,
    fontWeight: "bold",
    paddingHorizontal: 5,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 20,
  },
  statBox: {
    width: "25%",
    padding: 10,
    marginBottom: 10,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
  },
  statLabel: {
    fontSize: 9,
    textAlign: "center",
    color: "#666",
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 30,
    right: 30,
    fontSize: 8,
    color: "#999",
    textAlign: "center",
  },
});

export interface ExamReportData {
  examTitle: string;
  className: string;
  subjectName: string;
  examDate: string;
  totalMarks: number;
  passingMarks: number;
  stats: {
    totalStudents: number;
    attempted: number;
    passed: number;
    avgScore: number;
    highestScore: number;
    lowestScore: number;
    passRate: number;
  };
  students: {
    name: string;
    email: string;
    score: number;
    percentage: number;
    status: string;
    violations: number;
    timeTaken: string;
  }[];
  questionAnalytics: {
    question: string;
    correct: number;
    wrong: number;
    skipped: number;
  }[];
}

// Excel Export
export const exportToExcel = (data: ExamReportData) => {
  const wb = XLSX.utils.book_new();

  // Summary Sheet
  const summaryData = [
    ["Exam Report Summary"],
    [""],
    ["Exam Title", data.examTitle],
    ["Class", data.className],
    ["Subject", data.subjectName],
    ["Date", data.examDate],
    ["Total Marks", data.totalMarks],
    ["Passing Marks", data.passingMarks],
    [""],
    ["Statistics"],
    ["Total Students", data.stats.totalStudents],
    ["Attempted", data.stats.attempted],
    ["Passed", data.stats.passed],
    ["Pass Rate", `${data.stats.passRate.toFixed(1)}%`],
    ["Average Score", data.stats.avgScore.toFixed(2)],
    ["Highest Score", data.stats.highestScore],
    ["Lowest Score", data.stats.lowestScore],
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, summarySheet, "Summary");

  // Students Sheet
  const studentsHeader = ["Name", "Email", "Score", "Percentage", "Status", "Violations", "Time Taken"];
  const studentsData = data.students.map(s => [
    s.name,
    s.email,
    s.score,
    `${s.percentage.toFixed(1)}%`,
    s.status,
    s.violations,
    s.timeTaken,
  ]);
  const studentsSheet = XLSX.utils.aoa_to_sheet([studentsHeader, ...studentsData]);
  XLSX.utils.book_append_sheet(wb, studentsSheet, "Students");

  // Questions Sheet
  const questionsHeader = ["Question", "Correct", "Wrong", "Skipped"];
  const questionsData = data.questionAnalytics.map(q => [
    q.question.substring(0, 100) + (q.question.length > 100 ? "..." : ""),
    q.correct,
    q.wrong,
    q.skipped,
  ]);
  const questionsSheet = XLSX.utils.aoa_to_sheet([questionsHeader, ...questionsData]);
  XLSX.utils.book_append_sheet(wb, questionsSheet, "Question Analysis");

  // Download
  XLSX.writeFile(wb, `${data.examTitle.replace(/[^a-z0-9]/gi, "_")}_Report.xlsx`);
};

// PDF Document Component
const ExamReportPDF = ({ data }: { data: ExamReportData }) => (
  React.createElement(Document, {},
    React.createElement(Page, { size: "A4", style: pdfStyles.page },
      React.createElement(Text, { style: pdfStyles.header }, `Exam Report: ${data.examTitle}`),
      React.createElement(View, { style: pdfStyles.section },
        React.createElement(Text, { style: { fontSize: 11, marginBottom: 3 } }, `Class: ${data.className}`),
        React.createElement(Text, { style: { fontSize: 11, marginBottom: 3 } }, `Subject: ${data.subjectName}`),
        React.createElement(Text, { style: { fontSize: 11, marginBottom: 3 } }, `Date: ${data.examDate}`),
        React.createElement(Text, { style: { fontSize: 11 } }, `Total Marks: ${data.totalMarks} | Passing: ${data.passingMarks}`)
      ),
      React.createElement(View, { style: pdfStyles.statsGrid },
        React.createElement(View, { style: pdfStyles.statBox },
          React.createElement(Text, { style: pdfStyles.statValue }, String(data.stats.attempted)),
          React.createElement(Text, { style: pdfStyles.statLabel }, "Attempted")
        ),
        React.createElement(View, { style: pdfStyles.statBox },
          React.createElement(Text, { style: pdfStyles.statValue }, `${data.stats.passRate.toFixed(0)}%`),
          React.createElement(Text, { style: pdfStyles.statLabel }, "Pass Rate")
        ),
        React.createElement(View, { style: pdfStyles.statBox },
          React.createElement(Text, { style: pdfStyles.statValue }, data.stats.avgScore.toFixed(1)),
          React.createElement(Text, { style: pdfStyles.statLabel }, "Avg Score")
        ),
        React.createElement(View, { style: pdfStyles.statBox },
          React.createElement(Text, { style: pdfStyles.statValue }, String(data.stats.highestScore)),
          React.createElement(Text, { style: pdfStyles.statLabel }, "Highest")
        )
      ),
      React.createElement(Text, { style: pdfStyles.subheader }, "Student Results"),
      React.createElement(View, { style: pdfStyles.headerRow },
        React.createElement(Text, { style: { ...pdfStyles.headerCell, flex: 2 } }, "Name"),
        React.createElement(Text, { style: pdfStyles.headerCell }, "Score"),
        React.createElement(Text, { style: pdfStyles.headerCell }, "%"),
        React.createElement(Text, { style: pdfStyles.headerCell }, "Status"),
        React.createElement(Text, { style: pdfStyles.headerCell }, "Violations")
      ),
      ...data.students.slice(0, 20).map((student, idx) =>
        React.createElement(View, { key: idx, style: pdfStyles.row },
          React.createElement(Text, { style: { ...pdfStyles.cell, flex: 2 } }, student.name),
          React.createElement(Text, { style: pdfStyles.cell }, String(student.score)),
          React.createElement(Text, { style: pdfStyles.cell }, `${student.percentage.toFixed(1)}%`),
          React.createElement(Text, { style: pdfStyles.cell }, student.status),
          React.createElement(Text, { style: pdfStyles.cell }, String(student.violations))
        )
      ),
      React.createElement(Text, { style: pdfStyles.footer }, 
        `Generated on ${new Date().toLocaleString()} | Page 1`
      )
    )
  )
);

// PDF Export
export const exportToPDF = async (data: ExamReportData) => {
  const doc = React.createElement(ExamReportPDF, { data }) as React.ReactElement;
  const blob = await pdf(doc).toBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${data.examTitle.replace(/[^a-z0-9]/gi, "_")}_Report.pdf`;
  link.click();
  URL.revokeObjectURL(url);
};

/**
 * Generic tabular export helpers used by dashboard/report screens
 * (e.g. the admin Reports & Analytics page) that don't have a bespoke
 * export shape like ExamReportData above.
 */
export interface GenericTableExport {
  title: string;
  subtitle?: string;
  /** Optional label/value pairs shown above the table (KPI summary). */
  summary?: { label: string; value: string }[];
  headers: string[];
  rows: (string | number)[][];
}

export const exportGenericTableToExcel = (data: GenericTableExport, fileName?: string) => {
  const wb = XLSX.utils.book_new();

  if (data.summary && data.summary.length > 0) {
    const summarySheetRows = [[data.title], [""], ...data.summary.map((s) => [s.label, s.value])];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summarySheetRows), "Summary");
  }

  const detailSheet = XLSX.utils.aoa_to_sheet([data.headers, ...data.rows]);
  XLSX.utils.book_append_sheet(wb, detailSheet, "Details");

  const safeName = fileName || `${data.title.replace(/[^a-z0-9]/gi, "_")}.xlsx`;
  XLSX.writeFile(wb, safeName);
};

const genericPdfStyles = StyleSheet.create({
  page: { padding: 32, fontFamily: "Helvetica" },
  title: { fontSize: 18, fontWeight: "bold", marginBottom: 4 },
  subtitle: { fontSize: 10, color: "#666", marginBottom: 16 },
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", marginBottom: 16 },
  summaryBox: { width: "25%", marginBottom: 10 },
  summaryLabel: { fontSize: 8, color: "#666" },
  summaryValue: { fontSize: 14, fontWeight: "bold" },
  headerRow: {
    flexDirection: "row",
    borderBottomWidth: 2,
    borderBottomColor: "#333",
    paddingVertical: 5,
    backgroundColor: "#f5f5f5",
  },
  row: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#e5e5e5", paddingVertical: 4 },
  cell: { flex: 1, fontSize: 9, paddingHorizontal: 4 },
  headerCell: { flex: 1, fontSize: 9, fontWeight: "bold", paddingHorizontal: 4 },
  footer: { position: "absolute", bottom: 24, left: 32, right: 32, fontSize: 8, color: "#999", textAlign: "center" },
});

const GenericTablePDF = ({ data }: { data: GenericTableExport }) =>
  React.createElement(
    Document,
    {},
    React.createElement(
      Page,
      { size: "A4", style: genericPdfStyles.page },
      React.createElement(Text, { style: genericPdfStyles.title }, data.title),
      data.subtitle ? React.createElement(Text, { style: genericPdfStyles.subtitle }, data.subtitle) : null,
      data.summary && data.summary.length > 0
        ? React.createElement(
            View,
            { style: genericPdfStyles.summaryGrid },
            ...data.summary.map((s, idx) =>
              React.createElement(
                View,
                { key: idx, style: genericPdfStyles.summaryBox },
                React.createElement(Text, { style: genericPdfStyles.summaryValue }, s.value),
                React.createElement(Text, { style: genericPdfStyles.summaryLabel }, s.label),
              ),
            ),
          )
        : null,
      React.createElement(
        View,
        { style: genericPdfStyles.headerRow },
        ...data.headers.map((h, idx) => React.createElement(Text, { key: idx, style: genericPdfStyles.headerCell }, h)),
      ),
      ...data.rows.slice(0, 200).map((row, rIdx) =>
        React.createElement(
          View,
          { key: rIdx, style: genericPdfStyles.row },
          ...row.map((cell, cIdx) => React.createElement(Text, { key: cIdx, style: genericPdfStyles.cell }, String(cell))),
        ),
      ),
      React.createElement(Text, { style: genericPdfStyles.footer }, `Generated ${new Date().toLocaleString()}`),
    ),
  );

export const exportGenericTableToPDFBlob = async (data: GenericTableExport): Promise<Blob> => {
  const doc = React.createElement(GenericTablePDF, { data }) as React.ReactElement;
  return pdf(doc).toBlob();
};

export const exportGenericTableToPDF = async (data: GenericTableExport, fileName?: string) => {
  const blob = await exportGenericTableToPDFBlob(data);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName || `${data.title.replace(/[^a-z0-9]/gi, "_")}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
};
