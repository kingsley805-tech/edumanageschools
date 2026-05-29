import type { ClassRegister, RegisterAlert, RegisterCompletionItem } from "@/register/lib/types";

export function buildRegisterAlerts(registers: ClassRegister[], totalClasses: number): RegisterAlert[] {
  const alerts: RegisterAlert[] = [];
  const pending = registers.filter((r) => r.status === "submitted").length;
  const drafts = registers.filter((r) => r.status === "draft").length;
  const rejected = registers.filter((r) => r.status === "rejected");

  if (drafts > 0) {
    alerts.push({
      id: "drafts",
      severity: "warning",
      title: `${drafts} register(s) not yet submitted`,
      description: "Registers must be submitted before the 10:00 AM deadline.",
    });
  }
  if (pending > 0) {
    alerts.push({
      id: "pending",
      severity: "info",
      title: `${pending} awaiting admin approval`,
      description: "Review and approve submitted registers in the approval queue.",
    });
  }
  for (const r of rejected.slice(0, 2)) {
    alerts.push({
      id: r.id,
      severity: "error",
      title: `Register rejected — ${r.classes?.name ?? "Class"}`,
      description: r.admin_feedback ?? "Incorrect or incomplete entry. Please correct and resubmit.",
    });
  }
  if (alerts.length === 0 && totalClasses > 0) {
    alerts.push({
      id: "ok",
      severity: "info",
      title: "All clear",
      description: "No urgent register alerts for today.",
    });
  }
  return alerts;
}

export function buildCompletionGrid(registers: ClassRegister[]): RegisterCompletionItem[] {
  return registers.map((r) => {
    const label = `${r.subjects?.name ?? "Subject"} — ${r.classes?.name ?? "Class"}`;
    const percent =
      r.status === "approved" ? 100 : r.status === "submitted" ? 75 : r.status === "rejected" ? 40 : r.status === "draft" ? 25 : 0;
    return { registerId: r.id, label, status: r.status, percent };
  });
}

export function termAttendanceSummary(registers: ClassRegister[], entriesCount: { present: number; absent: number; late: number }) {
  const total = entriesCount.present + entriesCount.absent + entriesCount.late;
  const percent = total ? Math.round((entriesCount.present / total) * 100) : 0;
  return { percent, total, ...entriesCount, registerCount: registers.length };
}
