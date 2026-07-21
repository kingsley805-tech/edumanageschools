const { wrapDocument, printHtml, printToPdf, escapeHtml } = require("./_shared.cjs");

function buildCertificateHtml(data = {}) {
  return wrapDocument(
    "Certificate",
    `<div style="border:6px double #333;padding:32px;text-align:center;min-height:480px">
      <h1 style="font-size:28px;letter-spacing:2px">${escapeHtml(data.schoolName || "School")}</h1>
      <p class="muted">Certificate of ${escapeHtml(data.certificateType || "Achievement")}</p>
      <h2 style="margin-top:40px;font-size:22px">This is to certify that</h2>
      <h1 style="font-size:26px;margin:16px 0">${escapeHtml(data.recipientName || "-")}</h1>
      <p>${escapeHtml(data.body || "has successfully completed the requirements.")}</p>
      <div style="display:flex;justify-content:space-between;margin-top:64px;padding:0 24px">
        <div><div style="border-top:1px solid #333;width:160px;padding-top:6px">Principal</div></div>
        <div><div style="border-top:1px solid #333;width:160px;padding-top:6px">Date</div></div>
      </div>
    </div>`,
  );
}

async function printCertificate(data, options = {}) {
  const html = buildCertificateHtml(data);
  if (options.toPdf) return printToPdf(html, options.fileName || `certificate-${Date.now()}.pdf`, options);
  return printHtml(html, { ...options, landscape: options.landscape !== false });
}

module.exports = { printCertificate, buildCertificateHtml };
