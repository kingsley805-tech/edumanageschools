// @ts-nocheck
import { fetchSchoolLetterhead } from "@/billing/lib/schoolLetterhead";
import { formatMoney } from "@/lib/currency";
import type { FamilyInvoiceLinePreview } from "@/billing/lib/familyBilling";

export type FamilyInvoicePrintData = {
  schoolId: string;
  invoiceNumber: string;
  parentName: string;
  parentPhone?: string | null;
  dueDate: string;
  currency: string;
  total: number;
  lineItems: FamilyInvoiceLinePreview[];
  childNames: string[];
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildFamilyInvoiceHtml(data: FamilyInvoicePrintData, schoolName: string, schoolMeta: string[]) {
  const rows = data.lineItems
    .map(
      (line) => `
      <tr>
        <td>${escapeHtml(line.studentName)}<br><small>${escapeHtml(line.className)}</small></td>
        <td>${escapeHtml(line.feeName)}</td>
        <td style="text-align:right">${escapeHtml(formatMoney(line.amount, line.currency))}</td>
      </tr>`,
    )
    .join("");

  const meta = schoolMeta.filter(Boolean).map((line) => `<div>${escapeHtml(line)}</div>`).join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Family Invoice ${escapeHtml(data.invoiceNumber)}</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 24px; color: #111; }
    h1 { font-size: 20px; margin: 0 0 4px; }
    .muted { color: #666; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { border-bottom: 1px solid #ddd; padding: 10px 8px; text-align: left; vertical-align: top; }
    th { font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: #555; }
    .total { margin-top: 16px; font-size: 18px; font-weight: 700; text-align: right; }
    @media print { body { margin: 12px; } }
  </style>
</head>
<body>
  <h1>${escapeHtml(schoolName)}</h1>
  <div class="muted">${meta}</div>
  <h2 style="margin-top:24px;font-size:16px">Family Invoice</h2>
  <div class="muted">
    Invoice: <strong>${escapeHtml(data.invoiceNumber)}</strong><br>
    Parent: <strong>${escapeHtml(data.parentName)}</strong>${data.parentPhone ? ` · ${escapeHtml(data.parentPhone)}` : ""}<br>
    Children: ${escapeHtml(data.childNames.join(", "))}<br>
    Due: ${escapeHtml(new Date(data.dueDate).toLocaleDateString())}
  </div>
  <table>
    <thead>
      <tr>
        <th>Student</th>
        <th>Fee</th>
        <th style="text-align:right">Amount</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="total">Total: ${escapeHtml(formatMoney(data.total, data.currency))}</div>
  <script>window.onload=function(){window.print();setTimeout(function(){window.close()},500)}</script>
</body>
</html>`;
}

export async function printFamilyInvoice(data: FamilyInvoicePrintData) {
  const letterhead = await fetchSchoolLetterhead(data.schoolId);
  const schoolName = letterhead?.schoolName ?? "School";
  const meta = [letterhead?.address, letterhead?.phone, letterhead?.email].filter(Boolean) as string[];
  const html = buildFamilyInvoiceHtml(data, schoolName, meta);
  const w = window.open("", "_blank", "width=720,height=900");
  if (!w) throw new Error("Pop-up blocked. Allow pop-ups to print the invoice.");
  w.document.write(html);
  w.document.close();
}
