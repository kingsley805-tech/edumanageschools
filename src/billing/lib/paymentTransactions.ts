export type PaymentTransactionStatus =
  | "paid"
  | "pending"
  | "processing"
  | "failed"
  | "refunded"
  | "disputed";

export type PaymentTransactionRow = {
  id: string;
  school_id?: string;
  invoice_id: string;
  invoice_number: string | null;
  student_id?: string | null;
  student_name?: string | null;
  parent_id?: string | null;
  parent_name?: string | null;
  child_name?: string | null;
  amount: number;
  currency: string;
  method: string;
  gateway: string;
  gateway_ref: string | null;
  paystack_transaction_id?: string | null;
  transaction_id?: string | null;
  status: PaymentTransactionStatus | string;
  payer_name: string | null;
  payer_role: string | null;
  paid_by?: string | null;
  notes: string | null;
  paid_at: string | null;
  created_at: string;
  payment_context?: string;
};

export const PAYMENT_STATUS_BADGE: Record<
  string,
  { label: string; className: string }
> = {
  paid: { label: "Successful", className: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" },
  pending: { label: "Pending", className: "bg-amber-500/10 text-amber-800 border-amber-500/20" },
  processing: { label: "Processing", className: "bg-blue-500/10 text-blue-700 border-blue-500/20" },
  failed: { label: "Failed", className: "bg-red-500/10 text-red-700 border-red-500/20" },
  refunded: { label: "Refunded", className: "bg-muted text-muted-foreground border-border" },
  disputed: { label: "Disputed", className: "bg-red-500/10 text-red-700 border-red-500/20" },
};

export function formatPaymentMethod(method: string): string {
  return method.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatGateway(gateway: string): string {
  const g = gateway.toLowerCase();
  if (g === "paystack") return "Paystack";
  if (g === "stripe") return "Stripe";
  if (g === "flutterwave") return "Flutterwave";
  if (g === "manual") return "Manual";
  return gateway;
}

export function formatPaidBy(row: PaymentTransactionRow): string {
  if (row.paid_by?.trim()) return row.paid_by.trim();
  if (row.payer_name?.trim()) {
    return row.payer_role
      ? `${row.payer_name} (${row.payer_role.replace(/_/g, " ")})`
      : row.payer_name;
  }
  if (row.payer_role) return row.payer_role.replace(/_/g, " ");
  return "—";
}

export function paymentDisplayDate(row: PaymentTransactionRow): string {
  const raw = row.paid_at || row.created_at;
  if (!raw) return "—";
  return new Date(raw).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function txnId(row: PaymentTransactionRow): string {
  return (
    row.paystack_transaction_id ||
    row.transaction_id ||
    "—"
  );
}

export type PaymentTransactionFilters = {
  search?: string;
  status?: string;
  gateway?: string;
  method?: string;
  studentId?: string;
  dateFrom?: string;
  dateTo?: string;
};

export function filterPaymentTransactions(
  rows: PaymentTransactionRow[],
  filters: PaymentTransactionFilters,
): PaymentTransactionRow[] {
  const q = (filters.search ?? "").trim().toLowerCase();
  return rows.filter((row) => {
    if (filters.status && filters.status !== "all" && row.status !== filters.status) return false;
    if (filters.gateway && filters.gateway !== "all" && row.gateway !== filters.gateway) return false;
    if (filters.method && filters.method !== "all" && row.method !== filters.method) return false;
    if (filters.studentId && filters.studentId !== "all" && row.student_id !== filters.studentId) return false;

    const dateRaw = row.paid_at || row.created_at;
    if (filters.dateFrom && dateRaw) {
      if (new Date(dateRaw) < new Date(filters.dateFrom)) return false;
    }
    if (filters.dateTo && dateRaw) {
      const end = new Date(filters.dateTo);
      end.setHours(23, 59, 59, 999);
      if (new Date(dateRaw) > end) return false;
    }

    if (!q) return true;
    return (
      String(row.amount).includes(q) ||
      (row.invoice_number ?? "").toLowerCase().includes(q) ||
      (row.gateway_ref ?? "").toLowerCase().includes(q) ||
      txnId(row).toLowerCase().includes(q) ||
      (row.student_name ?? "").toLowerCase().includes(q) ||
      (row.parent_name ?? "").toLowerCase().includes(q) ||
      (row.child_name ?? "").toLowerCase().includes(q) ||
      (row.payer_name ?? "").toLowerCase().includes(q) ||
      (row.notes ?? "").toLowerCase().includes(q)
    );
  });
}

export function paymentRevenueStats(rows: PaymentTransactionRow[]) {
  const successful = rows.filter((r) => r.status === "paid");
  const total = successful.reduce((s, r) => s + Number(r.amount), 0);
  const currency = successful[0]?.currency ?? "GHS";
  const last30 = successful.filter((r) => {
    const d = new Date(r.paid_at || r.created_at);
    return Date.now() - d.getTime() < 30 * 24 * 60 * 60 * 1000;
  });
  const last30Total = last30.reduce((s, r) => s + Number(r.amount), 0);
  return {
    totalRevenue: total,
    successfulCount: successful.length,
    last30Revenue: last30Total,
    last30Count: last30.length,
    currency,
  };
}
