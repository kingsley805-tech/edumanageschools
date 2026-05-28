// @ts-nocheck
﻿import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useBillingPermissions } from "@/billing/hooks/useBillingPermissions";
import { useBillingAuth } from "@/billing/hooks/useBillingAuth";
import { Search, Download, FileText, Undo2, Loader2, UserRoundPen } from "lucide-react";
import BulkGenerateDialog from "@/billing/components/invoices/BulkGenerateDialog";
import NewInvoiceDialog from "@/billing/components/invoices/NewInvoiceDialog";
import TablePagination from "@/billing/components/TablePagination";
import { usePagination } from "@/billing/hooks/usePagination";
import { exportToCSV, exportToPDF } from "@/billing/lib/exportUtils";
import { toast } from "sonner";
import { InvoicePaymentsDialog } from "@/billing/components/invoices/InvoicePaymentsDialog";
import ConfirmActionButton from "@/billing/components/ConfirmActionButton";
import {
  ReassignInvoiceDialog,
  type ReassignInvoiceTarget,
} from "@/billing/components/invoices/ReassignInvoiceDialog";

type InvoiceStatus = "paid" | "sent" | "draft" | "overdue" | "partially_paid" | "void" | "viewed";

const statusConfig: Record<string, { label: string; className: string }> = {
  paid: { label: "Paid", className: "bg-success/10 text-success border-success/20" },
  sent: { label: "Sent", className: "bg-info/10 text-info border-info/20" },
  draft: { label: "Draft", className: "bg-muted text-muted-foreground border-border" },
  overdue: { label: "Overdue", className: "bg-destructive/10 text-destructive border-destructive/20" },
  partially_paid: { label: "Partial", className: "bg-warning/10 text-warning border-warning/20" },
  viewed: { label: "Viewed", className: "bg-info/10 text-info border-info/20" },
  void: { label: "Void", className: "bg-muted text-muted-foreground border-border" },
};

interface Invoice {
  id: string;
  invoice_number: string;
  total_amount: number;
  amount_paid: number;
  balance_due: number | null;
  status: string;
  due_date: string;
  currency: string;
  student_id: string | null;
  term_id: string | null;
}

function canReverseSentInvoice(invoice: Invoice): boolean {
  const paid = Number(invoice.amount_paid);
  return (invoice.status === "sent" || invoice.status === "viewed") && paid <= 0;
}

function canReassignInvoice(invoice: Invoice): boolean {
  const paid = Number(invoice.amount_paid);
  if (paid > 0) return false;
  return !["paid", "void", "partially_paid"].includes(invoice.status);
}

function toReassignTarget(invoice: Invoice): ReassignInvoiceTarget {
  return {
    id: invoice.id,
    invoice_number: invoice.invoice_number,
    student_id: invoice.student_id,
    term_id: invoice.term_id,
    due_date: invoice.due_date,
    currency: invoice.currency,
  };
}

