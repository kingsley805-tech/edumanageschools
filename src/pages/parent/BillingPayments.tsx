// @ts-nocheck
import { useCallback, useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CreditCard, Download } from "lucide-react";
import { toast } from "sonner";
import { generateReceipt } from "@/billing/lib/generateReceipt";
import { fetchSchoolLetterhead } from "@/billing/lib/schoolLetterhead";
import { confirmPaystackPayment, initializePaystackCheckout } from "@/billing/lib/paystackConfirm";
import { formatEdgeFunctionError } from "@/lib/invokeEdgeFunction";
import {
  parsePaystackReturnSearch,
  shouldAttemptPaystackConfirm,
  isExplicitPaystackFailure,
} from "@/billing/lib/paystackReturnParams";
import { fetchParentRecordByUserId, fetchStudentsForParent } from "@/lib/parent-students";

type ChildInvoice = {
  id: string;
  invoice_number: string;
  total_amount: number;
  amount_paid: number;
  balance_due: number | null;
  status: string;
  due_date: string;
  currency: string;
};

type ChildRow = {
  id: string;
  full_name: string;
  class_name: string;
  invoices: ChildInvoice[];
};

const statusVariant: Record<string, string> = {
  paid: "bg-emerald-500/10 text-emerald-700",
  sent: "bg-blue-500/10 text-blue-700",
  partially_paid: "bg-amber-500/10 text-amber-800",
  overdue: "bg-red-500/10 text-red-700",
  draft: "bg-muted text-muted-foreground",
};

export default function ParentBillingPayments() {
  const { user } = useAuth();
  const [children, setChildren] = useState<ChildRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [schoolId, setSchoolId] = useState<string | null>(null);

  const paymentReturn = useMemo(
    () => parsePaystackReturnSearch(window.location.search),
    [],
  );

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: parent } = await supabase
        .from("parents")
        .select("id, school_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!parent) {
        setChildren([]);
        return;
      }
      setSchoolId(parent.school_id);

      const linked = await fetchStudentsForParent<{
        id: string;
        full_name: string;
        classes: { name?: string } | null;
      }>(parent.id, "id, full_name, class_id, classes(name)");

      const studentRows = linked.map((st) => ({
        id: st.id,
        full_name: st.full_name,
        class_name: st.classes?.name ?? "—",
      }));

      const studentIds = studentRows.map((s) => s.id);
      if (!studentIds.length) {
        setChildren([]);
        return;
      }

      const { data: invoices } = await supabase
        .from("billing_invoices")
        .select(
          "id, invoice_number, total_amount, amount_paid, balance_due, status, due_date, currency, student_id",
        )
        .eq("school_id", parent.school_id)
        .in("student_id", studentIds)
        .neq("status", "void")
        .order("due_date", { ascending: false });

      const byStudent = new Map<string, ChildRow>();
      for (const st of studentRows) {
        byStudent.set(st.id, { ...st, invoices: [] });
      }
      for (const inv of invoices ?? []) {
        const row = byStudent.get(inv.student_id!);
        if (row) row.invoices.push(inv as ChildInvoice);
      }
      setChildren([...byStudent.values()]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!shouldAttemptPaystackConfirm(paymentReturn)) return;
    void (async () => {
      try {
        const result = await confirmPaystackPayment(paymentReturn.reference!);
        if (result.ok) {
          toast.success("Payment confirmed");
          window.history.replaceState({}, "", window.location.pathname);
          await load();
        } else if (isExplicitPaystackFailure(paymentReturn)) {
          toast.error("Payment was not completed");
        }
      } catch (e) {
        toast.error(formatEdgeFunctionError(e, "paystack"));
      }
    })();
  }, [paymentReturn, load]);

  const payInvoice = async (invoice: ChildInvoice) => {
    setPayingId(invoice.id);
    try {
      const returnUrl = `${window.location.origin}/parent/payments`;
      const checkoutUrl = await initializePaystackCheckout({
        invoice_id: invoice.id,
        callback_url: returnUrl,
      });
      window.location.href = checkoutUrl;
    } catch (e) {
      toast.error(formatEdgeFunctionError(e, "paystack"));
      setPayingId(null);
    }
  };

  const downloadReceipt = async (invoice: ChildInvoice) => {
    if (!schoolId) return;
    const { data: payments } = await supabase
      .from("billing_payments")
      .select("*")
      .eq("invoice_id", invoice.id)
      .eq("status", "paid")
      .order("paid_at", { ascending: false })
      .limit(1);
    const payment = payments?.[0];
    if (!payment) {
      toast.error("No payment found for this invoice");
      return;
    }
    const letterhead = await fetchSchoolLetterhead(schoolId);
    const child = children.find((c) => c.invoices.some((i) => i.id === invoice.id));
    await generateReceipt({
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
      studentName: child?.full_name ?? "Student",
      admissionNumber: "",
      className: child?.class_name ?? "—",
      invoiceNumber: invoice.invoice_number,
      amount: Number(payment.amount),
      currency: invoice.currency,
      method: String(payment.method ?? "online"),
      paidAt: payment.paid_at || payment.created_at,
      paystackReference: payment.gateway_ref,
      paystackTransactionId: (payment as { paystack_transaction_id?: string }).paystack_transaction_id,
    });
    toast.success("Receipt downloaded");
  };

  const balance = (inv: ChildInvoice) =>
    Number(inv.balance_due ?? Math.max(0, Number(inv.total_amount) - Number(inv.amount_paid)));

  return (
    <DashboardLayout role="parent">
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">School fees</h2>
          <p className="text-muted-foreground">View invoices and pay online for your children</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : children.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No linked students or invoices found. Contact the school if this is incorrect.
            </CardContent>
          </Card>
        ) : (
          children.map((child) => (
            <Card key={child.id}>
              <CardHeader>
                <CardTitle>{child.full_name}</CardTitle>
                <CardDescription>Class: {child.class_name}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {child.invoices.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No invoices yet.</p>
                ) : (
                  child.invoices.map((inv) => {
                    const due = balance(inv);
                    const canPay = due > 0 && !["paid", "void"].includes(inv.status);
                    return (
                      <div
                        key={inv.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"
                      >
                        <div>
                          <p className="font-mono text-sm font-semibold">{inv.invoice_number}</p>
                          <p className="text-sm text-muted-foreground">
                            Due {new Date(inv.due_date).toLocaleDateString()} ·{" "}
                            {inv.currency} {Number(inv.total_amount).toLocaleString()}
                          </p>
                          <p className="text-sm font-medium mt-1">
                            Balance: {inv.currency} {due.toLocaleString()}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className={statusVariant[inv.status] ?? ""}>
                            {inv.status.replace(/_/g, " ")}
                          </Badge>
                          {inv.status === "paid" && (
                            <Button size="sm" variant="outline" onClick={() => void downloadReceipt(inv)}>
                              <Download className="h-4 w-4 mr-1" />
                              Receipt
                            </Button>
                          )}
                          {canPay && (
                            <Button
                              size="sm"
                              onClick={() => void payInvoice(inv)}
                              disabled={payingId === inv.id}
                            >
                              {payingId === inv.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <CreditCard className="h-4 w-4 mr-1" />
                                  Pay now
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </DashboardLayout>
  );
}