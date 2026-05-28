// @ts-nocheck
﻿import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type PaymentDetailsPayload = {
  id: string;
  amount: number;
  method: string;
  status: string;
  paid_at: string | null;
  created_at: string;
  currency: string;
  gateway: string;
  gateway_ref: string | null;
  paystack_transaction_id: string | null;
  invoice_id: string;
  invoice_number?: string | null;
  payer_name: string | null;
  payer_role: string | null;
  payment_context: string;
  notes: string | null;
};

const statusMap: Record<string, { label: string; className: string }> = {
  paid: { label: "Successful", className: "bg-success/10 text-success border-success/20" },
  pending: { label: "Pending", className: "bg-warning/10 text-warning border-warning/20" },
  processing: { label: "Processing", className: "bg-info/10 text-info border-info/20" },
  failed: { label: "Failed", className: "bg-destructive/10 text-destructive border-destructive/20" },
  refunded: { label: "Refunded", className: "bg-muted text-muted-foreground border-border" },
  disputed: { label: "Disputed", className: "bg-destructive/10 text-destructive border-destructive/20" },
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[8.5rem_1fr] gap-2 border-b border-border/60 py-2 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 break-all font-medium text-foreground">{value}</span>
    </div>
  );
}

export function PaymentDetailsDialog({
  payment,
  open,
  onOpenChange,
}: {
  payment: PaymentDetailsPayload | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!payment) return null;
  const st = statusMap[payment.status] || statusMap.pending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Payment details</DialogTitle>
          <p className="text-xs text-muted-foreground">Gateway identifiers and settlement metadata</p>
        </DialogHeader>
        <div className="space-y-1 pt-1">
          <div className="flex items-center gap-2 pb-2">
            <Badge variant="outline" className={cn("text-xs", st.className)}>
              {st.label}
            </Badge>
            <span className="text-sm font-semibold text-foreground">
              {payment.currency} {Number(payment.amount).toLocaleString()}
            </span>
          </div>
          <Row label="Invoice" value={payment.invoice_number || payment.invoice_id} />
          <Row label="Method" value={payment.method.replace(/_/g, " ")} />
          <Row label="Gateway" value={payment.gateway} />
          <Row label="Context" value={payment.payment_context?.replace(/_/g, " ") || "—"} />
          <Row label="Paid by" value={payment.payer_name || payment.payer_role?.replace(/_/g, " ") || "—"} />
          <Row
            label="Transaction reference"
            value={payment.gateway_ref || "—"}
          />
          <Row
            label="Transaction ID"
            value={payment.paystack_transaction_id || "—"}
          />
          <Row
            label="Paid at"
            value={payment.paid_at ? new Date(payment.paid_at).toLocaleString() : "—"}
          />
          <Row label="Recorded" value={new Date(payment.created_at).toLocaleString()} />
          <Row label="Internal ID" value={payment.id} />
          {payment.notes ? <Row label="Notes" value={payment.notes} /> : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}