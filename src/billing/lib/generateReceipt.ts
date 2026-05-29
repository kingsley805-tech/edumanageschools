// @ts-nocheck
﻿import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export type ReceiptLetterhead = {
  schoolName: string;
  logoUrl?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
};

export interface ReceiptData {
  receiptNumber: string;
  /** Fallback school label when `letterhead` is not provided */
  schoolName: string;
  letterhead?: ReceiptLetterhead | null;
  studentName: string;
  admissionNumber: string;
  className: string;
  parentName?: string | null;
  invoiceNumber: string;
  amount: number;
  currency: string;
  method: string;
  gateway?: string | null;
  paymentStatus?: string | null;
  payerName?: string | null;
  paidAt: string;
  items?: { description: string; amount: number }[];
  /** Paystack transaction reference (same as gateway_ref when paid online) */
  paystackReference?: string | null;
  /** Paystack transaction id (numeric id from Paystack) */
  paystackTransactionId?: string | null;
}

async function tryFetchImageDataUrl(
  url: string | null | undefined,
): Promise<{ dataUrl: string; format: "PNG" | "JPEG" } | null> {
  if (!url?.trim()) return null;
  try {
    const res = await fetch(url.trim());
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = () => reject(fr.error);
      fr.readAsDataURL(blob);
    });
    const format: "PNG" | "JPEG" =
      /image\/jpe?g/i.test(blob.type) || dataUrl.includes("image/jpeg") ? "JPEG" : "PNG";
    return { dataUrl, format };
  } catch {
    return null;
  }
}

/** Generates a branded PDF receipt / invoice with optional Paystack identifiers. */
export async function generateReceipt(data: ReceiptData) {
  const doc = new jsPDF({ unit: "mm", format: "a5" });
  const w = doc.internal.pageSize.getWidth();
  const primary = [29, 148, 120];
  const margin = 12;
  const lh = data.letterhead;
  const orgName = (lh?.schoolName || data.schoolName || "School").trim();

  let y = 10;
  const logoW = 22;
  const logoH = 22;
  const img = lh?.logoUrl ? await tryFetchImageDataUrl(lh.logoUrl) : null;
  if (img) {
    try {
      doc.addImage(img.dataUrl, img.format, margin, y, logoW, logoH);
    } catch {
      // ignore bad image payload
    }
  }

  const textX = margin + (img ? logoW + 4 : 0);
  doc.setTextColor(25, 25, 25);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(orgName, textX, y + 5, { maxWidth: w - textX - margin });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(55, 55, 55);
  let lineY = y + 10;
  const lines = [lh?.address, lh?.phone, lh?.email, lh?.website].filter((s) => s && String(s).trim()) as string[];
  for (const line of lines) {
    doc.text(String(line), textX, lineY, { maxWidth: w - textX - margin });
    lineY += 4;
  }
  y = Math.max(img ? y + logoH : lineY, lineY) + 4;
  doc.setDrawColor(210, 210, 210);
  doc.line(margin, y, w - margin, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(primary[0], primary[1], primary[2]);
  doc.text("OFFICIAL PAYMENT RECEIPT", margin, y);
  y += 10;

  doc.setTextColor(60, 60, 60);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Receipt #:", margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(data.receiptNumber, 42, y);

  doc.setFont("helvetica", "bold");
  doc.text("Date:", w / 2 + 2, y);
  doc.setFont("helvetica", "normal");
  doc.text(
    new Date(data.paidAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
    w / 2 + 18,
    y,
  );

  y += 10;
  doc.setDrawColor(220, 220, 220);
  doc.line(margin, y, w - margin, y);
  y += 8;

  const infoRows: [string, string][] = [
    ["Student Name", data.studentName],
    ["Admission No.", data.admissionNumber || "—"],
    ["Class", data.className],
    ["Invoice #", data.invoiceNumber],
  ];
  if (data.parentName?.trim()) {
    infoRows.push(["Parent / Guardian", data.parentName.trim()]);
  }
  if (data.payerName?.trim()) {
    infoRows.push(["Paid by", data.payerName.trim()]);
  }
  if (data.gateway?.trim()) {
    infoRows.push(["Gateway", data.gateway.trim()]);
  }
  infoRows.push(["Payment method", data.method.replace(/_/g, " ")]);
  if (data.paymentStatus?.trim()) {
    infoRows.push(["Status", data.paymentStatus.trim()]);
  }
  if (data.paystackReference) {
    infoRows.push(["Payment reference", data.paystackReference]);
  }
  if (data.paystackTransactionId) {
    infoRows.push(["Transaction ID", data.paystackTransactionId]);
  }

  for (const [label, value] of infoRows) {
    doc.setFont("helvetica", "bold");
    doc.text(`${label}:`, margin, y);
    doc.setFont("helvetica", "normal");
    doc.text(value, 52, y, { maxWidth: w - margin - 52 });
    y += 7;
  }

  y += 4;

  if (data.items && data.items.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [["Description", "Amount"]],
      body: data.items.map((item) => [item.description, `${data.currency} ${item.amount.toLocaleString()}`]),
      foot: [["Total Paid", `${data.currency} ${data.amount.toLocaleString()}`]],
      margin: { left: margin, right: margin },
      headStyles: { fillColor: primary, fontSize: 8, font: "helvetica" },
      bodyStyles: { fontSize: 8 },
      footStyles: { fillColor: [240, 240, 240], textColor: [20, 20, 20], fontStyle: "bold", fontSize: 9 },
      theme: "grid",
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  } else {
    doc.setFillColor(240, 248, 245);
    doc.roundedRect(margin, y, w - 2 * margin, 22, 3, 3, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(primary[0], primary[1], primary[2]);
    doc.text(`${data.currency} ${data.amount.toLocaleString()}`, w / 2, y + 9, { align: "center" });
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(`Paid via ${data.method.replace(/_/g, " ")}`, w / 2, y + 16, { align: "center" });
    y += 30;
  }

  doc.setDrawColor(220, 220, 220);
  doc.line(margin, y, w - margin, y);
  y += 8;
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text("This is a computer-generated receipt and does not require a signature.", w / 2, y, { align: "center" });
  doc.text(`Generated on ${new Date().toLocaleString()}`, w / 2, y + 5, { align: "center" });

  doc.save(`Receipt-${data.receiptNumber}.pdf`);
}