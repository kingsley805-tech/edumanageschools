// @ts-nocheck
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { PaymentTransactionRow } from "@/billing/lib/paymentTransactions";
import { extractPaymentMetadata } from "@/billing/lib/paymentTransactions";

type Scope =
  | { mode: "school"; schoolId: string }
  | { mode: "student"; studentId: string }
  | { mode: "parent"; studentIds: string[]; schoolId: string };

type InvoiceEmbed = {
  invoice_number?: string;
  student_id?: string;
  students?: { full_name?: string } | null;
};

function scopeCacheKey(scope: Scope | null): string {
  if (!scope) return "";
  if (scope.mode === "school") return `school:${scope.schoolId}`;
  if (scope.mode === "student") return `student:${scope.studentId}`;
  return `parent:${scope.schoolId}:${[...scope.studentIds].sort().join(",")}`;
}

function invoiceEmbed(row: Record<string, unknown>): InvoiceEmbed | null {
  const raw = row.billing_invoices ?? row.invoices;
  return (raw as InvoiceEmbed | null | undefined) ?? null;
}

function mapPaymentRow(
  row: Record<string, unknown>,
  extras?: Partial<PaymentTransactionRow>,
): PaymentTransactionRow {
  const inv = invoiceEmbed(row);
  const st = inv?.students ?? (row.students as { full_name?: string } | null | undefined);
  return {
    id: String(row.id),
    school_id: row.school_id ? String(row.school_id) : undefined,
    invoice_id: String(row.invoice_id),
    invoice_number: inv?.invoice_number ?? (row.invoice_number as string | null) ?? null,
    student_id: (row.student_id as string) ?? inv?.student_id ?? extras?.student_id ?? null,
    student_name: st?.full_name ?? (row.student_name as string) ?? extras?.student_name ?? null,
    parent_name: (row.parent_name as string) ?? extras?.parent_name ?? null,
    child_name: extras?.child_name ?? st?.full_name ?? (row.student_name as string) ?? null,
    amount: Number(row.amount),
    currency: String(row.currency ?? "GHS"),
    method: String(row.method ?? ""),
    gateway: String(row.gateway ?? ""),
    gateway_ref: (row.gateway_ref as string) ?? null,
    paystack_transaction_id:
      (row.paystack_transaction_id as string) ??
      ((row.metadata as { paystack_transaction_id?: string })?.paystack_transaction_id ?? null),
    transaction_id:
      (row.paystack_transaction_id as string) ??
      ((row.metadata as { paystack_transaction_id?: string })?.paystack_transaction_id ?? null),
    status: String(row.status ?? "pending"),
    payer_name: (row.payer_name as string) ?? null,
    payer_role: (row.payer_role as string) ?? null,
    notes: (row.notes as string) ?? null,
    paid_at: (row.paid_at as string) ?? null,
    created_at: String(row.created_at),
    payment_context: (row.payment_context as string) ?? "fees",
    receipt_number: (row.receipt_number as string) ?? null,
    receipt_url: (row.receipt_url as string) ?? null,
    whatsapp_status: (row.whatsapp_status as string) ?? null,
    whatsapp_delivery_id: (row.whatsapp_delivery_id as string) ?? null,
    sent_via_whatsapp_at: (row.sent_via_whatsapp_at as string) ?? null,
    metadata: (row.metadata as Record<string, unknown>) ?? null,
    fee_type:
      extractPaymentMetadata((row.metadata as Record<string, unknown>) ?? null).fee_type
      ?? extractPaymentMetadata((row.metadata as Record<string, unknown>) ?? null).fee_category
      ?? null,
    term: extractPaymentMetadata((row.metadata as Record<string, unknown>) ?? null).term ?? null,
    academic_year:
      extractPaymentMetadata((row.metadata as Record<string, unknown>) ?? null).academic_year ?? null,
    ...extras,
  };
}

const PAYMENT_BASE_COLS =
  "id, invoice_id, amount, currency, method, gateway, gateway_ref, status, payer_name, payer_role, notes, paid_at, created_at";

const PAYMENT_EXTENDED_COLS =
  `${PAYMENT_BASE_COLS}, paystack_transaction_id, payment_context`;

async function fetchParentPaymentsViaInvoices(
  schoolId: string,
  studentIds: string[],
): Promise<PaymentTransactionRow[]> {
  const { data, error } = await supabase
    .from("billing_payments")
    .select(
      `${PAYMENT_BASE_COLS},
       billing_invoices!inner ( invoice_number, student_id, students ( full_name ) )`,
    )
    .eq("school_id", schoolId)
    .in("billing_invoices.student_id", studentIds)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map((row) => {
    const inv = invoiceEmbed(row as Record<string, unknown>);
    return mapPaymentRow(row as Record<string, unknown>, {
      invoice_number: inv?.invoice_number ?? null,
      child_name: inv?.students?.full_name ?? null,
    });
  });
}

