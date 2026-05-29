import { generateReceipt, type ReceiptData } from "@/billing/lib/generateReceipt";
import { fetchSchoolLetterhead } from "@/billing/lib/schoolLetterhead";
import type { PaymentTransactionRow } from "@/billing/lib/paymentTransactions";
import { formatGateway, formatPaymentMethod } from "@/billing/lib/paymentTransactions";

export type ReceiptContext = {
  schoolId: string;
  studentName: string;
  admissionNumber?: string;
  className?: string;
  parentName?: string;
};

export async function downloadPaymentReceipt(
  payment: PaymentTransactionRow,
  ctx: ReceiptContext,
): Promise<void> {
  const letterhead = await fetchSchoolLetterhead(ctx.schoolId);
  const data: ReceiptData = {
    receiptNumber: payment.gateway_ref || payment.id.slice(0, 8).toUpperCase(),
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
    admissionNumber: ctx.admissionNumber ?? "",
    className: ctx.className ?? "—",
    parentName: ctx.parentName,
    invoiceNumber: payment.invoice_number ?? payment.invoice_id.slice(0, 8),
    amount: Number(payment.amount),
    currency: payment.currency,
    method: formatPaymentMethod(payment.method),
    gateway: formatGateway(payment.gateway),
    paymentStatus: payment.status === "paid" ? "Successful" : payment.status,
    paidAt: payment.paid_at || payment.created_at,
    paystackReference: payment.gateway_ref,
    paystackTransactionId:
      payment.paystack_transaction_id || payment.transaction_id || null,
    payerName: payment.payer_name,
  };
  await generateReceipt(data);
}

export function printPaymentReceiptPlaceholder() {
  window.print();
}
