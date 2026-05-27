import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

type Row = {
  id: string;
  amount: number;
  currency: string;
  method: string;
  gateway: string;
  status: string;
  gateway_ref: string | null;
  paystack_transaction_id: string | null;
  paid_at: string | null;
  created_at: string;
};

export function InvoicePaymentsDialog({
  schoolId,
  invoiceId,
  invoiceNumber,
  open,
  onOpenChange,
}: {
  schoolId: string;
  invoiceId: string | null;
  invoiceNumber: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !invoiceId || !schoolId) {
      setRows([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const { data, error } = await supabase
        .from("billing_payments")
        .select(
          "id, amount, currency, method, gateway, status, gateway_ref, paystack_transaction_id, paid_at, created_at",
        )
        .eq("school_id", schoolId)
        .eq("invoice_id", invoiceId)
        .order("created_at", { ascending: false });
      if (!cancelled) {
        if (error) setRows([]);
        else setRows((data || []) as Row[]);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, invoiceId, schoolId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Payments · {invoiceNumber}</DialogTitle>
          <p className="text-xs text-muted-foreground">Paystack references and transaction IDs for this invoice</p>
        </DialogHeader>
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">No payments recorded for this invoice.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                  <th className="px-3 py-2">Amount</th>
                  <th className="px-3 py-2">Method</th>
                  <th className="px-3 py-2">Reference</th>
                  <th className="px-3 py-2">Txn ID</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="px-3 py-2 font-medium">
                      {r.currency} {Number(r.amount).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 capitalize text-muted-foreground">{r.method.replace(/_/g, " ")}</td>
                    <td className="max-w-[140px] truncate px-3 py-2 font-mono text-xs">{r.gateway_ref || "—"}</td>
                    <td className="max-w-[120px] truncate px-3 py-2 font-mono text-xs">{r.paystack_transaction_id || "—"}</td>
                    <td className="px-3 py-2 text-xs">{r.status}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {r.paid_at ? new Date(r.paid_at).toLocaleDateString() : new Date(r.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
