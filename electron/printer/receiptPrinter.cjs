const { wrapDocument, printHtml, printToPdf, escapeHtml } = require("./_shared.cjs");

function buildReceiptHtml(data = {}) {
  const lines = (data.lines || [])
    .map(
      (l) =>
        `<tr><td>${escapeHtml(l.description)}</td><td>${escapeHtml(l.amount)}</td></tr>`,
    )
    .join("");
  return wrapDocument(
    "Fee Receipt",
    `<h1>${escapeHtml(data.schoolName || "School")}</h1>
     <div class="muted">Receipt #${escapeHtml(data.receiptNo || "-")}</div>
     <p>Student: <strong>${escapeHtml(data.studentName || "-")}</strong></p>
     <table><thead><tr><th>Description</th><th>Amount</th></tr></thead><tbody>${lines}</tbody></table>
     <h2>Total: ${escapeHtml(data.total || "0")}</h2>
     <p class="muted">${escapeHtml(data.paidAt || new Date().toLocaleString())}</p>`,
    { thermal: data.thermal === true },
  );
}

async function printReceipt(data, options = {}) {
  const html = buildReceiptHtml(data);
  if (options.toPdf) return printToPdf(html, options.fileName || `receipt-${Date.now()}.pdf`, options);
  return printHtml(html, { silent: options.silent, deviceName: options.deviceName, copies: options.copies || 1, pageSize: options.pageSize || (data.thermal ? "A4" : "A4"), preview: options.preview });
}

module.exports = { printReceipt, buildReceiptHtml };
