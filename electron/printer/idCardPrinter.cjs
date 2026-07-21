const { wrapDocument, printHtml, printToPdf, escapeHtml } = require("./_shared.cjs");

function buildIdCardHtml(data = {}) {
  return wrapDocument(
    "Student ID Card",
    `<div style="width:340px;border:1px solid #222;padding:12px;border-radius:8px">
      <h1 style="font-size:14px;text-align:center">${escapeHtml(data.schoolName || "School")}</h1>
      <div style="display:flex;gap:12px;align-items:center">
        <div style="width:84px;height:96px;background:#eee;border:1px solid #ccc;overflow:hidden">
          ${data.photoDataUrl ? `<img src="${data.photoDataUrl}" style="width:100%;height:100%;object-fit:cover"/>` : ""}
        </div>
        <div>
          <div><strong>${escapeHtml(data.studentName || "-")}</strong></div>
          <div class="muted">ID: ${escapeHtml(data.admissionNo || "-")}</div>
          <div class="muted">Class: ${escapeHtml(data.className || "-")}</div>
          <div class="muted">${escapeHtml(data.session || "")}</div>
        </div>
      </div>
      <div style="margin-top:10px;font-family:monospace;font-size:12px">${escapeHtml(data.barcode || data.admissionNo || "")}</div>
    </div>`,
  );
}

async function printIdCard(data, options = {}) {
  const html = buildIdCardHtml(data);
  if (options.toPdf) return printToPdf(html, options.fileName || `id-card-${Date.now()}.pdf`, options);
  return printHtml(html, { ...options, pageSize: options.pageSize || "A6" });
}

module.exports = { printIdCard, buildIdCardHtml };
