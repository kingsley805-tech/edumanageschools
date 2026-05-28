import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useBillingAuth } from "@/billing/hooks/useBillingAuth";
import { Loader2 } from "lucide-react";

type Row = {
  id: string;
  amount: number;
  currency: string;
  gateway_ref: string | null;
  paystack_transaction_id: string | null;
  paid_at: string | null;
  created_at: string;
  billing_invoices: { invoice_number: string } | null;
};

export default function RecentPaystackPayments() {
  const { schoolId, isAdmin, loading: roleLoading } = useBillingAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRows = useCallback(async () => {
    if (!schoolId || !isAdmin) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("billing_payments")
      .select(
        "id, amount, currency, gateway_ref, paystack_transaction_id, paid_at, created_at, billing_invoices ( invoice_number )",
      )
      .eq("school_id", schoolId)
      .eq("gateway", "paystack")
      .eq("status", "paid")
      .order("paid_at", { ascending: false, nullsFirst: false })
      .limit(10);

    if (error) {
      setRows([]);
    } else {
      setRows((data || []) as Row[]);
    }
    setLoading(false);
  }, [schoolId, isAdmin]);

  useEffect(() => {
    if (roleLoading) return;
    void fetchRows();
  }, [fetchRows, roleLoading]);

  useEffect(() => {
    if (!schoolId || !isAdmin || roleLoading) return;
    const channel = supabase
      .channel("dashboard-paystack-payments")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "billing_payments", filter: `school_id=eq.${schoolId}` },
        () => {
          void fetchRows();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [schoolId, isAdmin, roleLoading, fetchRows]);

  if (!isAdmin) return null;

  return (
    <Card className="rounded-2xl border-border/60 shadow-sm shadow-black/[0.03]">
      <CardHeader>
        <CardTitle className="text-lg">Recent Paystack payments</CardTitle>
        <p className="text-xs text-muted-foreground">Latest successful online collections with references and transaction IDs.</p>
      </CardHeader>
      <CardContent>
        {roleLoading || loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No Paystack fee payments recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3">Invoice</th>
                  <th className="py-2 pr-3">Amount</th>
                  <th className="py-2 pr-3">Reference</th>
                  <th className="py-2 pr-3">Txn ID</th>
                  <th className="py-2">Paid</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="py-2 pr-3 font-mono text-xs">{r.billing_invoices?.invoice_number ?? "—"}</td>
                    <td className="py-2 pr-3 font-medium">
                      {r.currency} {Number(r.amount).toLocaleString()}
                    </td>
                    <td className="max-w-[160px] truncate py-2 pr-3 font-mono text-xs">{r.gateway_ref || "—"}</td>
                    <td className="max-w-[120px] truncate py-2 pr-3 font-mono text-xs">{r.paystack_transaction_id || "—"}</td>
                    <td className="py-2 text-xs text-muted-foreground whitespace-nowrap">
                      {r.paid_at ? new Date(r.paid_at).toLocaleDateString() : new Date(r.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
