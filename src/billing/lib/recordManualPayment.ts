// @ts-nocheck
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { generateReceiptPdfBlob } from "@/billing/lib/generateReceipt";
import { fetchSchoolLetterhead } from "@/billing/lib/schoolLetterhead";
import type { ReceiptData } from "@/billing/lib/generateReceipt";
import { formatPaymentMethod } from "@/billing/lib/paymentTransactions";
import { sendFeeReceiptWhatsApp } from "@/lib/whatsapp/send";
import { loadWhatsAppSchoolSettings } from "@/lib/whatsapp/settings";

export type ManualPaymentMethod =
  | "cash"
  | "mobile_money"
  | "bank_transfer"
  | "bank_deposit"
  | "card"
  | "cheque"
  | "pos_terminal"
  | "other"
  | "ussd";

type AppRole = Database["public"]["Enums"]["app_role"];

export type RecordManualPaymentInput = {
  schoolId: string;
  invoiceId: string;
  amount: number;
  method: ManualPaymentMethod;
  paidAt: string;
  notes?: string | null;
  gatewayRef?: string | null;
  idempotencyKey?: string | null;
  userId: string;
  userDisplayName: string;
  userRole: string;
  /** Receipt context for PDF / print */
  studentName: string;
  admissionNumber: string;
  className: string;
  parentName?: string | null;
  invoiceNumber: string;
  currency: string;
  feeCategory?: string | null;
  feeItemId?: string | null;
  academicYear?: string | null;
  term?: string | null;
  studentId: string;
  parentId?: string | null;
  posTerminalLabel?: string | null;
  autoSendWhatsApp?: boolean;
  uploadReceiptPdf?: boolean;
};

export type RecordManualPaymentResult = {
  paymentId: string;
  receiptNumber: string;
  transactionRef: string;
  remainingBalance: number;
  receiptUrl: string | null;
  whatsapp: {
    queued: number;
    skipped: number;
    errors: string[];
    status: string;
  };
};

function generateReceiptNumber(schoolId: string): string {
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `RCP-${schoolId.slice(0, 4).toUpperCase()}-${day}-${suffix}`;
}

function generateTransactionRef(): string {
  return `TXN-${Date.now().toString(36).toUpperCase()}`;
}

async function uploadReceiptPdf(
  schoolId: string,
  paymentId: string,
  blob: Blob,
): Promise<string | null> {
  const path = `${schoolId}/receipts/${paymentId}.pdf`;
  const { error } = await supabase.storage.from("school-assets").upload(path, blob, {
    contentType: "application/pdf",
    upsert: true,
  });
  if (error) {
    console.warn("Receipt upload failed:", error.message);
    return null;
  }
  const { data } = supabase.storage.from("school-assets").getPublicUrl(path);
  return data.publicUrl ?? null;
}

