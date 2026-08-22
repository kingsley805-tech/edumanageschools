import { generateReceipt, type ReceiptData } from "@/billing/lib/generateReceipt";
import { fetchSchoolLetterhead } from "@/billing/lib/schoolLetterhead";
import type { PaymentTransactionRow } from "@/billing/lib/paymentTransactions";
import {
  extractPaymentMetadata,
  formatGateway,
  formatPaymentMethod,
  paymentFeeType,
} from "@/billing/lib/paymentTransactions";

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
  const meta = extractPaymentMetadata(payment.metadata);
  const posMeta = payment.metadata as { pos_terminal_label?: string } | null;
  const isPos = payment.method === "pos_terminal";
  const feeType = paymentFeeType(payment);

  const data: ReceiptData = {
    receiptNumber:
      payment.receipt_number?.trim()
      || payment.gateway_ref?.trim()
      || payment.id.slice(0, 8).toUpperCase(),
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
    posTerminalLabel: isPos ? posMeta?.pos_terminal_label || "POS Terminal" : null,
    feeCategory: feeType,
    feeType,
    academicYear: meta.academic_year ?? payment.academic_year ?? null,
    term: meta.term ?? payment.term ?? null,
    transactionNumber: payment.gateway_ref,
    notes: payment.notes,
    balanceDue:
      typeof (payment.metadata as { remaining_balance?: number })?.remaining_balance === "number"
        ? Number((payment.metadata as { remaining_balance?: number }).remaining_balance)
        : null,
    previousBalance:
      typeof (payment.metadata as { previous_balance?: number })?.previous_balance === "number"
        ? Number((payment.metadata as { previous_balance?: number }).previous_balance)
        : null,
  };
  await generateReceipt(data);
}

export function printPaymentReceiptPlaceholder() {
  window.print();
}
