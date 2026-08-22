// @ts-nocheck
import { generateReceipt, generateReceiptPdfBlob, type ReceiptData } from "@/billing/lib/generateReceipt";
import { fetchSchoolLetterhead } from "@/billing/lib/schoolLetterhead";
import { formatPaymentMethod, formatReceiptPaidTime } from "@/billing/lib/paymentTransactions";

declare global {
  interface Window {
    printer?: {
      receipt: (
        data: Record<string, unknown>,
        options?: Record<string, unknown>,
      ) => Promise<{ ok?: boolean; error?: string }>;
    };
  }
}

export type PosReceiptContext = {
  schoolId: string;
  receiptNumber: string;
  transactionRef: string;
  studentName: string;
  admissionNumber: string;
  className: string;
  parentName?: string | null;
  invoiceNumber: string;
  amount: number;
  currency: string;
  method: string;
  paidAt: string;
  balanceDue: number;
  previousBalance?: number;
  cashierName?: string | null;
  academicYear?: string | null;
  term?: string | null;
  feeCategory?: string | null;
  feeType?: string | null;
  notes?: string | null;
  posTerminalLabel?: string | null;
};

export async function buildPosReceiptData(ctx: PosReceiptContext): Promise<ReceiptData> {
  const letterhead = await fetchSchoolLetterhead(ctx.schoolId);
  return {
    receiptNumber: ctx.receiptNumber,
    schoolName: letterhead?.schoolName ?? "School",
    letterhead: letterhead
      ? {
          schoolName: letterhead.schoolName,
          logoUrl: letterhead.logoUrl,
          address: letterhead.address,
          phone: letterhead.phone,
          email: letterhead.email,
        }
      : null,
    studentName: ctx.studentName,
    admissionNumber: ctx.admissionNumber,
    className: ctx.className,
    parentName: ctx.parentName,
    invoiceNumber: ctx.invoiceNumber,
    amount: ctx.amount,
    currency: ctx.currency,
    method: formatPaymentMethod(ctx.method),
    gateway: "Manual",
    paymentStatus: "Successful",
    paidAt: ctx.paidAt,
    balanceDue: ctx.balanceDue,
    previousBalance: ctx.previousBalance,
    cashierName: ctx.cashierName,
    academicYear: ctx.academicYear,
    term: ctx.term,
    feeCategory: ctx.feeType ?? ctx.feeCategory,
    feeType: ctx.feeType ?? ctx.feeCategory,
    transactionNumber: ctx.transactionRef,
    notes: ctx.notes,
    payerName: ctx.cashierName,
    posTerminalLabel: ctx.method === "pos_terminal" ? ctx.posTerminalLabel : null,
  };
}

function buildThermalHtml(data: ReceiptData, paperWidthMm: number): string {
  const lh = data.letterhead;
  const rows = [
    ["Receipt No.", data.receiptNumber],
    ["Transaction", data.transactionNumber || "—"],
    ["Paid at", formatReceiptPaidTime(data.paidAt)],
    ["Cashier", data.cashierName || "—"],
    ["Student", data.studentName],
    ["ID", data.admissionNumber],
    ["Class", data.className],
    data.academicYear ? ["Year", data.academicYear] : null,
    data.term ? ["Term", data.term] : null,
    data.feeType || data.feeCategory ? ["Fee type", (data.feeType || data.feeCategory)!] : null,
    ["Invoice", data.invoiceNumber],
    ["Method", data.method],
    data.previousBalance != null ? ["Prev. balance", `${data.currency} ${data.previousBalance.toFixed(2)}`] : null,
    ["Amount paid", `${data.currency} ${data.amount.toFixed(2)}`],
    data.balanceDue != null ? ["Balance", `${data.currency} ${data.balanceDue.toFixed(2)}`] : null,
    data.parentName ? ["Parent", data.parentName] : null,
    data.notes ? ["Notes", data.notes] : null,
  ].filter(Boolean) as [string, string][];

  const rowHtml = rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:2px 0;font-size:11px;color:#555">${k}</td><td style="padding:2px 0;font-size:11px;text-align:right;font-weight:600">${v}</td></tr>`,
    )
    .join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Receipt ${data.receiptNumber}</title>
<style>
@page { margin: 4mm; size: ${paperWidthMm}mm auto; }
body { font-family: system-ui, sans-serif; margin: 0; padding: 8px; width: ${paperWidthMm - 8}mm; }
h1 { font-size: 14px; margin: 0 0 4px; text-align: center; }
.sub { font-size: 10px; color: #666; text-align: center; margin-bottom: 8px; }
table { width: 100%; border-collapse: collapse; }
.total { font-size: 16px; font-weight: 700; text-align: center; margin: 10px 0; }
.footer { font-size: 9px; color: #888; text-align: center; margin-top: 10px; }
</style></head><body>
<h1>${lh?.schoolName || data.schoolName}</h1>
<div class="sub">${[lh?.address, lh?.phone].filter(Boolean).join(" · ")}</div>
<div class="sub">OFFICIAL PAYMENT RECEIPT</div>
<table>${rowHtml}</table>
<div class="total">${data.currency} ${data.amount.toFixed(2)}</div>
<div class="footer">Thank you for your payment.</div>
<script>window.onload=function(){window.print();setTimeout(function(){window.close()},500)};</script>
</body></html>`;
}

export async function downloadPosReceiptPdf(ctx: PosReceiptContext): Promise<void> {
  const data = await buildPosReceiptData(ctx);
  await generateReceipt(data);
}

export async function printPosReceipt(
  ctx: PosReceiptContext,
  opts?: { paperWidthMm?: number; thermal?: boolean },
): Promise<void> {
  const data = await buildPosReceiptData(ctx);
  const paperWidthMm = opts?.paperWidthMm ?? 80;
  const thermal = opts?.thermal !== false;

  if (typeof window !== "undefined" && window.printer?.receipt) {
    try {
      await window.printer.receipt(
        {
          schoolName: data.letterhead?.schoolName || data.schoolName,
          receiptNo: data.receiptNumber,
          studentName: data.studentName,
          total: `${data.currency} ${data.amount.toFixed(2)}`,
          paidAt: new Date(data.paidAt).toLocaleString(),
          thermal,
          paperWidthMm,
          lines: [
            { description: "Invoice", amount: data.invoiceNumber },
            { description: "Method", amount: data.method },
            ...(data.balanceDue != null
              ? [{ description: "Balance", amount: `${data.currency} ${data.balanceDue.toFixed(2)}` }]
              : []),
          ],
        },
        { silent: false },
      );
      return;
    } catch {
      /* fall through to browser print */
    }
  }

  const html = buildThermalHtml(data, paperWidthMm);
  const w = window.open("", "_blank", "width=420,height=640");
  if (!w) {
    throw new Error("Pop-up blocked. Allow pop-ups to print the receipt.");
  }
  w.document.write(html);
  w.document.close();
}

export async function posReceiptPdfBlob(ctx: PosReceiptContext): Promise<Blob> {
  const data = await buildPosReceiptData(ctx);
  return generateReceiptPdfBlob(data);
}