export function usePaymentTransactions(scope: Scope | null) {
  const [rows, setRows] = useState<PaymentTransactionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const scopeRef = useRef(scope);
  scopeRef.current = scope;
  const scopeKey = scopeCacheKey(scope);

  const fetchRows = useCallback(async (opts?: { silent?: boolean }) => {
    const current = scopeRef.current;
    if (!current) {
      setRows([]);
      setLoading(false);
      return;
    }
    if (!opts?.silent) setLoading(true);
    setError(null);
    try {
      if (current.mode === "school") {
        // 1. Fetch payments directly
        let { data, error: qErr } = await supabase
          .from("billing_payments")
          .select("*")
          .eq("school_id", current.schoolId)
          .order("created_at", { ascending: false })
          .limit(1000);

        if (qErr || !data) {
          // Fallback without school_id filter if needed
          const { data: allData, error: allErr } = await supabase
            .from("billing_payments")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(1000);
          if (allErr && !allData) throw allErr;
          data = allData || [];
        }

        const paymentsList = data || [];

        // 2. Safely resolve invoices & students
        const invoiceIds = Array.from(
          new Set(paymentsList.map((r: any) => r.invoice_id).filter(Boolean)),
        );
        const studentIds: string[] = Array.from(
          new Set(paymentsList.map((r: any) => r.student_id).filter(Boolean)),
        );

        const invoiceMap = new Map<string, any>();
        if (invoiceIds.length > 0) {
          try {
            const { data: invRows } = await supabase
              .from("billing_invoices")
              .select("id, invoice_number, student_id")
              .in("id", invoiceIds);
            (invRows || []).forEach((inv: any) => {
              invoiceMap.set(inv.id, inv);
              if (inv.student_id && !studentIds.includes(inv.student_id)) {
                studentIds.push(inv.student_id);
              }
            });
          } catch {
            // Ignore optional invoice join errors
          }
        }

        const studentMap = new Map<string, any>();
        if (studentIds.length > 0) {
          try {
            const { data: stuRows } = await supabase
              .from("students")
              .select("id, full_name, admission_number, admission_no, user_id, profiles:user_id(full_name)")
              .in("id", studentIds);
            (stuRows || []).forEach((st: any) => {
              studentMap.set(st.id, st);
            });
          } catch {
            // Fallback bare students query
            try {
              const { data: bareStu } = await supabase
                .from("students")
                .select("id, full_name, admission_number, admission_no, user_id")
                .in("id", studentIds);
              (bareStu || []).forEach((st: any) => {
                studentMap.set(st.id, st);
              });
            } catch {
              // Ignore
            }
          }
        }

        setRows(
          paymentsList.map((row: any) => {
            const inv = invoiceMap.get(row.invoice_id);
            const studentId = row.student_id || inv?.student_id || null;
            const stu = studentId ? studentMap.get(studentId) : null;
            const studentName =
              stu?.profiles?.full_name ||
              stu?.full_name ||
              (row.student_name as string) ||
              null;

            return mapPaymentRow(row as Record<string, unknown>, {
              invoice_number: row.invoice_number || inv?.invoice_number || null,
              student_id: studentId,
              student_name: studentName,
              child_name: studentName,
            });
          }),
        );
        return;
      }

      if (current.mode === "student") {
        const { data, error: qErr } = await supabase
          .from("billing_payments")
          .select("*")
          .eq("student_id", current.studentId)
          .order("created_at", { ascending: false });

        if (qErr) {
          // Fallback
          setRows([]);
          return;
        }

        const paymentList = data || [];
        const invoiceIds = Array.from(new Set(paymentList.map((r: any) => r.invoice_id).filter(Boolean)));
        const invoiceMap = new Map<string, any>();
        if (invoiceIds.length > 0) {
          const { data: invRows } = await supabase
            .from("billing_invoices")
            .select("id, invoice_number")
            .in("id", invoiceIds);
          (invRows || []).forEach((inv: any) => invoiceMap.set(inv.id, inv));
        }

        setRows(
          paymentList.map((r: any) => {
            const inv = invoiceMap.get(r.invoice_id);
            return mapPaymentRow(r as Record<string, unknown>, {
              invoice_number: inv?.invoice_number || r.invoice_number || null,
            });
          }),
        );
        return;
      }

      if (current.mode === "parent") {
        if (!current.studentIds.length) {
          setRows([]);
          return;
        }
        const { data } = await supabase
          .from("billing_payments")
          .select("*")
          .in("student_id", current.studentIds)
          .order("created_at", { ascending: false });

        const paymentList = data || [];
        const invoiceIds = Array.from(new Set(paymentList.map((r: any) => r.invoice_id).filter(Boolean)));
        const invoiceMap = new Map<string, any>();
        if (invoiceIds.length > 0) {
          const { data: invRows } = await supabase
            .from("billing_invoices")
            .select("id, invoice_number")
            .in("id", invoiceIds);
          (invRows || []).forEach((inv: any) => invoiceMap.set(inv.id, inv));
        }

        setRows(
          paymentList.map((row: any) => {
            const inv = invoiceMap.get(row.invoice_id);
            return mapPaymentRow(row as Record<string, unknown>, {
              invoice_number: inv?.invoice_number || row.invoice_number || null,
            });
          }),
        );
      }
    } catch (e) {
      console.error("Failed to load payments:", e);
      setError(e instanceof Error ? e.message : "Failed to load payments");
      setRows([]);
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, [scopeKey]);

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  useEffect(() => {
    const current = scopeRef.current;
    if (!current) return;

    const schoolFilter =
      current.mode === "school" || current.mode === "parent"
        ? `school_id=eq.${current.schoolId}`
        : undefined;

    const channel = supabase
      .channel(`payment-tx-${scopeKey}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "billing_payments",
          ...(schoolFilter ? { filter: schoolFilter } : {}),
        },
        () => void fetchRows({ silent: true }),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [scopeKey, fetchRows]);

  return { rows, loading, error, refetch: () => fetchRows() };
}
