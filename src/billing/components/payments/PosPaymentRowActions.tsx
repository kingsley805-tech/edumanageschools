// @ts-nocheck
import { useState } from "react";
import { toast } from "sonner";
import { MessageCircle, Printer, RefreshCw, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PaymentTransactionRow } from "@/billing/lib/paymentTransactions";
import { WHATSAPP_STATUS_LABELS, retryPaymentReceiptWhatsApp, sendPaymentReceiptWhatsApp } from "@/billing/lib/posWhatsAppActions";
import { downloadPosReceiptPdf, printPosReceipt } from "@/billing/lib/posReceipt";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type Props = {
  payment: PaymentTransactionRow;
  schoolId: string;
  onRefresh?: () => void;
};

export function PosPaymentWhatsAppBadge({ status }: { status?: string | null }) {
  const key = (status || "not_sent") as keyof typeof WHATSAPP_STATUS_LABELS;
  const label = WHATSAPP_STATUS_LABELS[key] ?? status ?? "Not sent";
  const className =
    key === "sent"
      ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20"
      : key === "failed"
        ? "bg-destructive/10 text-destructive border-destructive/20"
        : key === "queued" || key === "sending" || key === "retry_pending"
          ? "bg-blue-500/10 text-blue-700 border-blue-500/20"
          : "bg-muted text-muted-foreground border-border";
  return (
    <Badge variant="outline" className={cn("text-xs", className)}>
      {label}
    </Badge>
  );
}

export function PosPaymentRowActions({ payment, schoolId, onRefresh }: Props) {
  const { user } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);

  const loadReceiptContext = async () => {
    const meta = payment.metadata as {
      remaining_balance?: number;
      previous_balance?: number;
      fee_category?: string;
      academic_year?: string;
      term?: string;
    } | null;

    let studentName = payment.student_name || "Student";
    let admissionNumber = "";
    let className = "—";
    let parentName = payment.parent_name;

    if (payment.student_id) {
      const { data: st } = await supabase
        .from("students")
        .select("full_name, admission_no, admission_number, classes(name, stream)")
        .eq("id", payment.student_id)
        .maybeSingle();
      if (st) {
        studentName = st.full_name || studentName;
        admissionNumber = st.admission_no || st.admission_number || payment.student_id.slice(0, 8);
        const cls = st.classes as { name?: string; stream?: string } | null;
        className = cls ? [cls.name, cls.stream].filter(Boolean).join(" ") : "—";
      }
    }

    return {
      schoolId,
      receiptNumber: payment.receipt_number || payment.gateway_ref || payment.id.slice(0, 8).toUpperCase(),
      transactionRef: payment.gateway_ref || payment.id,
      studentName,
      admissionNumber,
      className,
      parentName,
      invoiceNumber: payment.invoice_number || payment.invoice_id.slice(0, 8),
      amount: Number(payment.amount),
      currency: payment.currency,
      method: payment.method,
      paidAt: payment.paid_at || payment.created_at,
      balanceDue: meta?.remaining_balance ?? 0,
      previousBalance: meta?.previous_balance,
      cashierName: payment.payer_name,
      academicYear: meta?.academic_year,
      term: meta?.term,
      feeCategory: meta?.fee_type ?? meta?.fee_category,
      feeType: meta?.fee_type ?? meta?.fee_category,
      notes: payment.notes,
    };
  };

  const handlePrint = async () => {
    setBusy("print");
    try {
      const ctx = await loadReceiptContext();
      await printPosReceipt(ctx);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Print failed");
    } finally {
      setBusy(null);
    }
  };

  const handleDownload = async () => {
    setBusy("download");
    try {
      const ctx = await loadReceiptContext();
      await downloadPosReceiptPdf(ctx);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Download failed");
    } finally {
      setBusy(null);
    }
  };

  const handleWhatsApp = async (retry = false) => {
    if (!payment.student_id) {
      toast.error("Payment has no linked student.");
      return;
    }
    setBusy(retry ? "retry" : "whatsapp");
    try {
      if (retry) {
        await retryPaymentReceiptWhatsApp({
          schoolId,
          paymentId: payment.id,
          deliveryId: payment.whatsapp_delivery_id,
          createdBy: user?.id,
        });
        toast.success("WhatsApp receipt retry queued.");
      } else {
        const meta = payment.metadata as {
      remaining_balance?: number;
      fee_type?: string;
      fee_category?: string;
    } | null;
        const res = await sendPaymentReceiptWhatsApp({
          schoolId,
          paymentId: payment.id,
          studentId: payment.student_id,
          studentName: payment.student_name || "Student",
          amount: Number(payment.amount),
          currency: payment.currency,
          method: payment.method,
          invoiceNumber: payment.invoice_number || payment.invoice_id.slice(0, 8),
          balance: meta?.remaining_balance ?? 0,
          receiptNumber: payment.receipt_number || payment.gateway_ref || payment.id.slice(0, 8),
          paidAt: payment.paid_at || payment.created_at,
          feeType: meta?.fee_type ?? meta?.fee_category ?? null,
          receiptUrl: payment.receipt_url,
          createdBy: user?.id,
        });
        if (res.ok) toast.success("Receipt queued for WhatsApp.");
        else toast.error(res.errors[0] || "WhatsApp failed");
      }
      onRefresh?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "WhatsApp failed");
    } finally {
      setBusy(null);
    }
  };

  const canRetry = payment.whatsapp_status === "failed" || payment.whatsapp_status === "retry_pending";

  return (
    <div className="flex flex-wrap justify-end gap-1">
      <Button variant="ghost" size="icon" className="h-8 w-8" title="Print" disabled={!!busy} onClick={handlePrint}>
        <Printer className="h-3.5 w-3.5" />
      </Button>
      <Button variant="ghost" size="icon" className="h-8 w-8" title="Download PDF" disabled={!!busy} onClick={handleDownload}>
        <Download className="h-3.5 w-3.5" />
      </Button>
      {canRetry ? (
        <Button variant="ghost" size="icon" className="h-8 w-8" title="Retry WhatsApp" disabled={!!busy} onClick={() => handleWhatsApp(true)}>
          <RefreshCw className={cn("h-3.5 w-3.5", busy === "retry" && "animate-spin")} />
        </Button>
      ) : (
        <Button variant="ghost" size="icon" className="h-8 w-8" title="Send WhatsApp" disabled={!!busy} onClick={() => handleWhatsApp(false)}>
          <MessageCircle className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}
