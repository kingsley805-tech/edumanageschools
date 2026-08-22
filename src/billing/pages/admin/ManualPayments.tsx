// @ts-nocheck
import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/currency";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Banknote, Download, Eye, Search, Upload, Plus } from "lucide-react";
import { PosPaymentRowActions, PosPaymentWhatsAppBadge } from "@/billing/components/payments/PosPaymentRowActions";
import { PaymentDetailsDialog, type PaymentDetailsPayload } from "@/billing/components/payments/PaymentDetailsDialog";
import { TruncatedMonoText } from "@/billing/components/payments/TruncatedMonoText";
import TablePagination from "@/billing/components/TablePagination";
import { usePagination } from "@/billing/hooks/usePagination";
import { ExportMenu } from "@/modules/lib/ExportMenu";
import { downloadCsv } from "@/modules/lib/exportTable";
import { parseCsvLine } from "@/billing/lib/parseCsvLine";
import { toast } from "sonner";
import { useBillingPermissions } from "@/billing/hooks/useBillingPermissions";
import { useBillingAuth } from "@/billing/hooks/useBillingAuth";
import { usePaymentTransactions } from "@/billing/hooks/usePaymentTransactions";
import type { PaymentTransactionRow } from "@/billing/lib/paymentTransactions";
import {
  BillingFeePageShell,
} from "@/billing/components/BillingFeePageShell";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";

type PayStatus = "paid" | "pending" | "failed" | "processing" | "refunded" | "disputed";

const statusMap: Record<string, { label: string; className: string }> = {
  paid: { label: "Recorded", className: "bg-success/10 text-success border-success/20" },
  pending: { label: "Pending", className: "bg-warning/10 text-warning border-warning/20" },
  processing: { label: "Processing", className: "bg-info/10 text-info border-info/20" },
  failed: { label: "Failed", className: "bg-destructive/10 text-destructive border-destructive/20" },
  refunded: { label: "Refunded", className: "bg-muted text-muted-foreground border-border" },
  disputed: { label: "Disputed", className: "bg-destructive/10 text-destructive border-destructive/20" },
};

interface ManualPayment extends PaymentTransactionRow {
  payer_name: string | null;
  payer_role: string | null;
  payment_context: string;
  notes: string | null;
}

const INVOICE_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ALLOWED_PAYMENT_METHODS = new Set([
  "cash",
  "bank_transfer",
  "mobile_money",
  "card",
  "ussd",
  "pos_terminal",
]);

function normalizeCsvMethod(raw: string): string | null {
  const m = raw.trim().toLowerCase().replace(/\s+/g, "_");
  if (m === "momo") return "mobile_money";
  if (m === "pos" || m === "pos_terminal" || m === "card_terminal") return "pos_terminal";
  if (ALLOWED_PAYMENT_METHODS.has(m)) return m;
  return null;
}

function isValidMoneyAmount(n: number): boolean {
  if (!Number.isFinite(n) || n <= 0) return false;
  const cents = Math.round(n * 100);
  return Math.abs(n * 100 - cents) < 1e-6;
}

interface CsvImportError {
  row: number;
  message: string;
}

