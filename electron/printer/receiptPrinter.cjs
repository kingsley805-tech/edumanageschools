const { wrapDocument, printHtml, printToPdf, escapeHtml, thermalPageSize } = require("./_shared.cjs");

function buildReceiptHtml(data = {}) {
  const lines = (data.lines || [])
    .map(
      (l) =>
        `<tr><td>${escapeHtml(l.description)}</td><td style="text-align:right">${escapeHtml(l.amount)}</td></tr>`,
    )
    .join("");
  const paperWidthMm = data.paperWidthMm || 80;
  return wrapDocument(
    "Fee Receipt",
    `<h1>${escapeHtml(data.schoolName || "School")}</h1>
     <div class="muted">Receipt #${escapeHtml(data.receiptNo || "-")}</div>
     <p>Student: <strong>${escapeHtml(data.studentName || "-")}</strong></p>
     <table><thead><tr><th>Description</th><th style="text-align:right">Amount</th></tr></thead><tbody>${lines}</tbody></table>
     <h2>Total: ${escapeHtml(data.total || "0")}</h2>
     <p class="muted">${escapeHtml(data.paidAt || new Date().toLocaleString())}</p>`,
    { thermal: data.thermal === true, paperWidthMm },
  );
}

async function printReceipt(data, options = {}) {
  const html = buildReceiptHtml(data);
  const isThermal = data.thermal === true;
  const paperWidthMm = data.paperWidthMm || 80;

  if (options.toPdf) {
    return printToPdf(html, options.fileName || `receipt-${Date.now()}.pdf`, {
      ...options,
      // A dedicated PDF export of a thermal receipt should still look like a receipt,
      // not get silently resized to A4.
      pageSize: isThermal ? thermalPageSize(paperWidthMm) : options.pageSize || "A4",
    });
  }

  return printHtml(html, {
    silent: options.silent,
    deviceName: options.deviceName,
    copies: options.copies || 1,
    pageSize: options.pageSize || (isThermal ? thermalPageSize(paperWidthMm) : "A4"),
    preview: options.preview,
    margins: isThermal ? { marginType: "none" } : options.margins,
  });
}

module.exports = { printReceipt, buildReceiptHtml };
