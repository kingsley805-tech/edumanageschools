// @ts-nocheck
import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreditCard, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useBillingAuth } from "@/billing/hooks/useBillingAuth";
import { formatDistanceToNow } from "date-fns";

type AuditRow = {
  id: string;
  action: string;
  created_at: string;
  after_data: Record<string, unknown> | null;
};

const paymentActions = new Set(["online_payment_received", "manual_payment_recorded"]);

function formatPaymentLine(action: string, data: Record<string, unknown> | null): { label: string; detail: string } {
  if (!data) {
    return { label: "Activity", detail: action.replace(/_/g, " ") };
  }
  const amount = data.amount != null ? Number(data.amount) : NaN;
  const currency = typeof data.currency === "string" ? data.currency : "";
  const inv = typeof data.invoice_number === "string" ? data.invoice_number : "";
  const student =
    typeof data.student_display === "string"
      ? data.student_display
      : typeof data.student_name === "string"
        ? data.student_name
        : "";
  const method = typeof data.method === "string" ? data.method.replace(/_/g, " ") : "";
  const amtStr = Number.isFinite(amount) ? `${currency} ${amount.toLocaleString()}`.trim() : "";

  if (action === "online_payment_received") {
    const payer = typeof data.payer_name === "string" ? data.payer_name : "";
    const via = typeof data.gateway === "string" ? data.gateway : "Paystack";
    return {
      label: "Online payment received",
      detail: [student, inv && `Invoice ${inv}`, amtStr, method && `via ${method}`, payer && `— ${payer}`]
        .filter(Boolean)
        .join(" · "),
    };
  }
  if (action === "manual_payment_recorded") {
    return {
      label: "Manual payment recorded",
      detail: [amtStr, method && method, inv && `Invoice ${inv}`].filter(Boolean).join(" · "),
    };
  }
  return { label: action.replace(/_/g, " "), detail: JSON.stringify(data).slice(0, 120) };
}

export default function RecentActivity() {
  const { schoolId, isAdmin, loading: roleLoading } = useBillingAuth();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRows = useCallback(async () => {
    if (!schoolId || !isAdmin) {
      setRows([]);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("audit_logs")
      .select("id, action, created_at, after_data")
      .eq("school_id", schoolId)
      .in("action", ["online_payment_received", "manual_payment_recorded"])
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      setRows([]);
    } else {
      setRows((data || []) as AuditRow[]);
    }
    setLoading(false);
  }, [schoolId, isAdmin]);

  useEffect(() => {
    if (roleLoading) return;
    fetchRows();
  }, [fetchRows, roleLoading]);

  useEffect(() => {
    if (!schoolId || !isAdmin || roleLoading) return;

    const channel = supabase
      .channel("dashboard-payment-activity")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "audit_logs",
        },
        (payload) => {
          const row = payload.new as { action?: string; school_id?: string };
          if (row?.school_id === schoolId && row?.action && paymentActions.has(row.action)) {
            fetchRows();
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [schoolId, isAdmin, fetchRows, roleLoading]);

  if (!isAdmin) {
    return null;
  }

  return (
    <Card className="rounded-2xl border-border/60 shadow-sm shadow-black/[0.03]">
      <CardHeader>
        <CardTitle className="text-lg">Recent activity</CardTitle>
        <p className="text-xs text-muted-foreground">Payment notifications for your school (updates live when fees are paid).</p>
      </CardHeader>
      <CardContent>
        {roleLoading || loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No payment activity yet. Online payments will appear here automatically.</p>
        ) : (
          <div className="space-y-4">
            {rows.map((a) => {
              const data = a.after_data as Record<string, unknown> | null;
              const { label, detail } = formatPaymentLine(a.action, data);
              const timeAgo = formatDistanceToNow(new Date(a.created_at), { addSuffix: true });
              return (
                <div key={a.id} className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                    <CreditCard className="h-4 w-4 text-success" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-card-foreground">{label}</p>
                    <p className="text-xs text-muted-foreground break-words">{detail}</p>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">{timeAgo}</span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}