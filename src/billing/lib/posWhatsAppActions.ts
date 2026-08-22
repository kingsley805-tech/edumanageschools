// @ts-nocheck
import { supabase } from "@/integrations/supabase/client";
import { sendFeeReceiptWhatsApp, resendWhatsAppDelivery } from "@/lib/whatsapp/send";
import { loadWhatsAppSchoolSettings } from "@/lib/whatsapp/settings";
import { formatPaymentMethod } from "@/billing/lib/paymentTransactions";

export type PaymentWhatsAppStatus =
  | "not_sent"
  | "queued"
  | "sending"
  | "sent"
  | "failed"
  | "retry_pending";

export const WHATSAPP_STATUS_LABELS: Record<PaymentWhatsAppStatus, string> = {
  not_sent: "Not sent",
  queued: "Queued",
  sending: "Sending",
  sent: "Sent",
  failed: "Failed",
  retry_pending: "Retry pending",
};

export async function sendPaymentReceiptWhatsApp(opts: {
  schoolId: string;
  paymentId: string;
  studentId: string;
  studentName: string;
  amount: number;
  currency: string;
  method: string;
  invoiceNumber: string;
  balance: number;
  receiptNumber: string;
  paidAt: string;
  receiptUrl: string | null;
  feeType?: string | null;
  createdBy?: string | null;
}): Promise<{ ok: boolean; status: PaymentWhatsAppStatus; errors: string[] }> {
  const settings = await loadWhatsAppSchoolSettings(opts.schoolId);

  await supabase
    .from("billing_payments")
    .update({ whatsapp_status: "queued" })
    .eq("id", opts.paymentId);

  try {
    const wa = await sendFeeReceiptWhatsApp({
      schoolId: opts.schoolId,
      studentId: opts.studentId,
      studentName: opts.studentName,
      amount: opts.amount.toLocaleString(),
      currency: opts.currency,
      method: formatPaymentMethod(opts.method),
      invoiceNumber: opts.invoiceNumber,
      balance: opts.balance.toLocaleString(),
      reference: opts.receiptNumber,
      paidAt: opts.paidAt,
      feeType: opts.feeType,
      paymentId: opts.paymentId,
      createdBy: opts.createdBy,
      force: true,
      documentUrl:
        settings.whatsapp_send_receipt_pdf !== false ? opts.receiptUrl ?? null : null,
    });

    const status: PaymentWhatsAppStatus =
      wa.queued > 0 ? "queued" : wa.errors.length ? "failed" : "not_sent";

    const deliveryId = wa.deliveryIds[0] ?? null;
    await supabase
      .from("billing_payments")
      .update({
        whatsapp_status: status,
        whatsapp_delivery_id: deliveryId,
        sent_via_whatsapp_at: status === "sent" ? new Date().toISOString() : null,
      })
      .eq("id", opts.paymentId);

    await supabase.from("audit_logs").insert({
      school_id: opts.schoolId,
      user_id: opts.createdBy ?? null,
      action: status === "failed" ? "whatsapp_receipt_failed" : "whatsapp_receipt_queued",
      entity: "payments",
      entity_id: opts.paymentId,
      after_data: { delivery_id: deliveryId, status, errors: wa.errors },
    });

    return { ok: wa.queued > 0, status, errors: wa.errors };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "WhatsApp send failed";
    await supabase
      .from("billing_payments")
      .update({ whatsapp_status: "failed" })
      .eq("id", opts.paymentId);
    return { ok: false, status: "failed", errors: [msg] };
  }
}

export async function retryPaymentReceiptWhatsApp(opts: {
  schoolId: string;
  paymentId: string;
  deliveryId?: string | null;
  createdBy?: string | null;
}): Promise<void> {
  let deliveryId = opts.deliveryId;

  if (!deliveryId) {
    const { data: payment } = await supabase
      .from("billing_payments")
      .select("whatsapp_delivery_id")
      .eq("id", opts.paymentId)
      .maybeSingle();
    deliveryId = payment?.whatsapp_delivery_id ?? null;
  }

  await supabase
    .from("billing_payments")
    .update({ whatsapp_status: "retry_pending" })
    .eq("id", opts.paymentId);

  if (deliveryId) {
    await resendWhatsAppDelivery(deliveryId);
    await supabase
      .from("billing_payments")
      .update({ whatsapp_status: "queued", sent_via_whatsapp_at: null })
      .eq("id", opts.paymentId);
  } else {
    const { data: payment } = await supabase
      .from("billing_payments")
      .select(
        "id, amount, currency, method, paid_at, receipt_number, gateway_ref, receipt_url, student_id, invoice_id, metadata, billing_invoices(invoice_number, students(full_name))",
      )
      .eq("id", opts.paymentId)
      .maybeSingle();

    if (!payment?.student_id) throw new Error("Payment has no linked student.");

    const inv = payment.billing_invoices as {
      invoice_number?: string;
      students?: { full_name?: string } | null;
    } | null;
    const meta = payment.metadata as { fee_type?: string; fee_category?: string } | null;

    await sendPaymentReceiptWhatsApp({
      schoolId: opts.schoolId,
      paymentId: opts.paymentId,
      studentId: payment.student_id,
      studentName: inv?.students?.full_name ?? "Student",
      amount: Number(payment.amount),
      currency: payment.currency,
      method: payment.method,
      invoiceNumber: inv?.invoice_number ?? payment.invoice_id.slice(0, 8),
      balance: 0,
      receiptNumber: payment.receipt_number ?? payment.gateway_ref ?? payment.id.slice(0, 8),
      paidAt: payment.paid_at ?? new Date().toISOString(),
      feeType: meta?.fee_type ?? meta?.fee_category ?? null,
      receiptUrl: payment.receipt_url,
      createdBy: opts.createdBy,
    });
  }

  await supabase.from("audit_logs").insert({
    school_id: opts.schoolId,
    user_id: opts.createdBy ?? null,
    action: "whatsapp_receipt_retried",
    entity: "payments",
    entity_id: opts.paymentId,
  });
}
