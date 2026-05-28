import { supabase } from "@/integrations/supabase/client";
import { isSchemaColumnError } from "@/lib/schoolFetch";
import { formatSupabaseError } from "@/billing/lib/fee-assignments";

export { formatSupabaseError };

function toThrownError(error: unknown): Error {
  return new Error(formatSupabaseError(error));
}

function isMissingClientsTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const msg = (error.message ?? "").toLowerCase();
  return (
    error.code === "PGRST205" ||
    msg.includes("clients") && (msg.includes("schema cache") || msg.includes("could not find"))
  );
}

function isRecoverableInvoiceError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (isSchemaColumnError(error)) return true;
  if (isMissingClientsTable(error)) return true;
  const msg = (error.message ?? "").toLowerCase();
  return msg.includes("column") && (msg.includes("could not find") || msg.includes("does not exist"));
}

export async function ensureBillingClientId(schoolId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("clients")
    .select("id")
    .eq("school_id", schoolId)
    .eq("client_type", "school")
    .maybeSingle();

  if (error) {
    if (isMissingClientsTable(error)) return null;
    throw toThrownError(error);
  }
  if (data?.id) return data.id;

  const { data: created, error: createError } = await supabase
    .from("clients")
    .insert({ school_id: schoolId, name: "School Fees", client_type: "school" })
    .select("id")
    .single();

  if (createError) {
    if (isMissingClientsTable(createError)) return null;
    throw toThrownError(createError);
  }
  return created?.id ?? null;
}

export type CreateBillingInvoiceInput = {
  schoolId: string;
  studentId: string;
  termId?: string | null;
  invoiceNumber: string;
  status: "draft" | "sent";
  currency: string;
  total: number;
  dueDate: string;
  issuedBy: string;
  clientId?: string | null;
};

function invoiceInsertVariants(input: CreateBillingInvoiceInput, clientId: string | null) {
  const core = {
    school_id: input.schoolId,
    student_id: input.studentId,
    invoice_number: input.invoiceNumber,
    status: input.status,
    currency: input.currency,
    total_amount: input.total,
    amount_paid: 0,
    balance_due: input.total,
    due_date: input.dueDate,
    issued_by: input.issuedBy,
  };

  const variants: Record<string, unknown>[] = [];

  const push = (row: Record<string, unknown>) => {
    const key = JSON.stringify(row);
    if (!variants.some((v) => JSON.stringify(v) === key)) variants.push(row);
  };

  if (input.termId) {
    push({ ...core, term_id: input.termId, subtotal: input.total, ...(clientId ? { client_id: clientId } : {}) });
    push({ ...core, term_id: input.termId, subtotal: input.total });
    push({ ...core, term_id: input.termId, ...(clientId ? { client_id: clientId } : {}) });
    push({ ...core, term_id: input.termId });
  }

  push({ ...core, subtotal: input.total, ...(clientId ? { client_id: clientId } : {}) });
  push({ ...core, subtotal: input.total });
  push({ ...core, ...(clientId ? { client_id: clientId } : {}) });
  push({ ...core });

  return variants;
}

export async function createBillingInvoice(input: CreateBillingInvoiceInput): Promise<string> {
  const clientId = input.clientId !== undefined ? input.clientId : await ensureBillingClientId(input.schoolId);
  let lastError: unknown = null;

  for (const row of invoiceInsertVariants(input, clientId)) {
    const { data, error } = await supabase
      .from("billing_invoices")
      .insert(row as never)
      .select("id")
      .single();

    if (!error && data?.id) return data.id;

    lastError = error;
    if (!isRecoverableInvoiceError(error)) break;
  }

  throw toThrownError(lastError);
}

export type InvoiceLineItemInput = {
  description: string;
  amount: number;
  feeItemId?: string | null;
};

export async function insertBillingInvoiceLineItems(
  invoiceId: string,
  items: InvoiceLineItemInput[]
): Promise<void> {
  for (const item of items) {
    const base = {
      invoice_id: invoiceId,
      description: item.description,
      quantity: 1,
      unit_price: item.amount,
      amount: item.amount,
    };

    const variants: Record<string, unknown>[] = item.feeItemId
      ? [{ ...base, fee_item_id: item.feeItemId }, base]
      : [base];

    let inserted = false;
    let lastError: unknown = null;

    for (const row of variants) {
      const { error } = await supabase.from("billing_invoice_line_items").insert(row as never);
      if (!error) {
        inserted = true;
        break;
      }
      lastError = error;
      if (!isRecoverableInvoiceError(error)) break;
    }

    if (!inserted) throw toThrownError(lastError);
  }
}

export function isDuplicateInvoiceNumberError(error: { message?: string } | null): boolean {
  const msg = (error?.message ?? "").toLowerCase();
  return msg.includes("duplicate") || msg.includes("unique") || msg.includes("invoice_number");
}

export async function createBillingInvoiceWithRetry(
  input: CreateBillingInvoiceInput,
  maxAttempts = 4
): Promise<string> {
  let lastError: unknown = null;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const invoiceNumber = i === 0 ? input.invoiceNumber : `${input.invoiceNumber}-${i}`;
      return await createBillingInvoice({ ...input, invoiceNumber });
    } catch (error) {
      lastError = error;
      if (!(error instanceof Error) || !isDuplicateInvoiceNumberError({ message: error.message })) {
        throw error;
      }
    }
  }
  throw toThrownError(lastError);
}
