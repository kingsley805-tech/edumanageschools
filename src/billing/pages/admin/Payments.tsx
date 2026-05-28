// @ts-nocheck
﻿import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Search, Download, FileText, Upload, RefreshCcw, RotateCw, Eye } from "lucide-react";
import RecordPaymentDialog from "@/billing/components/payments/RecordPaymentDialog";
import PaySalaryDialog from "@/billing/components/payments/PaySalaryDialog";
import { PaymentDetailsDialog, type PaymentDetailsPayload } from "@/billing/components/payments/PaymentDetailsDialog";
import TablePagination from "@/billing/components/TablePagination";
import { usePagination } from "@/billing/hooks/usePagination";
import { exportToCSV, exportToPDF } from "@/billing/lib/exportUtils";
import { parseCsvLine } from "@/billing/lib/parseCsvLine";
import { toast } from "sonner";
import { useBillingPermissions } from "@/billing/hooks/useBillingPermissions";
import { useBillingAuth } from "@/billing/hooks/useBillingAuth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

type PayStatus = "paid" | "pending" | "failed" | "processing" | "refunded" | "disputed";
const statusMap: Record<string, { label: string; className: string }> = {
  paid: { label: "Successful", className: "bg-success/10 text-success border-success/20" },
  pending: { label: "Pending", className: "bg-warning/10 text-warning border-warning/20" },
  processing: { label: "Processing", className: "bg-info/10 text-info border-info/20" },
  failed: { label: "Failed", className: "bg-destructive/10 text-destructive border-destructive/20" },
  refunded: { label: "Refunded", className: "bg-muted text-muted-foreground border-border" },
  disputed: { label: "Disputed", className: "bg-destructive/10 text-destructive border-destructive/20" },
};

interface Payment {
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
}

interface WebhookEvent {
  id: string;
  event_type: string;
  reference: string | null;
  status: string;
  attempts: number;
  last_error: string | null;
  next_retry_at: string | null;
  created_at: string;
}

const INVOICE_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ALLOWED_PAYMENT_METHODS = new Set([
  "cash",
  "bank_transfer",
  "mobile_money",
  "card",
  "ussd",
]);