export async function recordManualPayment(
  input: RecordManualPaymentInput,
): Promise<RecordManualPaymentResult> {
  const paymentAmount = Number(input.amount);
  if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
    throw new Error("Enter a valid payment amount.");
  }

  const { data: inv, error: invErr } = await supabase
    .from("billing_invoices")
    .select("id, school_id, student_id, total_amount, amount_paid, balance_due, status, currency")
    .eq("id", input.invoiceId)
    .eq("school_id", input.schoolId)
    .maybeSingle();

  if (invErr || !inv) throw new Error("Invoice not found.");
  if (inv.status === "void") throw new Error("Invoice is void; cannot record payment.");

  const balance =
    inv.balance_due != null
      ? Math.max(0, Number(inv.balance_due))
      : Math.max(0, Number(inv.total_amount) - Number(inv.amount_paid));

  if (balance <= 0) throw new Error("Invoice has no outstanding balance.");
  if (paymentAmount > balance + 0.005) {
    throw new Error(`Amount exceeds outstanding balance (${balance.toFixed(2)}).`);
  }

  if (input.idempotencyKey) {
    const { data: existing } = await supabase
      .from("billing_payments")
      .select("id, receipt_number, gateway_ref, metadata")
      .eq("school_id", input.schoolId)
      .contains("metadata", { idempotency_key: input.idempotencyKey })
      .maybeSingle();
    if (existing?.id) {
      const meta = existing.metadata as { remaining_balance?: number } | null;
      return {
        paymentId: existing.id,
        receiptNumber: existing.receipt_number || existing.id.slice(0, 8).toUpperCase(),
        transactionRef: existing.gateway_ref || existing.id,
        remainingBalance: meta?.remaining_balance ?? 0,
        receiptUrl: null,
        whatsapp: { queued: 0, skipped: 1, errors: [], status: "not_sent" },
      };
    }
  }

  const receiptNumber = generateReceiptNumber(input.schoolId);
  const transactionRef = input.gatewayRef?.trim() || generateTransactionRef();
  const paidAtIso = (() => {
    const base = new Date(input.paidAt);
    if (Number.isNaN(base.getTime())) return new Date().toISOString();
    const now = new Date();
    base.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), 0);
    return base.toISOString();
  })();
  const previousBalance = balance;
  const remainingBalance = Math.max(0, balance - paymentAmount);

  const fullPaymentRow = {
    school_id: input.schoolId,
    invoice_id: input.invoiceId,
    student_id: input.studentId,
    parent_id: input.parentId ?? null,
    amount: paymentAmount,
    currency: input.currency || inv.currency || "GHS",
    method: input.method,
    gateway: "manual" as const,
    gateway_ref: transactionRef,
    receipt_number: receiptNumber,
    status: "paid" as const,
    paid_at: paidAtIso,
    recorded_by: input.userId,
    payer_user_id: input.userId,
    payer_role: (input.userRole || "admin") as AppRole,
    payer_name: input.userDisplayName,
    payment_context: "school_fee",
    notes: input.notes || null,
    whatsapp_status: "not_sent",
    metadata: {
      idempotency_key: input.idempotencyKey ?? null,
      transaction_ref: transactionRef,
      remaining_balance: remainingBalance,
      previous_balance: previousBalance,
      fee_category: input.feeCategory ?? null,
      fee_type: input.feeCategory ?? null,
      fee_item_id: input.feeItemId ?? null,
      academic_year: input.academicYear ?? null,
      term: input.term ?? null,
      ...(input.method === "pos_terminal"
        ? {
            payment_channel: "pos_terminal",
            pos_reference: transactionRef,
            pos_terminal_label: input.posTerminalLabel || "POS Terminal",
          }
        : {}),
    },
  };

  let { data: paymentRow, error: payError } = await supabase
    .from("billing_payments")
    .insert(fullPaymentRow)
    .select("id")
    .maybeSingle();

  if (payError && /student_id|parent_id|receipt_number|whatsapp_status|does not exist|metadata|gateway_ref/i.test(payError.message ?? "")) {
    const {
      student_id: _s,
      parent_id: _p,
      recorded_by: _r,
      payer_user_id: _u,
      receipt_number: _rn,
      whatsapp_status: _ws,
      metadata: _m,
      ...legacyRow
    } = fullPaymentRow;
    const retry = await supabase.from("billing_payments").insert(legacyRow).select("id").maybeSingle();
    payError = retry.error;
    paymentRow = retry.data;
  }

  if (payError || !paymentRow?.id) {
    throw new Error(payError?.message || "Failed to record payment.");
  }

  const paymentId = paymentRow.id;
  const newAmountPaid = Number(inv.amount_paid) + paymentAmount;
  const totalAmount = Number(inv.total_amount);
  const newBalance = totalAmount - newAmountPaid;

  await supabase
    .from("billing_invoices")
    .update({
      amount_paid: newAmountPaid,
      balance_due: Math.max(0, newBalance),
      status: newBalance <= 0 ? "paid" : "partially_paid",
      paid_at: newBalance <= 0 ? new Date().toISOString() : null,
    })
    .eq("school_id", input.schoolId)
    .eq("id", input.invoiceId);

  await supabase.from("audit_logs").insert({
    school_id: input.schoolId,
    user_id: input.userId,
    action: "manual_payment_recorded",
    entity: "payments",
    entity_id: paymentId,
    after_data: {
      invoice_id: input.invoiceId,
      receipt_number: receiptNumber,
      amount: paymentAmount,
      method: input.method,
      transaction_ref: transactionRef,
    },
  });

  let receiptUrl: string | null = null;
  if (input.uploadReceiptPdf !== false) {
    try {
      const letterhead = await fetchSchoolLetterhead(input.schoolId);
      const receiptData: ReceiptData = {
        receiptNumber,
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
        studentName: input.studentName,
        admissionNumber: input.admissionNumber,
        className: input.className,
        parentName: input.parentName,
        invoiceNumber: input.invoiceNumber,
        amount: paymentAmount,
        currency: input.currency || inv.currency || "GHS",
        method: formatPaymentMethod(input.method),
        gateway: "Manual",
        paymentStatus: "Successful",
        paidAt: paidAtIso,
        balanceDue: remainingBalance,
        previousBalance,
        cashierName: input.userDisplayName,
        academicYear: input.academicYear,
        term: input.term,
        feeCategory: input.feeCategory,
        feeType: input.feeCategory,
        transactionNumber: transactionRef,
        notes: input.notes,
        payerName: input.userDisplayName,
        posTerminalLabel: input.method === "pos_terminal" ? input.posTerminalLabel : null,
      };
      const blob = await generateReceiptPdfBlob(receiptData);
      receiptUrl = await uploadReceiptPdf(input.schoolId, paymentId, blob);
      if (receiptUrl) {
        await supabase.from("billing_payments").update({ receipt_url: receiptUrl }).eq("id", paymentId);
      }
    } catch (err) {
      console.warn("Receipt PDF generation failed:", err);
    }
  }

  const settings = await loadWhatsAppSchoolSettings(input.schoolId);
  const shouldAutoSend = input.autoSendWhatsApp ?? settings.whatsapp_auto_send_fee_receipt;
  let whatsappResult = { queued: 0, skipped: 1, errors: [] as string[], status: "not_sent" };

  if (shouldAutoSend && input.studentId) {
    await supabase
      .from("billing_payments")
      .update({ whatsapp_status: "queued" })
      .eq("id", paymentId);

    try {
      const wa = await sendFeeReceiptWhatsApp({
        schoolId: input.schoolId,
        studentId: input.studentId,
        studentName: input.studentName,
        amount: paymentAmount.toLocaleString(),
        currency: input.currency || inv.currency || "GHS",
        method: formatPaymentMethod(input.method),
        invoiceNumber: input.invoiceNumber,
        balance: remainingBalance.toLocaleString(),
        reference: receiptNumber,
        paidAt: paidAtIso,
        feeType: input.feeCategory ?? undefined,
        paymentId,
        createdBy: input.userId,
        force: true,
        documentUrl: settings.whatsapp_send_receipt_pdf !== false ? receiptUrl : null,
      });

      whatsappResult = {
        queued: wa.queued,
        skipped: wa.skipped,
        errors: wa.errors,
        status: wa.queued > 0 ? "queued" : wa.errors.length ? "failed" : "not_sent",
      };

      const deliveryId = wa.deliveryIds[0] ?? null;
      await supabase
        .from("billing_payments")
        .update({
          whatsapp_status: whatsappResult.status,
          whatsapp_delivery_id: deliveryId,
          sent_via_whatsapp_at: whatsappResult.status === "sent" ? new Date().toISOString() : null,
        })
        .eq("id", paymentId);
    } catch (err) {
      whatsappResult = {
        queued: 0,
        skipped: 0,
        errors: [err instanceof Error ? err.message : "WhatsApp queue failed"],
        status: "failed",
      };
      await supabase.from("billing_payments").update({ whatsapp_status: "failed" }).eq("id", paymentId);
    }
  }

  return {
    paymentId,
    receiptNumber,
    transactionRef,
    remainingBalance,
    receiptUrl,
    whatsapp: whatsappResult,
  };
}
