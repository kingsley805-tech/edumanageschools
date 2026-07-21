const { wrapDocument, printHtml, printToPdf, escapeHtml } = require("./_shared.cjs");

function buildReportHtml(type, data = {}) {
  const titleMap = {
    payroll: "Payroll Report",
    attendance: "Attendance Report",
    inventory: "Inventory Report",
    transcript: "Academic Transcript",
    "report-card": "Student Report Card",
    admission: "Admission Form",
    invoice: "Payment Invoice",
  };
  const title = titleMap[type] || data.title || "Report";
  const rows = (data.rows || [])
    .map((r) => `<tr>${(r.cells || []).map((c) => `<td>${escapeHtml(c)}</td>`).join("")}</tr>`)
    .join("");
  const headers = (data.headers || []).map((h) => `<th>${escapeHtml(h)}</th>`).join("");

  return wrapDocument(
    title,
    `<h1>${escapeHtml(data.schoolName || "School")}</h1>
     <h2>${escapeHtml(title)}</h2>
     <p class="muted">${escapeHtml(data.subtitle || "")}</p>
     <table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>
     <p class="muted">Generated ${new Date().toLocaleString()}</p>`,
  );
}

async function printReport(type, data, options = {}) {
  const html = buildReportHtml(type, data);
  if (options.toPdf) return printToPdf(html, options.fileName || `${type}-${Date.now()}.pdf`, options);
  return printHtml(html, options);
}

module.exports = { printReport, buildReportHtml };
