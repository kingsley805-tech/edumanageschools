// @ts-nocheck
import { supabase } from "@/integrations/supabase/client";

export type BillingJobProgress = {
  processed: number;
  total: number;
  invoices_created: number;
};

export type AccountInvoiceSummary = {
  id: string;
  invoice_no: string;
  academic_term: string;
  total_amount: number;
  total_paid: number;
  balance: number;
  status: string;
  due_date: string;
  billing_account_id: string;
  display_name: string | null;
  account_no: string;
};

export type InvoiceItemRow = {
  id: string;
  student_id: string;
  student_name: string;
  admission_no: string | null;
  category_name: string;
  category_priority: number;
  description: string | null;
  amount: number;
  amount_paid: number;
  balance: number;
  due_date: string;
  is_overdue: boolean;
};

export async function backfillBillingAccounts(schoolId: string) {
  const { data, error } = await supabase.rpc("backfill_billing_accounts_for_school", {
    p_school_id: schoolId,
  });
  if (error) throw error;
  return data as { accounts_created: number; links_ensured: number };
}

export async function seedBillingDefaults(schoolId: string) {
  const { error: catError } = await supabase.rpc("seed_billing_fee_categories", {
    p_school_id: schoolId,
  });
  if (catError) throw catError;

  // Optional — present only after consolidated billing migration
  await supabase.rpc("seed_billing_allocation_rules", { p_school_id: schoolId });
}

export async function createBillingJob(params: {
  schoolId: string;
  academicTerm: string;
  termId?: string | null;
}) {
  const { data, error } = await supabase.rpc("create_billing_job", {
    p_school_id: params.schoolId,
    p_academic_term: params.academicTerm,
    p_term_id: params.termId ?? null,
  });
  if (error) throw error;
  return data as string;
}

export async function processBillingJobChunk(jobId: string, chunkSize = 200) {
  const { data, error } = await supabase.rpc("process_billing_job_chunk", {
    p_job_id: jobId,
    p_chunk_size: chunkSize,
  });
  if (error) throw error;
  return data as BillingJobProgress;
}

/** Run job until complete (client-side chunk loop for schools without edge worker). */
export async function runBillingJobToCompletion(
  jobId: string,
  onProgress?: (p: BillingJobProgress) => void,
) {
  let progress: BillingJobProgress = { processed: 0, total: 0, invoices_created: 0 };
  let guard = 0;
  while (guard < 500) {
    progress = await processBillingJobChunk(jobId);
    onProgress?.(progress);
    if (progress.total > 0 && progress.processed >= progress.total) break;
    guard += 1;
  }
  return progress;
}

export async function fetchBillingJob(jobId: string) {
  const { data, error } = await (supabase as any)
    .from("billing_jobs")
    .select("*")
    .eq("id", jobId)
    .single();
  if (error) throw error;
  return data;
}

export async function fetchAccountInvoices(schoolId: string) {
  const { data, error } = await (supabase as any)
    .from("account_invoices")
    .select(
      `
      id, invoice_no, academic_term, total_amount, total_paid, status, due_date, billing_account_id,
      billing_accounts ( account_no, display_name, balance_due )
    `,
    )
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    id: row.id,
    invoice_no: row.invoice_no,
    academic_term: row.academic_term,
    total_amount: Number(row.total_amount),
    total_paid: Number(row.total_paid),
    balance: Number(row.total_amount) - Number(row.total_paid),
    status: row.status,
    due_date: row.due_date,
    billing_account_id: row.billing_account_id,
    display_name: row.billing_accounts?.display_name ?? null,
    account_no: row.billing_accounts?.account_no ?? "",
  })) as AccountInvoiceSummary[];
}

export async function fetchInvoiceItems(invoiceId: string): Promise<InvoiceItemRow[]> {
  const { data, error } = await (supabase as any)
    .from("account_invoice_items")
    .select(
      `
      id, student_id, description, amount, amount_paid, due_date,
      fee_categories ( name, default_priority ),
      students ( admission_no, user_id )
    `,
    )
    .eq("invoice_id", invoiceId)
    .order("due_date");
  if (error) throw error;

  const userIds = [...new Set((data ?? []).map((r: any) => r.students?.user_id).filter(Boolean))];
  const nameMap = new Map<string, string>();
  if (userIds.length) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);
    for (const p of profiles ?? []) nameMap.set(p.id, p.full_name ?? "Student");
  }

  const today = new Date().toISOString().slice(0, 10);
  return (data ?? []).map((row: any) => {
    const amount = Number(row.amount);
    const amountPaid = Number(row.amount_paid);
    return {
      id: row.id,
      student_id: row.student_id,
      student_name: nameMap.get(row.students?.user_id) ?? "Student",
      admission_no: row.students?.admission_no ?? null,
      category_name: row.fee_categories?.name ?? "Fee",
      category_priority: row.fee_categories?.default_priority ?? 5,
      description: row.description,
      amount,
      amount_paid: amountPaid,
      balance: amount - amountPaid,
      due_date: row.due_date,
      is_overdue: row.due_date < today && amountPaid < amount,
    };
  });
}

export async function recordAccountPayment(params: {
  schoolId: string;
  billingAccountId: string;
  invoiceId: string;
  amount: number;
  manualAllocations?: { invoice_item_id: string; amount: number }[];
}) {
  const { data, error } = await supabase.rpc("record_account_payment", {
    p_school_id: params.schoolId,
    p_billing_account_id: params.billingAccountId,
    p_invoice_id: params.invoiceId,
    p_amount: params.amount,
    p_allocation_mode: params.manualAllocations?.length ? "manual" : "auto",
    p_manual_allocations: params.manualAllocations?.length
      ? params.manualAllocations
      : null,
  });
  if (error) throw error;
  return data;
}

export async function fetchFeeTemplates(schoolId: string, academicTerm?: string) {
  let q = (supabase as any)
    .from("fee_templates")
    .select(
      `
      id, name, amount, scope, academic_term, is_active, class_id, student_id,
      fee_categories ( name, code, default_priority )
    `,
    )
    .eq("school_id", schoolId)
    .order("academic_term", { ascending: false });
  if (academicTerm) q = q.eq("academic_term", academicTerm);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function upsertFeeTemplate(row: {
  school_id: string;
  fee_category_id: string;
  name: string;
  amount: number;
  scope: "global" | "grade" | "student";
  academic_term: string;
  term_id?: string | null;
  class_id?: string | null;
  student_id?: string | null;
}) {
  const { data, error } = await (supabase as any).from("fee_templates").insert(row).select().single();
  if (error) throw error;
  return data;
}

export async function fetchBillingAccounts(schoolId: string) {
  const { data, error } = await (supabase as any)
    .from("billing_accounts")
    .select(
      `
      id, account_no, display_name, balance_due, status, currency,
      billing_account_students (
        student_id,
        students ( admission_no, user_id )
      )
    `,
    )
    .eq("school_id", schoolId)
    .order("account_no");
  if (error) throw error;

  const userIds = [
    ...new Set(
      (data ?? []).flatMap((a: any) =>
        (a.billing_account_students ?? []).map((l: any) => l.students?.user_id).filter(Boolean),
      ),
    ),
  ];
  const nameMap = new Map<string, string>();
  if (userIds.length) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);
    for (const p of profiles ?? []) nameMap.set(p.id, p.full_name ?? "Student");
  }

  return (data ?? []).map((a: any) => ({
    ...a,
    billing_account_students: (a.billing_account_students ?? []).map((l: any) => ({
      ...l,
      student_label:
        nameMap.get(l.students?.user_id) ?? l.students?.admission_no ?? "Student",
    })),
  }));
}