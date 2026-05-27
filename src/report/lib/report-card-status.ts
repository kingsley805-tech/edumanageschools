export type ReportCardStatus =
  | "draft"
  | "pending_review"
  | "reviewed"
  | "approved"
  | "rejected"
  | "saved"
  | "published";

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  pending_review: "Pending Review",
  reviewed: "Reviewed",
  approved: "Approved",
  rejected: "Rejected",
  saved: "Pending Review",
  published: "Approved",
};

export function statusLabel(status: string) {
  return STATUS_LABELS[status] ?? status.replace(/_/g, " ");
}

export function statusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  const map: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    draft: "secondary",
    pending_review: "outline",
    reviewed: "default",
    approved: "default",
    rejected: "destructive",
    saved: "outline",
    published: "default",
  };
  return map[status] ?? "secondary";
}

export const EXPORTABLE_STATUSES = [
  "pending_review",
  "reviewed",
  "approved",
  "rejected",
  "saved",
  "published",
] as const;

export function canExportPdf(status: string) {
  return (EXPORTABLE_STATUSES as readonly string[]).includes(status);
}

/** Teachers may edit their class reports at any workflow stage. */
export function canTeacherEdit(_status: string) {
  return true;
}

/** Statuses where the report opens in edit mode without clicking "Edit report". */
export function teacherReportEditByDefault(status: string) {
  return status === "draft" || status === "rejected" || status === "saved";
}

export function canAdminEdit(status: string) {
  return status !== "approved" && status !== "published";
}

export function isVisibleToFamily(status: string) {
  return status === "approved" || status === "published";
}

export function isPendingAdminAction(status: string) {
  return status === "pending_review" || status === "saved";
}