export default function BillingManualPayments() {
  const { user } = useAuth();
  const { schoolId } = useBillingAuth();
  const { getPermission } = useBillingPermissions();
  const permission = getPermission("manual_payments");
  const canCreatePayments = permission.create || permission.manage;
  const canManagePayments = permission.manage;

  const scope = useMemo(
    () => (schoolId ? { mode: "school" as const, schoolId } : null),
    [schoolId],
  );

  const {
    rows: allPayments,
    loading,
    error: paymentsLoadError,
    refetch: fetchPayments,
  } = usePaymentTransactions(scope);

  const payments = useMemo(
    () => allPayments.filter((p) => p.gateway === "manual") as ManualPayment[],
    [allPayments],
  );

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importingCsv, setImportingCsv] = useState(false);
  const [csvImportDialogOpen, setCsvImportDialogOpen] = useState(false);
  const [csvImportErrors, setCsvImportErrors] = useState<CsvImportError[]>([]);
  const [csvImportSummary, setCsvImportSummary] = useState<{ inserted: number; skipped: number } | null>(
    null,
  );
  const [search, setSearch] = useState("");
  const [methodFilter, setMethodFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [detailPayment, setDetailPayment] = useState<PaymentDetailsPayload | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const updateInvoiceSummary = async (invoiceId: string) => {
    if (!schoolId) return;
    const { data: inv } = await supabase
      .from("billing_invoices")
      .select("total_amount")
      .eq("id", invoiceId)
      .eq("school_id", schoolId)
      .maybeSingle();
    if (!inv) return;
    const { data: allPaid } = await supabase
      .from("billing_payments")
      .select("amount")
      .eq("invoice_id", invoiceId)
      .eq("school_id", schoolId)
      .eq("status", "paid");
    const amountPaid = (allPaid || []).reduce((sum, p) => sum + Number(p.amount), 0);
    const totalAmount = Number(inv.total_amount);
    const balance = totalAmount - amountPaid;
    await supabase
      .from("billing_invoices")
      .update({
        amount_paid: amountPaid,
        balance_due: Math.max(0, balance),
        status: balance <= 0 ? "paid" : amountPaid > 0 ? "partially_paid" : "sent",
        paid_at: balance <= 0 ? new Date().toISOString() : null,
      })
      .eq("school_id", schoolId)
      .eq("id", invoiceId);
  };

  const handleCsvImport = async (file: File) => {
    if (!canCreatePayments) {
      toast.error("You do not have permission to import payments.");
      return;
    }
    setImportingCsv(true);
    setCsvImportErrors([]);
    setCsvImportSummary(null);
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((line) => line.length > 0);
      if (lines.length < 2) throw new Error("CSV must include a header row and at least one data row.");

      const headers = parseCsvLine(lines[0].replace(/^\ufeff/, "")).map((h) => h.toLowerCase());
      const required = ["invoice_id", "amount", "method"] as const;
      const idx = {
        invoice_id: headers.indexOf("invoice_id"),
        amount: headers.indexOf("amount"),
        method: headers.indexOf("method"),
        reference: headers.indexOf("reference"),
        notes: headers.indexOf("notes"),
        paid_at: headers.indexOf("paid_at"),
      };
      for (const key of required) {
        if (headers.indexOf(key) < 0) {
          throw new Error(
            `Missing required column "${key}". Use the template: invoice_id, amount, method, plus optional reference, notes, paid_at.`,
          );
        }
      }

      const { data: profile } = await supabase.from("profiles").select("school_id").eq("id", user!.id).maybeSingle();
      if (!profile?.school_id) throw new Error("Organization not found");

      const errors: CsvImportError[] = [];
      type ParsedRow = {
        rowNum: number;
        invoiceId: string;
        amount: number;
        method: "cash" | "bank_transfer" | "mobile_money" | "card" | "ussd" | "pos_terminal";
        gatewayRef: string | null;
        notes: string | null;
        paidAt: string | null;
      };
      const parsed: ParsedRow[] = [];
      const seenRefs = new Set<string>();

      for (let i = 1; i < lines.length; i++) {
        const rowNum = i + 1;
        const line = lines[i];
        if (!line.trim()) continue;
        const cols = parseCsvLine(line);
        const invoiceId = (cols[idx.invoice_id] || "").trim();
        const amountRaw = (cols[idx.amount] || "").trim();
        const methodRaw = (cols[idx.method] || "").trim();

        if (!invoiceId) {
          errors.push({ row: rowNum, message: "invoice_id is empty." });
          continue;
        }
        if (!INVOICE_UUID_RE.test(invoiceId)) {
          errors.push({ row: rowNum, message: "invoice_id must be a valid UUID." });
          continue;
        }

        const amount = Number(amountRaw.replace(/,/g, ""));
        if (!isValidMoneyAmount(amount)) {
          errors.push({ row: rowNum, message: "amount must be a positive number with at most two decimal places." });
          continue;
        }

        const normalized = normalizeCsvMethod(methodRaw);
        if (!normalized) {
          errors.push({
            row: rowNum,
            message: `method "${methodRaw}" is invalid. Use: cash, bank_transfer, mobile_money, momo, card, ussd, pos_terminal.`,
          });
          continue;
        }

        let gatewayRef: string | null = idx.reference >= 0 ? (cols[idx.reference]?.trim() || null) : null;
        if (gatewayRef) {
          if (seenRefs.has(gatewayRef)) {
            errors.push({ row: rowNum, message: `duplicate reference "${gatewayRef}" in this file.` });
            continue;
          }
          seenRefs.add(gatewayRef);
        }

        const notes = idx.notes >= 0 ? (cols[idx.notes]?.trim() || null) : null;
        let paidAt: string | null = null;
        if (idx.paid_at >= 0 && cols[idx.paid_at]?.trim()) {
          const d = new Date(cols[idx.paid_at].trim());
          if (Number.isNaN(d.getTime())) {
            errors.push({ row: rowNum, message: "paid_at is not a valid date." });
            continue;
          }
          paidAt = d.toISOString();
        }

        parsed.push({
          rowNum,
          invoiceId,
          amount,
          method: normalized as ParsedRow["method"],
          gatewayRef,
          notes,
          paidAt,
        });
      }

      const invoiceIds = [...new Set(parsed.map((p) => p.invoiceId))];
      const invoiceMap = new Map<
        string,
        { total_amount: number; amount_paid: number; balance_due: number | null; status: string }
      >();

      if (invoiceIds.length > 0) {
        const { data: invs, error: invErr } = await supabase
          .from("billing_invoices")
          .select("id, total_amount, amount_paid, balance_due, status")
          .in("id", invoiceIds)
          .eq("school_id", profile.school_id);
        if (invErr) throw invErr;
        for (const inv of invs || []) {
          invoiceMap.set(inv.id, {
            total_amount: Number(inv.total_amount),
            amount_paid: Number(inv.amount_paid),
            balance_due: inv.balance_due != null ? Number(inv.balance_due) : null,
            status: inv.status,
          });
        }
      }

      const getOutstanding = (inv: { total_amount: number; amount_paid: number; balance_due: number | null }) =>
        inv.balance_due != null ? Math.max(0, inv.balance_due) : Math.max(0, inv.total_amount - inv.amount_paid);

      let inserted = 0;
      for (const row of parsed) {
        const inv = invoiceMap.get(row.invoiceId);
        if (!inv) {
          errors.push({ row: row.rowNum, message: "Invoice not found in your school or access denied." });
          continue;
        }
        if (inv.status === "void") {
          errors.push({ row: row.rowNum, message: "Invoice is void; cannot record payment." });
          continue;
        }
        const balance = getOutstanding(inv);
        if (balance <= 0) {
          errors.push({ row: row.rowNum, message: "Invoice has no outstanding balance." });
          continue;
        }
        if (row.amount > balance + 0.005) {
          errors.push({
            row: row.rowNum,
            message: `Amount ${row.amount} exceeds remaining balance ${balance.toFixed(2)}.`,
          });
          continue;
        }

        const { error } = await supabase.from("billing_payments").insert({
          school_id: profile.school_id,
          invoice_id: row.invoiceId,
          amount: row.amount,
          method: row.method,
          gateway: "manual",
          status: "paid",
          gateway_ref: row.gatewayRef,
          notes: row.notes,
          paid_at: row.paidAt || new Date().toISOString(),
          recorded_by: user!.id,
          metadata: { source: "csv_import", csv_row: row.rowNum },
        });

        if (error) {
          errors.push({ row: row.rowNum, message: error.message || "Insert failed." });
          continue;
        }
        await updateInvoiceSummary(row.invoiceId);
        inv.amount_paid += row.amount;
        inv.balance_due = Math.max(0, inv.total_amount - inv.amount_paid);
        inserted += 1;
      }

      setCsvImportErrors(errors);
      setCsvImportSummary({ inserted, skipped: errors.length });
      if (errors.length > 0) setCsvImportDialogOpen(true);
      toast.success(
        `CSV import finished: ${inserted} recorded${errors.length > 0 ? `, ${errors.length} row(s) skipped` : ""}.`,
      );
      fetchPayments();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "CSV import failed");
    } finally {
      setImportingCsv(false);
    }
  };

  const downloadCsvTemplate = () => {
    const a = document.createElement("a");
    a.href = `${window.location.origin}/manual-payments-import-template.csv`;
    a.download = "manual-payments-import-template.csv";
    a.rel = "noopener";
    a.click();
  };

  const downloadImportErrorReport = () => {
    downloadCsv(
      "manual-payment-import-errors",
      ["Row", "Message"],
      csvImportErrors.map((e) => [String(e.row), e.message]),
    );
  };

  const filtered = payments.filter((payment) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      (payment.notes || "").toLowerCase().includes(q) ||
      payment.invoice_id.toLowerCase().includes(q) ||
      (payment.invoice_number || "").toLowerCase().includes(q) ||
      String(payment.amount).includes(search) ||
      (payment.gateway_ref || "").toLowerCase().includes(q) ||
      (payment.payer_name || "").toLowerCase().includes(q) ||
      (payment.student_name || "").toLowerCase().includes(q);
    const matchesStatus = statusFilter === "all" || payment.status === statusFilter;
    const matchesMethod = methodFilter === "all" || payment.method === methodFilter;
    const dateRaw = payment.paid_at || payment.created_at;
    let matchesDate = true;
    if (dateFrom && dateRaw) matchesDate = new Date(dateRaw) >= new Date(dateFrom);
    if (matchesDate && dateTo && dateRaw) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      matchesDate = new Date(dateRaw) <= end;
    }
    return matchesSearch && matchesStatus && matchesMethod && matchesDate;
  });

  const stats = useMemo(() => {
    const paid = filtered.filter((p) => p.status === "paid");
    const total = paid.reduce((s, p) => s + Number(p.amount), 0);
    const currency = paid[0]?.currency ?? "GHS";
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonth = paid.filter((p) => {
      const d = p.paid_at || p.created_at;
      return d && new Date(d) >= monthStart;
    }).reduce((s, p) => s + Number(p.amount), 0);
    return { total, count: paid.length, currency, thisMonth, listed: filtered.length };
  }, [filtered]);

  const { page, totalPages, paged, setPage } = usePagination(filtered);

  const headers = ["Amount", "Method", "Student", "Invoice", "Reference", "Paid By", "Status", "Notes", "Date"];
  const toRow = (payment: ManualPayment): string[] => [
    formatMoney(Number(payment.amount), payment.currency),
    payment.method.replace("_", " "),
    payment.student_name || "—",
    payment.invoice_number || payment.invoice_id,
    payment.gateway_ref || "—",
    payment.payer_name || "—",
    (statusMap[payment.status] || statusMap.pending).label,
    payment.notes || "",
    payment.paid_at ? new Date(payment.paid_at).toLocaleDateString() : new Date(payment.created_at).toLocaleDateString(),
  ];
  const allRows = filtered.map(toRow);

  if (!schoolId) {
    return (
      <BillingFeePageShell
        title="Manual Payments"
        description="Record cash, bank transfer, mobile money, and POS payments against student invoices."
      >
        <div style={{ textAlign: "center", paddingTop: 80, color: "hsl(var(--muted-foreground))", fontSize: 14 }}>
          Please set up your organization first in Settings.
        </div>
      </BillingFeePageShell>
    );
  }

  return (
    <BillingFeePageShell
      title="Manual Payments"
      description="Record cash, bank transfer, mobile money, and POS payments against student invoices."
      actions={
        <>
          {canManagePayments ? (
            <ExportMenu filename="manual-payments" title="Manual Payments" headers={headers} rows={allRows} />
          ) : null}
          {canCreatePayments ? (
            <>
              <button type="button" className="fee-btn-outline" onClick={downloadCsvTemplate}>
                <Download size={14} />
                Template
              </button>
              <button
                type="button"
                className="fee-btn-outline"
                disabled={importingCsv}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={14} />
                {importingCsv ? "Importing…" : "Import CSV"}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleCsvImport(file);
                  e.target.value = "";
                }}
              />
            </>
          ) : null}
          {canCreatePayments ? (
            <Link to="/admin/billing/pos-terminal" className="fee-btn-primary" style={{ textDecoration: "none" }}>
              <Plus size={14} />
              Record Payment
            </Link>
          ) : null}
        </>
      }
    >
      {paymentsLoadError ? (
        <p className="mb-4 text-sm text-destructive">{paymentsLoadError}</p>
      ) : null}

      <div
        className="fee-grid-2"
        style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 20 }}
      >
        {[
          {
            label: "Total collected",
            value: formatMoney(stats.total, stats.currency, { maximumFractionDigits: 0 }),
            sub: "Successful manual payments (filtered)",
          },
          {
            label: "This month",
            value: formatMoney(stats.thisMonth, stats.currency, { maximumFractionDigits: 0 }),
            sub: `${stats.count} recorded payment(s)`,
          },
          {
            label: "Transactions",
            value: String(stats.listed),
            sub: "Matching current filters",
          },
        ].map((stat) => (
          <div key={stat.label} className="fee-card p-5">
            <p className="fee-stat-label">{stat.label}</p>
            <p className="fee-stat-value">{stat.value}</p>
            <p className="fee-stat-sub">{stat.sub}</p>
          </div>
        ))}
      </div>

      <div className="fee-card p-6" style={{ marginBottom: 20 }}>
            <div className="section-title">
              <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span className="section-icon">
                  <Search size={15} color="hsl(var(--primary))" />
                </span>
                Search &amp; filters
              </span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              <div style={{ position: "relative", flex: "1 1 220px", minWidth: 200 }}>
                <Search
                  size={16}
                  style={{
                    position: "absolute",
                    left: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "hsl(var(--muted-foreground))",
                  }}
                />
                <Input
                  className="fee-input pl-9"
                  placeholder="Search student, invoice, reference, notes…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select value={methodFilter} onValueChange={setMethodFilter}>
                <SelectTrigger className="fee-input w-[170px]">
                  <SelectValue placeholder="All methods" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All methods</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                  <SelectItem value="mobile_money">Mobile money</SelectItem>
                  <SelectItem value="pos_terminal">POS terminal</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="ussd">USSD</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="fee-input w-[150px]">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="paid">Recorded</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="refunded">Refunded</SelectItem>
                </SelectContent>
              </Select>
              <Input type="date" className="fee-input w-[150px]" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              <Input type="date" className="fee-input w-[150px]" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </div>

          <div className="fee-card p-6">
            <div className="section-title">
              <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span className="section-icon">
                  <Banknote size={15} color="hsl(var(--primary))" />
                </span>
                Payment records
              </span>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1.5px solid hsl(var(--border))" }}>
                    {["Student", "Receipt", "Amount", "Method", "Invoice", "Reference", "Paid by", "WhatsApp", "Status", "Date", ""].map(
                      (h) => (
                        <th
                          key={h || "actions"}
                          style={{
                            padding: "10px 12px",
                            textAlign: h ? "left" : "right",
                            fontSize: 11,
                            fontWeight: 700,
                            letterSpacing: ".06em",
                            textTransform: "uppercase",
                            color: "hsl(var(--muted-foreground))",
                          }}
                        >
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={11}>
                        <p className="fee-loading">Loading payments…</p>
                      </td>
                    </tr>
                  ) : paged.length === 0 ? (
                    <tr>
                      <td colSpan={11}>
                        <div className="fee-empty">No manual payments match your filters.</div>
                      </td>
                    </tr>
                  ) : (
                    paged.map((payment) => (
                      <tr
                        key={payment.id}
                        style={{ borderBottom: "1px solid hsl(var(--border) / 0.7)" }}
                      >
                        <td style={{ padding: "12px", fontSize: 13.5 }}>
                          {payment.student_id ? (
                            <Link
                              to={`/admin/students/${payment.student_id}`}
                              style={{ fontWeight: 600, color: "hsl(var(--foreground))", textDecoration: "none" }}
                            >
                              {payment.student_name || "Student"}
                            </Link>
                          ) : (
                            payment.student_name || "—"
                          )}
                        </td>
                        <td style={{ padding: "12px", fontSize: 12, fontFamily: "monospace" }}>
                          {payment.receipt_number || "—"}
                        </td>
                        <td style={{ padding: "12px" }}>
                          <span className="amount-chip">
                            {formatMoney(Number(payment.amount), payment.currency)}
                          </span>
                        </td>
                        <td style={{ padding: "12px", fontSize: 13, textTransform: "capitalize", color: "hsl(var(--muted-foreground))" }}>
                          {payment.method.replace("_", " ")}
                        </td>
                        <td style={{ padding: "12px", fontSize: 12 }}>
                          {payment.invoice_id ? (
                            <Link
                              to={`/admin/billing/invoices/${payment.invoice_id}`}
                              style={{ fontWeight: 600, color: "hsl(var(--primary))", textDecoration: "none" }}
                            >
                              {payment.invoice_number || payment.invoice_id.slice(0, 8)}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td style={{ padding: "12px" }}>
                          <TruncatedMonoText value={payment.gateway_ref} emptyLabel="—" />
                        </td>
                        <td style={{ padding: "12px", fontSize: 13, color: "hsl(var(--muted-foreground))" }}>
                          {payment.payer_name || "—"}
                        </td>
                        <td style={{ padding: "12px" }}>
                          <PosPaymentWhatsAppBadge status={payment.whatsapp_status} />
                        </td>
                        <td style={{ padding: "12px" }}>
                          <Badge
                            variant="outline"
                            className={cn("text-xs font-medium", (statusMap[payment.status] || statusMap.pending).className)}
                          >
                            {(statusMap[payment.status] || statusMap.pending).label}
                          </Badge>
                        </td>
                        <td style={{ padding: "12px", fontSize: 13, color: "hsl(var(--muted-foreground))" }}>
                          {payment.paid_at
                            ? new Date(payment.paid_at).toLocaleDateString()
                            : new Date(payment.created_at).toLocaleDateString()}
                        </td>
                        <td style={{ padding: "12px", textAlign: "right" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4 }}>
                            <PosPaymentRowActions payment={payment} schoolId={schoolId!} onRefresh={fetchPayments} />
                            <button
                            type="button"
                            className="fee-btn-outline"
                            style={{ padding: "6px 10px" }}
                            onClick={() => {
                              setDetailPayment({
                                id: payment.id,
                                amount: payment.amount,
                                method: payment.method,
                                status: payment.status,
                                paid_at: payment.paid_at,
                                created_at: payment.created_at,
                                currency: payment.currency,
                                gateway: payment.gateway,
                                gateway_ref: payment.gateway_ref,
                                paystack_transaction_id: null,
                                invoice_id: payment.invoice_id,
                                invoice_number: payment.invoice_number,
                                payer_name: payment.payer_name,
                                payer_role: payment.payer_role,
                                payment_context: payment.payment_context,
                                notes: payment.notes,
                              });
                              setDetailOpen(true);
                            }}
                          >
                            <Eye size={14} />
                            View
                          </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {!loading ? (
              <div style={{ marginTop: 16 }}>
                <TablePagination page={page} totalPages={totalPages} setPage={setPage} totalItems={filtered.length} />
              </div>
            ) : null}
          </div>

      <Dialog open={csvImportDialogOpen} onOpenChange={setCsvImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>CSV import results</DialogTitle>
          </DialogHeader>
          {csvImportSummary ? (
            <p className="text-sm text-muted-foreground">
              {csvImportSummary.inserted} payment(s) recorded
              {csvImportSummary.skipped > 0 ? ` · ${csvImportSummary.skipped} row(s) skipped` : ""}.
            </p>
          ) : null}
          {csvImportErrors.length > 0 ? (
            <ScrollArea className="max-h-64 rounded-md border p-3">
              <ul className="space-y-2 text-sm">
                {csvImportErrors.map((e) => (
                  <li key={`${e.row}-${e.message}`}>
                    <span className="font-medium">Row {e.row}:</span> {e.message}
                  </li>
                ))}
              </ul>
            </ScrollArea>
          ) : null}
          <DialogFooter>
            {csvImportErrors.length > 0 ? (
              <Button variant="outline" onClick={downloadImportErrorReport}>
                Download error report
              </Button>
            ) : null}
            <Button onClick={() => setCsvImportDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PaymentDetailsDialog
        payment={detailPayment}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        canRefund={canManagePayments}
        canDelete={canManagePayments}
        onRefund={async (p) => {
          const notes = window.prompt("Refund notes (optional)") ?? "";
          const { data, error } = await supabase.rpc("refund_billing_payment", {
            p_payment_id: p.id,
            p_notes: notes || null,
          });
          if (error) {
            toast.error(error.message);
            return;
          }
          const res = data as { ok?: boolean; error?: string };
          if (res?.ok) {
            toast.success("Payment refunded");
            setDetailOpen(false);
            fetchPayments();
          } else {
            toast.error(res?.error ?? "Refund failed");
          }
        }}
        onDelete={async (p) => {
          if (!window.confirm("Delete this payment record? Invoice totals will be recalculated.")) return;
          const { data, error } = await supabase.rpc("delete_billing_payment", { p_payment_id: p.id });
          if (error) {
            toast.error(error.message);
            return;
          }
          const res = data as { ok?: boolean; error?: string };
          if (res?.ok) {
            toast.success("Payment deleted");
            setDetailOpen(false);
            fetchPayments();
          } else {
            toast.error(res?.error ?? "Delete failed");
          }
        }}
      />
    </BillingFeePageShell>
  );
}