function normalizeCsvMethod(raw: string): string | null {
  const m = raw.trim().toLowerCase().replace(/\s+/g, "_");
  if (m === "momo") return "mobile_money";
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

export default function BillingPayments() {
  const { user } = useAuth();
  const { schoolId } = useBillingAuth();
  const { getPermission } = useBillingPermissions();
  const permission = getPermission("payments");
  const canCreatePayments = permission.create || permission.manage;
  const canUpdatePayments = permission.update || permission.manage;
  const canManagePayments = permission.manage;
  const [payments, setPayments] = useState<Payment[]>([]);
  const [webhookEvents, setWebhookEvents] = useState<WebhookEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [importingCsv, setImportingCsv] = useState(false);
  const [runningWebhookRetry, setRunningWebhookRetry] = useState(false);
  const [runningTransferRecon, setRunningTransferRecon] = useState(false);
  const [csvImportDialogOpen, setCsvImportDialogOpen] = useState(false);
  const [csvImportErrors, setCsvImportErrors] = useState<CsvImportError[]>([]);
  const [csvImportSummary, setCsvImportSummary] = useState<{ inserted: number; skipped: number } | null>(null);
  const [search, setSearch] = useState("");
  const [refFilter, setRefFilter] = useState("");
  const [txnFilter, setTxnFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [methodFilter, setMethodFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailPayment, setDetailPayment] = useState<PaymentDetailsPayload | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const fetchPayments = async () => {
    if (!schoolId) {
      setPayments([]);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("billing_payments")
      .select(
        "id, amount, method, status, paid_at, created_at, currency, gateway, gateway_ref, paystack_transaction_id, invoice_id, payer_name, payer_role, payment_context, notes, invoices ( invoice_number )",
      )
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false })
      .limit(500);
    const raw = (data || []) as unknown as (Payment & { invoices?: { invoice_number: string } | null })[];
    setPayments(
      raw.map((row) => {
        const inv = row.invoices;
        const { invoices: _i, ...rest } = row;
        return {
          ...rest,
          invoice_number: inv?.invoice_number ?? null,
        };
      }),
    );
    setLoading(false);
  };

  const fetchWebhookEvents = async () => {
    if (!schoolId) {
      setWebhookEvents([]);
      return;
    }
    const { data } = await supabase
      .from("paystack_webhook_events")
      .select("id, event_type, reference, status, attempts, last_error, next_retry_at, created_at")
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false })
      .limit(50);
    setWebhookEvents((data || []) as WebhookEvent[]);
  };

  useEffect(() => {
    setLoading(true);
    fetchPayments();
    fetchWebhookEvents();
    const channel = supabase
      .channel(`admin-payments-${schoolId || "no-org"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "billing_payments" }, () => fetchPayments())
      .on("postgres_changes", { event: "*", schema: "public", table: "paystack_webhook_events" }, () => fetchWebhookEvents())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [schoolId]);

  const updateInvoiceSummary = async (invoiceId: string) => {
    if (!schoolId) return;
    const { data: inv } = await supabase
      .from("billing_invoices")
      .select("total_amount")
      .eq("id", invoiceId)
      .eq("school_id", schoolId)
      .maybeSingle();
    if (!inv) return;
    const { data: allPayments } = await supabase
      .from("billing_payments")
      .select("amount")
      .eq("invoice_id", invoiceId)
      .eq("school_id", schoolId)
      .eq("status", "paid");
    const amountPaid = (allPayments || []).reduce((sum, p) => sum + Number(p.amount), 0);
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
            `Missing required column "${key}". Use the template: invoice_id, amount, method, plus optional reference, notes, paid_at.`
          );
        }
      }
      if (new Set(headers).size !== headers.length) {
        throw new Error("Duplicate column names in the header row.");
      }

      const { data: profile } = await supabase.from("profiles").select("school_id").eq("id", user!.id).maybeSingle();
      if (!profile?.school_id) throw new Error("Organization not found");

      const errors: CsvImportError[] = [];
      type ParsedRow = {
        rowNum: number;
        invoiceId: string;
        amount: number;
        method: "cash" | "bank_transfer" | "mobile_money" | "card" | "ussd";
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
        if (cols.length < 3) {
          errors.push({ row: rowNum, message: "Not enough columns (expected at least invoice_id, amount, method)." });
          continue;
        }

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
          errors.push({
            row: rowNum,
            message: "amount must be a positive number with at most two decimal places.",
          });
          continue;
        }

        const normalized = normalizeCsvMethod(methodRaw);
        if (!normalized) {
          errors.push({
            row: rowNum,
            message: `method "${methodRaw}" is invalid. Use: cash, bank_transfer, mobile_money, momo, card, ussd.`,
          });
          continue;
        }

        let gatewayRef: string | null =
          idx.reference >= 0 ? (cols[idx.reference]?.trim() || null) : null;
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
        {
          id: string;
          school_id: string;
          total_amount: number;
          amount_paid: number;
          balance_due: number | null;
          status: string;
        }
      >();

      if (invoiceIds.length > 0) {
        const { data: invs, error: invErr } = await supabase
          .from("billing_invoices")
          .select("id, school_id, total_amount, amount_paid, balance_due, status")
          .in("id", invoiceIds)
          .eq("school_id", profile.school_id);

        if (invErr) throw invErr;
        for (const inv of invs || []) {
          invoiceMap.set(inv.id, {
            id: inv.id,
            school_id: inv.school_id,
            total_amount: Number(inv.total_amount),
            amount_paid: Number(inv.amount_paid),
            balance_due: inv.balance_due != null ? Number(inv.balance_due) : null,
            status: inv.status,
          });
        }
      }

      const getOutstanding = (inv: {
        total_amount: number;
        amount_paid: number;
        balance_due: number | null;
      }) =>
        inv.balance_due != null
          ? Math.max(0, inv.balance_due)
          : Math.max(0, inv.total_amount - inv.amount_paid);

      const actorMeta = {
        actor_user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
        actor_platform: typeof navigator !== "undefined" ? navigator.platform : null,
        actor_language: typeof navigator !== "undefined" ? navigator.language : null,
      };

      let inserted = 0;
      for (const row of parsed) {
        const inv = invoiceMap.get(row.invoiceId);
        if (!inv) {
          errors.push({
            row: row.rowNum,
            message: "Invoice not found in your school or access denied.",
          });
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
          metadata: {
            source: "csv_import",
            csv_row: row.rowNum,
            ...actorMeta,
          },
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

      const skipped = errors.length;
      setCsvImportErrors(errors);
      setCsvImportSummary({ inserted, skipped });
      if (errors.length > 0) setCsvImportDialogOpen(true);

      toast.success(
        `CSV import finished: ${inserted} recorded${errors.length > 0 ? `, ${errors.length} row(s) skipped` : ""}.`
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
    exportToCSV(
      "manual-payment-import-errors",
      ["Row", "Message"],
      csvImportErrors.map((e) => [String(e.row), e.message])
    );
  };

  const callAdminEdge = async (path: "retry-webhooks" | "reconcile-transfers") => {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session?.access_token) throw new Error("Please sign in again.");
    const { data, error } = await supabase.functions.invoke("paystack", {
      body: { action: path },
    });
    if (error) throw new Error(error.message || "Action failed");
    return data;
  };

  const handleRetryWebhooks = async () => {
    if (!canManagePayments) {
      toast.error("You do not have permission to manage payment webhooks.");
      return;
    }
    setRunningWebhookRetry(true);
    try {
      const data = await callAdminEdge("retry-webhooks");
      toast.success(`Webhook retry complete: ${data.processed ?? 0} processed, ${data.failed ?? 0} failed`);
      fetchWebhookEvents();
      fetchPayments();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Retry failed");
    } finally {
      setRunningWebhookRetry(false);
    }
  };

  const handleReconcileTransfers = async () => {
    if (!canManagePayments) {
      toast.error("You do not have permission to reconcile transfers.");
      return;
    }
    setRunningTransferRecon(true);
    try {
      const data = await callAdminEdge("reconcile-transfers");
      toast.success(`Transfer reconciliation: ${data.updated ?? 0} updated, ${data.failed ?? 0} failed`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Reconciliation failed");
    } finally {
      setRunningTransferRecon(false);
    }
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
      (payment.paystack_transaction_id || "").toLowerCase().includes(q) ||
      (payment.payer_name || "").toLowerCase().includes(q);
    const refQ = refFilter.trim().toLowerCase();
    const matchesRef =
      !refQ || (payment.gateway_ref || "").toLowerCase().includes(refQ);
    const txnQ = txnFilter.trim().toLowerCase();
    const matchesTxn =
      !txnQ || (payment.paystack_transaction_id || "").toLowerCase().includes(txnQ);
    const matchesStatus = statusFilter === "all" || payment.status === statusFilter;
    const matchesMethod = methodFilter === "all" || payment.method === methodFilter;
    return matchesSearch && matchesRef && matchesTxn && matchesStatus && matchesMethod;
  });

  const { page, totalPages, paged, setPage } = usePagination(filtered);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === paged.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paged.map((payment) => payment.id)));
    }
  };

  const handleBulkStatusChange = async (newStatus: string) => {
    if (!schoolId) return;
    if (!canUpdatePayments) {
      toast.error("You do not have permission to update payments.");
      return;
    }
    const ids = Array.from(selectedIds);
    const { error } = await supabase
      .from("billing_payments")
      .update({ status: newStatus as PayStatus })
      .eq("school_id", schoolId)
      .in("id", ids);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${ids.length} payments updated to ${newStatus}`);
    setSelectedIds(new Set());
    fetchPayments();
  };

  const headers = [
    "Amount",
    "Method",
    "Gateway",
    "Paid By",
    "Invoice",
    "Reference",
    "Transaction ID",
    "Status",
    "Notes",
    "Date",
  ];
  const toRow = (payment: Payment): string[] => [
    `${payment.currency} ${Number(payment.amount).toLocaleString()}`,
    payment.method.replace("_", " "),
    payment.gateway,
    payment.payer_name || (payment.payer_role ? payment.payer_role.replace("_", " ") : "--"),
    payment.invoice_number || payment.invoice_id,
    payment.gateway_ref || "--",
    payment.paystack_transaction_id || "--",
    (statusMap[payment.status] || statusMap.pending).label,
    payment.notes || "",
    payment.paid_at ? new Date(payment.paid_at).toLocaleDateString() : new Date(payment.created_at).toLocaleDateString(),
  ];

  const handleBulkExportCSV = () => {
    const selected = filtered.filter((payment) => selectedIds.has(payment.id));
    exportToCSV("payments-selected", headers, selected.map(toRow));
  };

  const handleBulkExportPDF = () => {
    const selected = filtered.filter((payment) => selectedIds.has(payment.id));
    exportToPDF("payments-selected", "Selected Payments", headers, selected.map(toRow));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Payments</h1>
          <p className="mt-1 text-sm text-muted-foreground">Track all fee payments received</p>
        </div>
        <div className="flex gap-2">
          {canManagePayments ? (
            <>
              <Button variant="outline" size="sm" onClick={() => exportToCSV("payments", headers, filtered.map(toRow))}><Download className="h-4 w-4 mr-1" />CSV</Button>
              <Button variant="outline" size="sm" onClick={() => exportToPDF("payments", "Payments Report", headers, filtered.map(toRow))}><FileText className="h-4 w-4 mr-1" />PDF</Button>
            </>
          ) : null}
          {canCreatePayments ? <RecordPaymentDialog onSuccess={fetchPayments} /> : null}
          {canCreatePayments ? <PaySalaryDialog /> : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-[200px] max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search amount, notes, payer, invoice #, ref, txn ID…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Input
          placeholder="Filter by reference"
          className="w-[160px]"
          value={refFilter}
          onChange={(e) => setRefFilter(e.target.value)}
        />
        <Input
          placeholder="Filter by txn ID"
          className="w-[160px]"
          value={txnFilter}
          onChange={(e) => setTxnFilter(e.target.value)}
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="All Statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="paid">Successful</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="refunded">Refunded</SelectItem>
          </SelectContent>
        </Select>
        <Select value={methodFilter} onValueChange={setMethodFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="All Methods" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Methods</SelectItem>
            <SelectItem value="cash">Cash</SelectItem>
            <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
            <SelectItem value="mobile_money">Mobile Money</SelectItem>
            <SelectItem value="card">Card</SelectItem>
            <SelectItem value="ussd">USSD</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-2">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          {canManagePayments ? (
            <>
              <Button variant="outline" size="sm" onClick={handleBulkExportCSV}><Download className="mr-1 h-3.5 w-3.5" />Export CSV</Button>
              <Button variant="outline" size="sm" onClick={handleBulkExportPDF}><FileText className="mr-1 h-3.5 w-3.5" />Export PDF</Button>
            </>
          ) : null}
          {canUpdatePayments ? (
            <Select onValueChange={handleBulkStatusChange}>
              <SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue placeholder="Change status..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="paid">Mark as Paid</SelectItem>
                <SelectItem value="pending">Mark as Pending</SelectItem>
                <SelectItem value="failed">Mark as Failed</SelectItem>
                <SelectItem value="refunded">Mark as Refunded</SelectItem>
              </SelectContent>
            </Select>
          ) : null}
          <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>Clear</Button>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="w-10 px-4 py-3">
                  <Checkbox checked={paged.length > 0 && selectedIds.size === paged.length} onCheckedChange={toggleSelectAll} />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Method</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Gateway</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Paid By</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Invoice</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Reference</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Txn ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Notes</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Date</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr><td colSpan={12} className="px-4 py-8 text-center text-sm text-muted-foreground">Loading...</td></tr>
              ) : paged.length === 0 ? (
                <tr><td colSpan={12} className="px-4 py-8 text-center text-sm text-muted-foreground">No payments match your filters</td></tr>
              ) : paged.map((payment) => (
                <tr key={payment.id} className="transition-colors hover:bg-muted/30">
                  <td className="px-4 py-3.5">
                    <Checkbox checked={selectedIds.has(payment.id)} onCheckedChange={() => toggleSelect(payment.id)} />
                  </td>
                  <td className="px-4 py-3.5 text-sm font-medium text-card-foreground">{payment.currency} {Number(payment.amount).toLocaleString()}</td>
                  <td className="px-4 py-3.5 text-sm capitalize text-muted-foreground">{payment.method.replace("_", " ")}</td>
                  <td className="px-4 py-3.5 text-sm capitalize text-muted-foreground">{payment.gateway}</td>
                  <td className="px-4 py-3.5 text-sm text-muted-foreground">{payment.payer_name || (payment.payer_role ? payment.payer_role.replace("_", " ") : "--")}</td>
                  <td className="max-w-[120px] truncate px-4 py-3.5 font-mono text-xs text-muted-foreground">{payment.invoice_number || payment.invoice_id.slice(0, 8)}</td>
                  <td className="max-w-[140px] truncate px-4 py-3.5 font-mono text-xs text-muted-foreground">{payment.gateway_ref || "--"}</td>
                  <td className="max-w-[120px] truncate px-4 py-3.5 font-mono text-xs text-muted-foreground">{payment.paystack_transaction_id || "--"}</td>
                  <td className="px-4 py-3.5">
                    <Badge variant="outline" className={cn("text-xs font-medium", (statusMap[payment.status] || statusMap.pending).className)}>
                      {(statusMap[payment.status] || statusMap.pending).label}
                    </Badge>
                  </td>
                  <td className="max-w-[200px] truncate px-4 py-3.5 text-sm text-muted-foreground">{payment.notes || "-"}</td>
                  <td className="px-4 py-3.5 text-sm text-muted-foreground">
                    {payment.paid_at ? new Date(payment.paid_at).toLocaleDateString() : new Date(payment.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1"
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
                          paystack_transaction_id: payment.paystack_transaction_id,
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
                      <Eye className="h-4 w-4" />
                      <span className="sr-only sm:not-sr-only sm:inline">View</span>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading ? <TablePagination page={page} totalPages={totalPages} setPage={setPage} totalItems={filtered.length} /> : null}
      </div>

      <PaymentDetailsDialog payment={detailPayment} open={detailOpen} onOpenChange={setDetailOpen} />
    </div>
  );
};