import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export function downloadPayrollCsv(headers: string[], rows: (string | number)[][], filename: string) {
  const esc = (v: string | number) => {
    const s = String(v ?? "");
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [headers.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadPayrollPdf(
  title: string,
  headers: string[],
  body: (string | number)[][],
  filename: string,
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  doc.setFontSize(14);
  doc.text(title, 40, 40);
  autoTable(doc, {
    head: [headers],
    body,
    startY: 55,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [22, 101, 90] },
  });
  doc.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}

/** One-line summary for exports and tables (does not expose full account numbers). */
export function payoutSummaryFromSnapshot(payout_snapshot: unknown, methodFallback: string): string {
  const snap = payout_snapshot as Record<string, unknown> | null | undefined;
  if (!snap || typeof snap !== "object") return methodFallback;
  const sel = typeof snap.selected_method === "string" && snap.selected_method ? snap.selected_method : methodFallback;
  const parts: string[] = [sel];
  const other = typeof snap.other_label === "string" ? snap.other_label.trim() : "";
  if (other) parts.push(other);
  const bank = typeof snap.bank_name === "string" ? snap.bank_name.trim() : "";
  const acct = typeof snap.account_number === "string" ? snap.account_number.replace(/\D/g, "") : "";
  if (bank || acct) {
    const tail = acct.length > 4 ? `…${acct.slice(-4)}` : acct ? `…${acct}` : "";
    parts.push([bank, tail].filter(Boolean).join(" "));
  }
  const momo = typeof snap.mobile_money_number === "string" ? snap.mobile_money_number.trim() : "";
  const prov = typeof snap.mobile_money_provider === "string" ? snap.mobile_money_provider.trim() : "";
  if (momo) parts.push(prov ? `${prov}: ${momo}` : `MoMo ${momo}`);
  return parts.join(" · ");
}
