import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { EntityProfilePageLayout } from "@/components/entities/EntityProfilePageLayout";
import DashboardLayout from "@/components/DashboardLayout";
import { formatMoney } from "@/lib/currency";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { InvoicePaymentsDialog } from "@/billing/components/invoices/InvoicePaymentsDialog";
import { generateReceipt } from "@/billing/lib/generateReceipt";
import { Download, CreditCard, RefreshCw, FileText } from "lucide-react";

export default function InvoiceProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [invoice, setInvoice] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [school, setSchool] = useState<any>(null);
  const [paymentsDialogOpen, setPaymentsDialogOpen] = useState(false);
  const [generatingReceipt, setGeneratingReceipt] = useState(false);

  useEffect(() => {
    if (id) {
      void loadInvoice(id);
    }
  }, [id]);

  const loadInvoice = async (invoiceId: string) => {
    try {
      setLoading(true);
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(invoiceId);

      // 1. Fetch invoice
      let query = supabase.from("billing_invoices").select(`
        *,
        students:student_id(
          id,
          full_name,
          admission_number,
          admission_no,
          class_id,
          classes:class_id(id, name, level),
          profiles:user_id(full_name, email, phone)
        )
      `);

      if (isUuid) {
        query = query.eq("id", invoiceId);
      } else {
        query = query.eq("invoice_number", invoiceId);
      }

      const { data, error } = await query.maybeSingle();

      let invData: any = data;

      if (error || !invData) {
        // Fallback bare query
        let bare = supabase.from("billing_invoices").select("*");
        if (isUuid) bare = bare.eq("id", invoiceId);
        else bare = bare.eq("invoice_number", invoiceId);

        const { data: bareData, error: bareError } = await bare.maybeSingle();
        if (bareError) throw bareError;

        if (bareData) {
          invData = { ...bareData };
          if (bareData.student_id) {
            const { data: st } = await supabase
              .from("students")
              .select("id, full_name, admission_number, admission_no, class_id, classes(name, level), profiles(full_name, email, phone)")
              .eq("id", bareData.student_id)
              .maybeSingle();
            if (st) invData.students = st;
          }
        }
      }

      setInvoice(invData || null);

      if (invData) {
        // 2. Fetch line items
        const { data: itemRows } = await supabase
          .from("billing_invoice_items")
          .select("*")
          .eq("invoice_id", invData.id);
        setItems(itemRows || []);

        // 3. Fetch payments
        const { data: payRows } = await supabase
          .from("billing_payments")
          .select("*")
          .eq("invoice_id", invData.id)
          .order("created_at", { ascending: false });
        setPayments(payRows || []);

        // 4. Fetch school info
        if (invData.school_id) {
          const { data: sc } = await supabase
            .from("schools")
            .select("*")
            .eq("id", invData.school_id)
            .maybeSingle();
          if (sc) setSchool(sc);
        }
      }
    } catch (err: any) {
      console.error("Failed to load invoice:", err);
      toast({
        title: "Error",
        description: err.message || "Failed to load invoice details",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadReceipt = async () => {
    if (!invoice) return;
    try {
      setGeneratingReceipt(true);
      const studentName =
        invoice.students?.profiles?.full_name ||
        invoice.students?.full_name ||
        "Student";
      const studentAdmissionNo =
        invoice.students?.admission_number ||
        invoice.students?.admission_no ||
        "—";
      const studentClass = invoice.students?.classes?.name || "—";

      await generateReceipt({
        receiptNumber: `REC-${invoice.invoice_number || invoice.id.slice(0, 8)}`,
        invoiceNumber: invoice.invoice_number || invoice.id.slice(0, 8),
        paymentDate: invoice.updated_at || invoice.created_at,
        amount: Number(invoice.amount_paid || invoice.total_amount),
        currency: invoice.currency || "GHS",
        paymentMethod: payments[0]?.method || "System",
        paymentReference: payments[0]?.gateway_ref || payments[0]?.id || "—",
        studentName,
        studentAdmissionNo,
        studentClass,
        schoolName: school?.school_name || "EduManage School",
        schoolAddress: school?.address || "",
        schoolPhone: school?.phone || "",
        schoolEmail: school?.email || "",
        schoolLogo: school?.logo_url || "",
        items: items.map((item) => ({
          description: item.description || "Fee item",
          amount: Number(item.amount),
          quantity: item.quantity || 1,
        })),
        notes: invoice.notes || "Official receipt of invoice payment.",
      });
      toast({
        title: "Receipt Generated",
        description: "PDF receipt has been created.",
      });
    } catch (err: any) {
      toast({
        title: "Receipt Error",
        description: err.message || "Could not generate PDF receipt.",
        variant: "destructive",
      });
    } finally {
      setGeneratingReceipt(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout role="admin">
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <RefreshCw className="animate-spin text-3xl text-primary mb-3" />
          <p className="text-sm font-medium text-muted-foreground">Loading invoice details...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!invoice) {
    return (
      <DashboardLayout role="admin">
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center max-w-md mx-auto">
          <div className="size-16 rounded-2xl bg-muted flex items-center justify-center mb-4 text-muted-foreground">
            <FileText className="size-8 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Invoice Not Found</h2>
          <p className="text-sm text-muted-foreground mt-2">
            The requested invoice record could not be found or may have been removed.
          </p>
          <div className="flex items-center gap-3 mt-6">
            <Link to="/admin/billing/invoices" className="kt-btn kt-btn-primary kt-btn-sm">
              Return to Invoices List
            </Link>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const invoiceNumber = invoice.invoice_number || `#INV-${invoice.id.slice(0, 8)}`;
  const totalAmount = Number(invoice.total_amount || 0);
  const amountPaid = Number(invoice.amount_paid || 0);
  const balanceDue = Number(invoice.balance_due ?? (totalAmount - amountPaid));
  const currency = invoice.currency || "GHS";
  const student = invoice.students;
  const studentName = student?.profiles?.full_name || student?.full_name || "Unassigned";
  const className = student?.classes?.name
    ? `${student.classes.name}${student.classes.level ? ` (${student.classes.level})` : ""}`
    : "Not assigned";

  const statusVariant =
    invoice.status === "paid"
      ? "success"
      : invoice.status === "partially_paid" || invoice.status === "sent"
        ? "warning"
        : invoice.status === "overdue"
          ? "destructive"
          : "secondary";

  const statusLabel =
    invoice.status === "paid"
      ? "Paid"
      : invoice.status === "partially_paid"
        ? "Partially Paid"
        : invoice.status === "sent"
          ? "Sent"
          : invoice.status === "overdue"
            ? "Overdue"
            : invoice.status === "draft"
              ? "Draft"
              : invoice.status || "Pending";

  return (
    <>
      <EntityProfilePageLayout
        role="admin"
        backLink={{ to: "/admin/billing/invoices", label: "Back to Invoices" }}
        entityType="Invoice"
        entityCode={`#${invoiceNumber}`}
        name={invoiceNumber}
        statusText={statusLabel}
        statusVariant={statusVariant}
        metaItems={[
          {
            icon: "ki-barcode",
            text: invoiceNumber,
          },
          {
            icon: "ki-user",
            text: student ? (
              <Link
                to={`/admin/students/${student.id}`}
                className="hover:underline hover:text-primary"
              >
                {studentName}
              </Link>
            ) : (
              studentName
            ),
          },
          {
            icon: "ki-calendar",
            text: `Due: ${invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : "—"}`,
          },
          {
            icon: "ki-wallet",
            text: `Total: ${formatMoney(totalAmount, currency)}`,
          },
        ]}
        rightMetric={{
          label: "Balance Due",
          value: formatMoney(balanceDue, currency),
        }}
        generalInfo={[
          {
            label: "Invoice Number",
            value: <span className="font-mono font-bold text-foreground">{invoiceNumber}</span>,
          },
          {
            label: "Student",
            value: student ? (
              <Link
                to={`/admin/students/${student.id}`}
                className="text-primary font-semibold hover:underline"
              >
                {studentName} ({student.admission_number || student.admission_no || "No ID"})
              </Link>
            ) : (
              "Unassigned"
            ),
          },
          {
            label: "Class",
            value: className,
          },
          {
            label: "Issue Date",
            value: new Date(invoice.created_at).toLocaleDateString(),
          },
          {
            label: "Due Date",
            value: invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : "—",
          },
          {
            label: "Total Amount",
            value: <span className="font-mono font-semibold text-foreground">{formatMoney(totalAmount, currency)}</span>,
          },
          {
            label: "Amount Paid",
            value: <span className="font-mono text-success font-semibold">{formatMoney(amountPaid, currency)}</span>,
          },
          {
            label: "Balance Due",
            value: <span className="font-mono text-destructive font-semibold">{formatMoney(balanceDue, currency)}</span>,
          },
          {
            label: "Status",
            value: <Badge variant={statusVariant}>{statusLabel}</Badge>,
          },
          {
            label: "Currency",
            value: currency,
          },
          {
            label: "Notes",
            value: invoice.notes || "No special notes recorded.",
          },
        ]}
        summaryStats={[
          {
            label: "Total Billed",
            value: formatMoney(totalAmount, currency),
            subtext: "Invoice total",
            icon: "wallet",
            tag: "Billed",
            tagVariant: "info",
          },
          {
            label: "Total Paid",
            value: formatMoney(amountPaid, currency),
            subtext: "Recorded payments",
            icon: "check-circle",
            tag: "Paid",
            tagVariant: "success",
          },
          {
            label: "Balance Due",
            value: formatMoney(balanceDue, currency),
            subtext: "Outstanding balance",
            icon: "time",
            tag: balanceDue > 0 ? "Pending" : "Cleared",
            tagVariant: balanceDue > 0 ? "warning" : "success",
          },
          {
            label: "Line Items",
            value: items.length.toString(),
            subtext: "Fee components",
            icon: "document",
            tag: "Items",
            tagVariant: "info",
          },
        ]}
        customTabs={[
          {
            id: "items",
            label: "Line Items",
            content: (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-foreground">Invoice Fee Breakdown</h4>
                  <span className="text-xs text-muted-foreground">{items.length} item(s)</span>
                </div>
                <div className="overflow-x-auto rounded-xl border border-border bg-card">
                  <Table className="min-w-full">
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead className="font-semibold text-xs">Description</TableHead>
                        <TableHead className="font-semibold text-xs text-center">Qty</TableHead>
                        <TableHead className="font-semibold text-xs text-right">Unit Price</TableHead>
                        <TableHead className="font-semibold text-xs text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="py-6 text-center text-xs text-muted-foreground">
                            No individual fee items listed on this invoice.
                          </TableCell>
                        </TableRow>
                      ) : (
                        items.map((it, idx) => (
                          <TableRow key={it.id || idx}>
                            <TableCell className="text-xs font-medium text-foreground">{it.description || "Tuition / Fee"}</TableCell>
                            <TableCell className="text-xs font-mono text-center">{it.quantity || 1}</TableCell>
                            <TableCell className="text-xs font-mono text-right">{formatMoney(Number(it.amount), currency)}</TableCell>
                            <TableCell className="text-xs font-mono font-semibold text-right">{formatMoney(Number(it.amount) * (it.quantity || 1), currency)}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ),
          },
          {
            id: "payments",
            label: "Payment History",
            content: (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-foreground">Recorded Payments</h4>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1.5 text-xs"
                    onClick={() => setPaymentsDialogOpen(true)}
                  >
                    <CreditCard className="h-3.5 w-3.5" />
                    Record Payment
                  </Button>
                </div>
                <div className="overflow-x-auto rounded-xl border border-border bg-card">
                  <Table className="min-w-full">
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead className="font-semibold text-xs">Date</TableHead>
                        <TableHead className="font-semibold text-xs">Method</TableHead>
                        <TableHead className="font-semibold text-xs">Reference</TableHead>
                        <TableHead className="font-semibold text-xs text-right">Amount</TableHead>
                        <TableHead className="font-semibold text-xs text-center">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="py-6 text-center text-xs text-muted-foreground">
                            No payment transactions recorded for this invoice yet.
                          </TableCell>
                        </TableRow>
                      ) : (
                        payments.map((p) => (
                          <TableRow key={p.id}>
                            <TableCell className="text-xs text-muted-foreground">
                              {p.paid_at ? new Date(p.paid_at).toLocaleDateString() : new Date(p.created_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="text-xs capitalize">{p.method?.replace("_", " ") || "Manual"}</TableCell>
                            <TableCell className="text-xs font-mono text-muted-foreground">{p.gateway_ref || p.id.slice(0, 8)}</TableCell>
                            <TableCell className="text-xs font-mono font-semibold text-success text-right">{formatMoney(Number(p.amount), currency)}</TableCell>
                            <TableCell className="text-xs text-center">
                              <Badge variant={p.status === "paid" ? "success" : "secondary"}>
                                {p.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ),
          },
        ]}
      >
        <div className="flex flex-wrap items-center justify-end gap-2.5 pb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadReceipt}
            disabled={generatingReceipt}
            className="gap-2"
          >
            {generatingReceipt ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Download PDF Receipt
          </Button>
          <Button
            size="sm"
            className="gap-2"
            onClick={() => setPaymentsDialogOpen(true)}
          >
            <CreditCard className="h-4 w-4" />
            Manage Payments
          </Button>
        </div>
      </EntityProfilePageLayout>

      {paymentsDialogOpen && (
        <InvoicePaymentsDialog
          open={paymentsDialogOpen}
          onOpenChange={(open) => {
            setPaymentsDialogOpen(open);
            if (!open && id) void loadInvoice(id);
          }}
          invoiceId={invoice.id}
          invoiceNumber={invoiceNumber}
        />
      )}
    </>
  );
}
