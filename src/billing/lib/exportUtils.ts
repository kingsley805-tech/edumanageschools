import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export function exportToCSV(filename: string, headers: string[], rows: string[][]) {
  const escape = (v: string) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [headers.map(escape).join(","), ...rows.map((r) => r.map(escape).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportToPDF(filename: string, title: string, headers: string[], rows: string[][]) {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  doc.setFontSize(14);
  doc.text(title, 40, 40);
  autoTable(doc, {
    startY: 60,
    head: [headers],
    body: rows,
    styles: { fontSize: 9, cellPadding: 6 },
    headStyles: { fillColor: [23, 163, 74] },
  });
  doc.save(`${filename}.pdf`);
}

