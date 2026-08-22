// @ts-nocheck
import { supabase } from "@/integrations/supabase/client";
import { formatMoney } from "@/lib/currency";
import { fetchInvoiceAssignableFees } from "@/billing/lib/fee-assignments";
import {
  createBillingInvoiceWithRetry,
  insertBillingInvoiceLineItems,
} from "@/billing/lib/invoices";
import type { PosOpenInvoice } from "@/billing/lib/posStudentSearch";

export type PosFeeOption = {
  id: string;
  feeItemId: string | null;
  termId: string | null;
  label: string;
  description: string | null;
  amount: number;
  currency: string;
  feeCategory: string | null;
  termName: string | null;
  academicYear: string | null;
  source: "line_item" | "assignment";
};

const INVOICE_REF_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";

/** POS auto-invoices use a compact 5-letter reference. */
export function buildPosInvoiceNumber(): string {
  let code = "";
  for (let i = 0; i < 5; i++) {
    code += INVOICE_REF_LETTERS[Math.floor(Math.random() * INVOICE_REF_LETTERS.length)];
  }
  return code;
}

/** Display label — 5 letters max; full value stays in DB / receipts. */
export function shortInvoiceRef(ref: string | null | undefined, len = 5): string {
  if (!ref?.trim()) return "—";
  const trimmed = ref.trim();
  if (trimmed.length <= len) return trimmed.toUpperCase();
  const segments = trimmed.split("-").filter(Boolean);
  const tail = segments[segments.length - 1] ?? trimmed;
  const tailLetters = tail.replace(/[^A-Za-z]/g, "").toUpperCase();
  if (tailLetters.length >= len) return tailLetters.slice(0, len);
  if (tailLetters.length > 0) return tailLetters.padEnd(len, tailLetters[0]!);
  const compact = trimmed.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return (compact.slice(-len) || trimmed.slice(0, len)).toUpperCase();
}

export function invoiceRefNeedsTooltip(ref: string | null | undefined, len = 5): boolean {
  if (!ref?.trim()) return false;
  return shortInvoiceRef(ref, len) !== ref.trim().toUpperCase() && ref.trim().length > len;
}

type TermMeta = {
  name: string;
  feesDueDate: string | null;
  academicYear: string | null;
};

async function loadTermMetaMap(termIds: string[]): Promise<Map<string, TermMeta>> {
  const map = new Map<string, TermMeta>();
  if (termIds.length === 0) return map;

  const { data } = await supabase
    .from("terms")
    .select("id, name, fees_due_date, academic_years:academic_year_id(name)")
    .in("id", termIds);

  for (const row of data ?? []) {
    const ay = row.academic_years as { name?: string } | null;
    map.set(row.id, {
      name: row.name,
      feesDueDate: row.fees_due_date ?? null,
      academicYear: ay?.name ?? null,
    });
  }
  return map;
}

function mapAssignableFeeToOption(
  fee: Awaited<ReturnType<typeof fetchInvoiceAssignableFees>>[number],
  termMeta: Map<string, TermMeta>,
  fallbackCurrency: string,
): PosFeeOption {
  const term = fee.term_id ? termMeta.get(fee.term_id) : null;
  const category = fee.fee_categories?.name ?? "Fee";
  const termName = fee.terms?.name ?? term?.name ?? null;
  const currency = fee.currency || fallbackCurrency;

  return {
    id: `fee:${fee.id}`,
    feeItemId: fee.id,
    termId: fee.term_id ?? null,
    label: category,
    description: [termName, formatMoney(Number(fee.amount), currency)].filter(Boolean).join(" · "),
    amount: Number(fee.amount),
    currency,
    feeCategory: category,
    termName,
    academicYear: term?.academicYear ?? null,
    source: "assignment",
  };
}

/** Assigned fees for a student — used when no invoice exists yet. */
export async function loadPosStudentFeeOptions(
  schoolId: string,
  opts: { studentId: string; classId: string | null; currency?: string },
): Promise<PosFeeOption[]> {
  const fallbackCurrency = opts.currency ?? "GHS";
  const fees = await fetchInvoiceAssignableFees(schoolId, {
    studentId: opts.studentId,
    classId: opts.classId,
  });

  const termIds = [...new Set(fees.map((f) => f.term_id).filter(Boolean))] as string[];
  const termMeta = await loadTermMetaMap(termIds);

  return fees.map((fee) => mapAssignableFeeToOption(fee, termMeta, fallbackCurrency));
}

