import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export type ExportCell = string | number | null | undefined;
export type ExportFormat = "pdf" | "word" | "excel" | "csv";

function cellText(v: ExportCell): string {
  return String(v ?? "");
}

function baseName(filename: string): string {
  return filename.replace(/\.(csv|xlsx|pdf|docx?)$/i, "");
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadCsv(filename: string, headers: string[], rows: ExportCell[][]) {
  const escape = (v: ExportCell) => {
    const s = cellText(v);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const lines = [headers.map(escape).join(","), ...rows.map((r) => r.map(escape).join(","))];
  triggerDownload(new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" }), `${baseName(filename)}.csv`);
}

export function downloadExcel(filename: string, headers: string[], rows: ExportCell[][], sheetName = "Sheet1") {
  const wb = XLSX.utils.book_new();
  const data = [headers, ...rows.map((r) => r.map(cellText))];
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws["!cols"] = headers.map((h) => ({ wch: Math.max(12, Math.min(40, h.length + 4)) }));
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31) || "Sheet1");
  XLSX.writeFile(wb, `${baseName(filename)}.xlsx`);
}

export function downloadPdf(
  filename: string,
  headers: string[],
  rows: ExportCell[][],
  title?: string,
) {
  const isLandscape = headers.length > 5;
  const doc = new jsPDF({ orientation: isLandscape ? "landscape" : "portrait", unit: "mm", format: "a4" });
  const heading = title || baseName(filename).replace(/[_-]+/g, " ");
  
  // Header accent bar
  doc.setFillColor(37, 99, 235); // #2563eb Primary blue
  doc.rect(14, 12, 3, 12, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(15, 23, 42); // #0f172a
  doc.text(heading, 20, 18);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139); // #64748b
  doc.text(`Generated on ${new Date().toLocaleString()} • ${rows.length} record(s)`, 20, 23);

  autoTable(doc, {
    startY: 28,
    head: [headers],
    body: rows.map((r) => r.map(cellText)),
    styles: {
      fontSize: 7.5,
      cellPadding: 2.5,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: [15, 23, 42], // Slate 900
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
      halign: "left",
      cellPadding: 3,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252], // Slate 50
    },
    margin: { left: 14, right: 14 },
  });

  doc.save(`${baseName(filename)}.pdf`);
}

function formatStatusCell(text: string): string {
  const lower = text.trim().toLowerCase();
  if (!lower) return escapeHtml(text);
  
  let bg = "#f1f5f9";
  let color = "#475569";
  let border = "#cbd5e1";

  if (["paid", "active", "delivered", "picked_up", "completed", "success"].includes(lower)) {
    bg = "#dcfce7";
    color = "#15803d";
    border = "#86efac";
  } else if (["pending", "processing", "partial", "ready"].includes(lower)) {
    bg = "#fef9c3";
    color = "#a16207";
    border = "#fde047";
  } else if (["unpaid", "overdue", "cancelled", "returned", "failed", "inactive"].includes(lower)) {
    bg = "#fee2e2";
    color = "#b91c1c";
    border = "#fca5a5";
  } else {
    return escapeHtml(text);
  }

  return `<span style="display:inline-block;padding:2px 8px;font-size:10px;font-weight:600;text-transform:capitalize;border-radius:4px;background-color:${bg};color:${color};border:1px solid ${border};">${escapeHtml(text)}</span>`;
}

/** Modern Word-compatible .doc (HTML) — opens beautifully in Microsoft Word / Google Docs. */
export function downloadWord(
  filename: string,
  headers: string[],
  rows: ExportCell[][],
  title?: string,
) {
  const isLandscape = headers.length > 5;
  const heading = title || baseName(filename).replace(/[_-]+/g, " ");

  const th = headers
    .map(
      (h) =>
        `<th style="background-color:#0f172a;color:#ffffff;padding:8px 10px;text-align:left;font-weight:600;font-size:11px;white-space:nowrap;border:1px solid #1e293b;text-transform:uppercase;letter-spacing:0.3px;">${escapeHtml(h)}</th>`,
    )
    .join("");

  const body = rows
    .map((r, rowIdx) => {
      const bg = rowIdx % 2 === 1 ? ' style="background-color:#f8fafc;"' : "";
      const cells = r
        .map((c, colIdx) => {
          const raw = cellText(c);
          const headerName = (headers[colIdx] || "").toLowerCase();
          const isStatus = headerName.includes("status") || headerName.includes("payment") || headerName.includes("fulfillment");
          const isMono = headerName.includes("#") || headerName.includes("ref") || headerName.includes("email") || headerName.includes("phone");
          
          let formatted = isStatus ? formatStatusCell(raw) : escapeHtml(raw);
          const monoStyle = isMono ? "font-family:Consolas,Monaco,monospace;font-size:10px;" : "";
          
          return `<td style="border:1px solid #e2e8f0;padding:7px 10px;font-size:10.5px;color:#334155;vertical-align:middle;${monoStyle}">${formatted || '<span style="color:#94a3b8">—</span>'}</td>`;
        })
        .join("");
      return `<tr${bg}>${cells}</tr>`;
    })
    .join("");

  const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(heading)}</title>
  <!--[if gte mso 9]>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>100</w:Zoom>
      <w:DoNotOptimizeForBrowser/>
    </w:WordDocument>
  </xml>
  <![endif]-->
  <style>
    @page Section1 {
      size: ${isLandscape ? "11.69in 8.27in" : "8.27in 11.69in"};
      margin: 0.6in 0.6in 0.6in 0.6in;
      mso-page-orientation: ${isLandscape ? "landscape" : "portrait"};
    }
    div.Section1 { page: Section1; }
    body {
      font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif;
      color: #1e293b;
      margin: 0;
      padding: 16px;
      background: #ffffff;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      margin-top: 14px;
      font-size: 11px;
    }
  </style>
</head>
<body>
  <div class="Section1">
    <div style="border-left: 4px solid #2563eb; padding-left: 12px; margin-bottom: 16px;">
      <h1 style="font-size: 20px; font-weight: 700; color: #0f172a; margin: 0 0 4px 0;">${escapeHtml(heading)}</h1>
      <p style="color: #64748b; font-size: 11px; margin: 0;">
        Generated on <strong>${escapeHtml(new Date().toLocaleString())}</strong> &bull; Total records: <strong>${rows.length}</strong>
      </p>
    </div>
    <table>
      <thead>
        <tr>${th}</tr>
      </thead>
      <tbody>
        ${body}
      </tbody>
    </table>
  </div>
</body>
</html>`;

  triggerDownload(
    new Blob(["\ufeff", html], { type: "application/msword;charset=utf-8" }),
    `${baseName(filename)}.doc`,
  );
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function exportTable(opts: {
  filename: string;
  headers: string[];
  rows: ExportCell[][];
  format: ExportFormat;
  title?: string;
}) {
  const { filename, headers, rows, format, title } = opts;
  switch (format) {
    case "csv":
      downloadCsv(filename, headers, rows);
      break;
    case "excel":
      downloadExcel(filename, headers, rows, title);
      break;
    case "pdf":
      downloadPdf(filename, headers, rows, title);
      break;
    case "word":
      downloadWord(filename, headers, rows, title);
      break;
  }
}
