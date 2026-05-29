// @ts-nocheck
import { useCallback, useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CreditCard, Download, DollarSign, FileText, TrendingUp, AlertCircle } from "lucide-react";
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

type StudentInvoice = {
  id: string;
  invoice_number: string;
  total_amount: number;
  amount_paid: number;
  balance_due: number | null;
  status: string;
  due_date: string;
  currency: string;
};

const statusClass: Record<string, string> = {
  paid: "bg-emerald-500/10 text-emerald-700",
  sent: "bg-blue-500/10 text-blue-700",
  partially_paid: "bg-amber-500/10 text-amber-800",
  overdue: "bg-red-500/10 text-red-700",
};

export default function StudentBilling() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [studentName, setStudentName] = useState("");
  const [className, setClassName] = useState("");
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<StudentInvoice[]>([]);
  const [payingId, setPayingId] = useState<string | null>(null);

  const paymentReturn = useMemo(() => parsePaystackReturnSearch(window.location.search), []);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: student } = await supabase
        .from("students")
        .select("id, full_name, admission_number, class_id, school_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!student) {
        setInvoices([]);
        return;
      }

      setStudentName(student.full_name ?? "Student");
      setSchoolId(student.school_id);

      if (student.class_id) {
        const { data: cls } = await supabase
          .from("classes")
          .select("name")
          .eq("id", student.class_id)
          .maybeSingle();
        setClassName(cls?.name ?? "—");
      }

      const { data: invs } = await supabase
        .from("billing_invoices")
        .select(
          "id, invoice_number, total_amount, amount_paid, balance_due, status, due_date, currency",
        )
        .eq("student_id", student.id)
        .neq("status", "void")
        .order("created_at", { ascending: false });

      setInvoices((invs as StudentInvoice[]) ?? []);
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

  const balance = (inv: StudentInvoice) =>
    Number(inv.balance_due ?? Math.max(0, Number(inv.total_amount) - Number(inv.amount_paid)));

  const totalBilled = invoices.reduce((s, i) => s + Number(i.total_amount), 0);
  const totalPaid = invoices.reduce((s, i) => s + Number(i.amount_paid), 0);
  const outstanding = invoices.reduce((s, i) => s + balance(i), 0);
  const currency = invoices[0]?.currency ?? "GHS";

  const payInvoice = async (invoice: StudentInvoice) => {
    setPayingId(invoice.id);
    try {
      const returnUrl = `${window.location.origin}/student/billing`;
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

  const downloadReceipt = async (invoice: StudentInvoice) => {
    if (!schoolId) return;
    const { data: payment } = await supabase
      .from("billing_payments")
      .select("*")
      .eq("invoice_id", invoice.id)
      .eq("status", "paid")
      .order("paid_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!payment) {
      toast.error("No payment found");
      return;
    }
    const letterhead = await fetchSchoolLetterhead(schoolId);
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
      studentName,
      admissionNumber: "",
      className,
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

  return (
    <DashboardLayout role="student">
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">My fees</h2>
          <p className="text-muted-foreground">
            {studentName} · {className}
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <DollarSign className="h-4 w-4" /> Total billed
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-bold">
                  {currency} {totalBilled.toLocaleString()}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" /> Paid
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-bold text-emerald-700">
                  {currency} {totalPaid.toLocaleString()}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" /> Outstanding
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-bold text-amber-700">
                  {currency} {outstanding.toLocaleString()}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <FileText className="h-4 w-4" /> Invoices
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-bold">{invoices.length}</CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>My invoices</CardTitle>
                <CardDescription>Pay online or download receipts for completed payments</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {invoices.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">No invoices yet.</p>
                ) : (
                  invoices.map((inv) => {
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
                            Due {new Date(inv.due_date).toLocaleDateString()}
                          </p>
                          <p className="text-sm font-medium mt-1">
                            Balance: {inv.currency} {due.toLocaleString()}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className={statusClass[inv.status] ?? ""}>
                            {inv.status.replace(/_/g, " ")}
                          </Badge>
                          {inv.status === "paid" && (
                            <Button size="sm" variant="outline" onClick={() => void downloadReceipt(inv)}>
                              <Download className="h-4 w-4 mr-1" />
                              Receipt
                            </Button>
                          )}
                          {canPay && (
                            <Button size="sm" onClick={() => void payInvoice(inv)} disabled={payingId === inv.id}>
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
          </>
        )}
      </div>
    </DashboardLayout>
  );
}