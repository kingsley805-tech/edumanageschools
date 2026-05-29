/** Parent/student-facing invoice status — internal "sent" is shown as Pending. */

export type PortalInvoiceStatusBadge = {
  label: string;
  className: string;
};

const PENDING_STYLE = "bg-amber-500/10 text-amber-800 border-amber-500/20";

const PORTAL_INVOICE_STATUS: Record<string, PortalInvoiceStatusBadge> = {
  paid: { label: "Paid", className: "bg-emerald-500/10 text-emerald-700" },
  pending: { label: "Pending", className: PENDING_STYLE },
  sent: { label: "Pending", className: PENDING_STYLE },
  viewed: { label: "Pending", className: PENDING_STYLE },
  draft: { label: "Pending", className: PENDING_STYLE },
  partially_paid: { label: "Partially paid", className: "bg-amber-500/10 text-amber-800" },
  overdue: { label: "Overdue", className: "bg-red-500/10 text-red-700" },
  void: { label: "Cancelled", className: "bg-muted text-muted-foreground" },
};

export function getPortalInvoiceStatusBadge(status: string): PortalInvoiceStatusBadge {
  const key = (status ?? "").toLowerCase().trim();
  if (PORTAL_INVOICE_STATUS[key]) return PORTAL_INVOICE_STATUS[key];
  const label = key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return { label: label || "Pending", className: PENDING_STYLE };
}

/** Statuses visible on parent/student billing (exclude draft/void). */
export const PORTAL_VISIBLE_INVOICE_STATUSES = [
  "sent",
  "viewed",
  "partially_paid",
  "overdue",
  "paid",
] as const;

export function canPayPortalInvoice(status: string, balanceDue: number): boolean {
  return balanceDue > 0 && !["paid", "void", "draft"].includes(status.toLowerCase());
}