export async function loadPosInvoiceFeeOptions(
  schoolId: string,
  opts: {
    invoiceId: string;
    studentId: string;
    classId: string | null;
    termId: string | null;
    termName: string | null;
    academicYear: string | null;
    currency: string;
  },
): Promise<PosFeeOption[]> {
  const [lineItemsResult, assignableFees] = await Promise.all([
    supabase
      .from("billing_invoice_line_items")
      .select("id, description, amount, fee_item_id")
      .eq("invoice_id", opts.invoiceId)
      .order("created_at"),
    fetchInvoiceAssignableFees(schoolId, {
      studentId: opts.studentId,
      classId: opts.classId,
      termId: opts.termId,
    }).catch(() => []),
  ]);

  if (lineItemsResult.error) throw lineItemsResult.error;

  const options: PosFeeOption[] = [];

  for (const item of lineItemsResult.data ?? []) {
    const amount = Number(item.amount);
    options.push({
      id: `line:${item.id}`,
      feeItemId: item.fee_item_id ?? null,
      termId: opts.termId,
      label: item.description?.trim() || "Fee",
      description: formatMoney(amount, opts.currency),
      amount,
      currency: opts.currency,
      feeCategory: item.description?.trim() || null,
      termName: opts.termName,
      academicYear: opts.academicYear,
      source: "line_item",
    });
  }

  if (options.length > 0) return options;

  const termIds = [...new Set(assignableFees.map((f) => f.term_id).filter(Boolean))] as string[];
  const termMeta = await loadTermMetaMap(termIds);

  for (const fee of assignableFees) {
    options.push(mapAssignableFeeToOption(fee, termMeta, opts.currency));
  }

  return options;
}

const OPEN_INVOICE_STATUSES = ["draft", "sent", "partially_paid", "overdue", "viewed"];

function mapInvoiceRow(i: Record<string, unknown>): PosOpenInvoice {
  const term = i.terms as {
    name?: string;
    academic_years?: { name?: string } | null;
  } | null;
  const balance = Number(i.balance_due ?? Number(i.total_amount) - Number(i.amount_paid));
  return {
    id: i.id as string,
    invoiceNumber: i.invoice_number as string,
    balance: Math.max(0, balance),
    amountPaid: Number(i.amount_paid),
    totalAmount: Number(i.total_amount),
    currency: i.currency as string,
    dueDate: i.due_date as string,
    termId: (i.term_id as string | null) ?? null,
    termName: term?.name ?? null,
    academicYear: term?.academic_years?.name ?? null,
    feeCategory: (i.notes as string | null)?.trim() || null,
    status: i.status as string,
  };
}

/** Reuse an open invoice that already includes this fee item, if any. */
export async function findOpenInvoiceForFeeItem(
  schoolId: string,
  studentId: string,
  feeItemId: string,
): Promise<PosOpenInvoice | null> {
  const { data: lineItems, error: lineErr } = await supabase
    .from("billing_invoice_line_items")
    .select("invoice_id")
    .eq("fee_item_id", feeItemId);

  if (lineErr || !lineItems?.length) return null;

  const invoiceIds = [...new Set(lineItems.map((r) => r.invoice_id))];

  const { data: invoices, error: invErr } = await supabase
    .from("billing_invoices")
    .select(
      "id, invoice_number, total_amount, amount_paid, balance_due, currency, due_date, status, term_id, notes, terms:term_id(name, academic_years:academic_year_id(name))",
    )
    .eq("school_id", schoolId)
    .eq("student_id", studentId)
    .in("id", invoiceIds)
    .in("status", OPEN_INVOICE_STATUSES)
    .order("due_date");

  if (invErr || !invoices?.length) return null;

  for (const raw of invoices) {
    const mapped = mapInvoiceRow(raw as Record<string, unknown>);
    if (mapped.balance > 0 && mapped.status !== "void") return mapped;
  }
  return null;
}

/** Create (or reuse) an invoice for a selected assigned fee — POS fee-first flow. */
export async function ensurePosInvoiceForFee(input: {
  schoolId: string;
  studentId: string;
  fee: PosFeeOption;
  issuedBy: string;
}): Promise<PosOpenInvoice> {
  if (!input.fee.feeItemId) {
    throw new Error("Selected fee cannot be invoiced automatically.");
  }

  const existing = await findOpenInvoiceForFeeItem(
    input.schoolId,
    input.studentId,
    input.fee.feeItemId,
  );
  if (existing) return existing;

  let dueDate = new Date().toISOString().split("T")[0];
  if (input.fee.termId) {
    const termMeta = await loadTermMetaMap([input.fee.termId]);
    dueDate = termMeta.get(input.fee.termId)?.feesDueDate ?? dueDate;
  }

  const invoiceId = await createBillingInvoiceWithRetry({
    schoolId: input.schoolId,
    studentId: input.studentId,
    termId: input.fee.termId,
    invoiceNumber: buildPosInvoiceNumber(),
    status: "sent",
    currency: input.fee.currency,
    total: input.fee.amount,
    dueDate,
    issuedBy: input.issuedBy,
  });

  try {
    await insertBillingInvoiceLineItems(invoiceId, [
      {
        description: input.fee.feeCategory || input.fee.label,
        amount: input.fee.amount,
        feeItemId: input.fee.feeItemId,
      },
    ]);
  } catch (lineError) {
    await supabase.from("billing_invoices").delete().eq("id", invoiceId);
    throw lineError;
  }

  const { data: created, error } = await supabase
    .from("billing_invoices")
    .select(
      "id, invoice_number, total_amount, amount_paid, balance_due, currency, due_date, status, term_id, notes, terms:term_id(name, academic_years:academic_year_id(name))",
    )
    .eq("id", invoiceId)
    .single();

  if (error || !created) throw new Error("Invoice was created but could not be loaded.");

  return mapInvoiceRow(created as Record<string, unknown>);
}