export default function BillingInvoices() {
  const { isAdmin, isAccountant, schoolId } = useBillingAuth();
  const { getPermission } = useBillingPermissions();
  const permission = getPermission("invoices");
  const canCreateInvoices = permission.create || permission.manage;
  const canUpdateInvoices = permission.update || permission.manage;
  const canManageInvoices = permission.manage;
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [paymentsDialogOpen, setPaymentsDialogOpen] = useState(false);
  const [paymentsDialogInvoice, setPaymentsDialogInvoice] = useState<{ id: string; number: string } | null>(null);
  const [reversingId, setReversingId] = useState<string | null>(null);
  const [bulkReversing, setBulkReversing] = useState(false);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [reassignInvoice, setReassignInvoice] = useState<ReassignInvoiceTarget | null>(null);

  const fetchInvoices = useCallback(async () => {
    if (!schoolId) {
      setInvoices([]);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("billing_invoices")
      .select("id, invoice_number, total_amount, amount_paid, balance_due, status, due_date, currency, student_id, term_id")
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false })
      .limit(500);
    setInvoices(data || []);
    setLoading(false);
  }, [schoolId]);

  useEffect(() => {
    setLoading(true);
    fetchInvoices();
  }, [fetchInvoices]);

  const filtered = invoices.filter((invoice) => {
    const matchesSearch = invoice.invoice_number.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || invoice.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const { page, totalPages, paged, setPage } = usePagination(filtered);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === paged.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paged.map((invoice) => invoice.id)));
    }
  };

  const openReassign = (invoice: Invoice) => {
    setReassignInvoice(toReassignTarget(invoice));
    setReassignOpen(true);
  };

  const reverseSentInvoice = async (invoice: Invoice) => {
    if (!isAdmin) {
      toast.error("Only administrators can reverse sent invoices.");
      return;
    }
    setReversingId(invoice.id);
    try {
      const { data, error } = await supabase.rpc("reverse_billing_sent_invoice" as never, {
        p_invoice_id: invoice.id,
      } as never);
      if (error) throw error;
      const row = data as { invoice_number?: string } | null;
      toast.success(
        row?.invoice_number
          ? `Invoice ${row.invoice_number} reverted to draft`
          : "Invoice reverted to draft",
      );
      await fetchInvoices();
      openReassign({ ...invoice, status: "draft" });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not reverse invoice");
    } finally {
      setReversingId(null);
    }
  };

  const handleBulkReverseToDraft = async () => {
    if (!isAdmin) {
      toast.error("Only administrators can reverse sent invoices.");
      return;
    }
    const eligible = filtered.filter((inv) => selectedIds.has(inv.id) && canReverseSentInvoice(inv));
    if (eligible.length === 0) {
      toast.error("No selected invoices can be reversed (must be sent/viewed with no payments).");
      return;
    }
    setBulkReversing(true);
    let ok = 0;
    let failed = 0;
    for (const inv of eligible) {
      const { error } = await supabase.rpc("reverse_billing_sent_invoice" as never, {
        p_invoice_id: inv.id,
      } as never);
      if (error) failed += 1;
      else ok += 1;
    }
    setBulkReversing(false);
    setSelectedIds(new Set());
    fetchInvoices();
    if (ok > 0) toast.success(`${ok} invoice${ok === 1 ? "" : "s"} reverted to draft`);
    if (failed > 0) toast.error(`${failed} invoice${failed === 1 ? "" : "s"} could not be reversed`);
  };

  const handleBulkStatusChange = async (newStatus: string) => {
    if (!schoolId) return;
    if (!canUpdateInvoices) {
      toast.error("You do not have permission to update invoices.");
      return;
    }
    const ids = Array.from(selectedIds);
    const { error } = await supabase
      .from("billing_invoices")
      .update({ status: newStatus as InvoiceStatus })
      .eq("school_id", schoolId)
      .in("id", ids);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${ids.length} invoices marked as ${newStatus}`);
    setSelectedIds(new Set());
    fetchInvoices();
  };

  const headers = ["Invoice #", "Total", "Paid", "Balance", "Status", "Due Date"];
  const toRow = (invoice: Invoice): string[] => [
    invoice.invoice_number,
    `${invoice.currency} ${Number(invoice.total_amount).toLocaleString()}`,
    `${invoice.currency} ${Number(invoice.amount_paid).toLocaleString()}`,
    `${invoice.currency} ${Number(invoice.balance_due ?? (Number(invoice.total_amount) - Number(invoice.amount_paid))).toLocaleString()}`,
    (statusConfig[invoice.status] || statusConfig.draft).label,
    invoice.due_date,
  ];

  const handleBulkExportCSV = () => {
    const selected = filtered.filter((invoice) => selectedIds.has(invoice.id));
    exportToCSV("invoices-selected", headers, selected.map(toRow));
  };

  const handleBulkExportPDF = () => {
    const selected = filtered.filter((invoice) => selectedIds.has(invoice.id));
    exportToPDF("invoices-selected", "Selected Invoices", headers, selected.map(toRow));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Invoices</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create and manage invoices here. You can send invoices anytime.
          </p>
        </div>
        <div className="flex gap-2">
          {canManageInvoices ? (
            <>
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl border-border/80 bg-card/80 shadow-sm transition-all hover:bg-muted/70"
                onClick={() => exportToCSV("invoices", headers, filtered.map(toRow))}
              >
                <Download className="mr-1 h-4 w-4" />CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl border-border/80 bg-card/80 shadow-sm transition-all hover:bg-muted/70"
                onClick={() => exportToPDF("invoices", "Invoices Report", headers, filtered.map(toRow))}
              >
                <FileText className="mr-1 h-4 w-4" />PDF
              </Button>
            </>
          ) : null}
          {canCreateInvoices ? <BulkGenerateDialog onSuccess={fetchInvoices} /> : null}
          {canCreateInvoices ? <NewInvoiceDialog onSuccess={fetchInvoices} /> : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-[200px] max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search by invoice #..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="All Statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="partially_paid">Partial</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
            <SelectItem value="void">Void</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-2">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          {canManageInvoices ? (
            <>
              <Button variant="outline" size="sm" onClick={handleBulkExportCSV}><Download className="mr-1 h-3.5 w-3.5" />Export CSV</Button>
              <Button variant="outline" size="sm" onClick={handleBulkExportPDF}><FileText className="mr-1 h-3.5 w-3.5" />Export PDF</Button>
            </>
          ) : null}
          {isAdmin ? (
            <Button
              variant="outline"
              size="sm"
              disabled={bulkReversing}
              onClick={() => void handleBulkReverseToDraft()}
            >
              {bulkReversing ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Undo2 className="mr-1 h-3.5 w-3.5" />}
              Revert to draft
            </Button>
          ) : null}
          {canUpdateInvoices ? (
            <Select onValueChange={handleBulkStatusChange}>
              <SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue placeholder="Change status..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sent">Mark as Sent</SelectItem>
                <SelectItem value="paid">Mark as Paid</SelectItem>
                <SelectItem value="overdue">Mark as Overdue</SelectItem>
                <SelectItem value="void">Mark as Void</SelectItem>
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
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Invoice</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Total</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Paid</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Balance</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Due</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-muted-foreground">Loading...</td></tr>
              ) : paged.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-muted-foreground">No invoices found</td></tr>
              ) : paged.map((invoice) => (
                <tr key={invoice.id} className="transition-colors hover:bg-muted/30">
                  <td className="px-4 py-3.5">
                    <Checkbox checked={selectedIds.has(invoice.id)} onCheckedChange={() => toggleSelect(invoice.id)} />
                  </td>
                  <td className="px-4 py-3.5 font-mono text-sm font-medium text-card-foreground">{invoice.invoice_number}</td>
                  <td className="px-4 py-3.5 text-sm">{invoice.currency} {Number(invoice.total_amount).toLocaleString()}</td>
                  <td className="px-4 py-3.5 text-sm text-success">{invoice.currency} {Number(invoice.amount_paid).toLocaleString()}</td>
                  <td className="px-4 py-3.5 text-sm font-medium">{invoice.currency} {Number(invoice.balance_due ?? (Number(invoice.total_amount) - Number(invoice.amount_paid))).toLocaleString()}</td>
                  <td className="px-4 py-3.5">
                    <Badge variant="outline" className={cn("text-xs font-medium", (statusConfig[invoice.status] || statusConfig.draft).className)}>
                      {(statusConfig[invoice.status] || statusConfig.draft).label}
                    </Badge>
                  </td>
                  <td className="px-4 py-3.5 text-sm text-muted-foreground">{invoice.due_date}</td>
                  <td className="px-4 py-3.5 text-right">
                    <div className="flex flex-wrap justify-end gap-1">
                      {schoolId ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8"
                          onClick={() => {
                            setPaymentsDialogInvoice({ id: invoice.id, number: invoice.invoice_number });
                            setPaymentsDialogOpen(true);
                          }}
                        >
                          Payments
                        </Button>
                      ) : null}
                      {isAdmin && canReverseSentInvoice(invoice) ? (
                        <ConfirmActionButton
                          title="Revert invoice to draft?"
                          description={`${invoice.invoice_number} will return to draft and will no longer appear as sent to students or parents. This is only allowed when no payments have been recorded.`}
                          confirmLabel="Revert to draft"
                          onConfirm={() => void reverseSentInvoice(invoice)}
                          trigger={
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8"
                              disabled={reversingId === invoice.id}
                            >
                              {reversingId === invoice.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Undo2 className="mr-1 h-3.5 w-3.5" />
                              )}
                              Reverse
                            </Button>
                          }
                        />
                      ) : null}
                      {isAdmin && canReassignInvoice(invoice) ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8"
                          onClick={() => openReassign(invoice)}
                        >
                          <UserRoundPen className="mr-1 h-3.5 w-3.5" />
                          Reassign
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading ? <TablePagination page={page} totalPages={totalPages} setPage={setPage} totalItems={filtered.length} /> : null}
      </div>

      {schoolId && reassignInvoice ? (
        <ReassignInvoiceDialog
          schoolId={schoolId}
          invoice={reassignInvoice}
          open={reassignOpen}
          onOpenChange={(open) => {
            setReassignOpen(open);
            if (!open) setReassignInvoice(null);
          }}
          onSuccess={fetchInvoices}
        />
      ) : null}

      {schoolId && paymentsDialogInvoice ? (
        <InvoicePaymentsDialog
          schoolId={schoolId}
          invoiceId={paymentsDialogInvoice.id}
          invoiceNumber={paymentsDialogInvoice.number}
          open={paymentsDialogOpen}
          onOpenChange={(open) => {
            setPaymentsDialogOpen(open);
            if (!open) setPaymentsDialogInvoice(null);
          }}
        />
      ) : null}
    </div>
  );
};