// @ts-nocheck
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { PaymentTransactionRow } from "@/billing/lib/paymentTransactions";

type Scope =
  | { mode: "school"; schoolId: string }
  | { mode: "student"; studentId: string }
  | { mode: "parent"; studentIds: string[]; schoolId: string };

type InvoiceEmbed = {
  invoice_number?: string;
  student_id?: string;
  students?: { full_name?: string } | null;
};

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
    paystack_transaction_id: (row.paystack_transaction_id as string) ?? null,
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

  const fetchRows = useCallback(async () => {
    if (!scope) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (scope.mode === "school") {
        let { data, error: qErr } = await supabase
          .from("billing_payments")
          .select(
            `id, school_id, invoice_id, student_id, amount, currency, method, gateway, gateway_ref,
             paystack_transaction_id, status, payer_name, payer_role, notes, paid_at, created_at, payment_context, metadata,
             billing_invoices ( invoice_number, student_id, students ( full_name ) )`,
          )
          .eq("school_id", scope.schoolId)
          .order("created_at", { ascending: false })
          .limit(1000);

        if (qErr) {
          const retry = await supabase
            .from("billing_payments")
            .select(
              `id, school_id, invoice_id, amount, currency, method, gateway, gateway_ref,
               status, payer_name, payer_role, notes, paid_at, created_at, payment_context,
               billing_invoices ( invoice_number, student_id, students ( full_name ) )`,
            )
            .eq("school_id", scope.schoolId)
            .order("created_at", { ascending: false })
            .limit(1000);
          data = retry.data;
          qErr = retry.error;
        }

        if (qErr) throw qErr;
        setRows(
          (data ?? []).map((row) => {
            const inv = invoiceEmbed(row as Record<string, unknown>);
            return mapPaymentRow(row as Record<string, unknown>, {
              invoice_number: inv?.invoice_number ?? null,
              student_name: inv?.students?.full_name ?? null,
            });
          }),
        );
        return;
      }

      if (scope.mode === "student") {
        const { data, error: qErr } = await supabase
          .from("billing_payments")
          .select(`${PAYMENT_EXTENDED_COLS}, billing_invoices ( invoice_number )`)
          .eq("student_id", scope.studentId)
          .order("created_at", { ascending: false });

        if (qErr) {
          const { data: viaInv, error: invErr } = await supabase
            .from("billing_payments")
            .select(
              `${PAYMENT_EXTENDED_COLS},
               billing_invoices!inner ( invoice_number, student_id )`,
            )
            .eq("billing_invoices.student_id", scope.studentId)
            .order("created_at", { ascending: false });
          if (invErr) throw invErr;
          setRows((viaInv ?? []).map((r) => mapPaymentRow(r as Record<string, unknown>)));
          return;
        }
        setRows((data ?? []).map((r) => mapPaymentRow(r as Record<string, unknown>)));
        return;
      }

      if (scope.mode === "parent") {
        if (!scope.studentIds.length) {
          setRows([]);
          return;
        }
        const { data, error: qErr } = await supabase
          .from("billing_payments")
          .select(
            `${PAYMENT_EXTENDED_COLS}, student_id,
             billing_invoices!inner ( invoice_number, student_id, students ( full_name ) )`,
          )
          .eq("school_id", scope.schoolId)
          .in("student_id", scope.studentIds)
          .order("created_at", { ascending: false });

        if (qErr) {
          setRows(await fetchParentPaymentsViaInvoices(scope.schoolId, scope.studentIds));
          return;
        }
        setRows(
          (data ?? []).map((row) => {
            const inv = invoiceEmbed(row as Record<string, unknown>);
            return mapPaymentRow(row as Record<string, unknown>, {
              invoice_number: inv?.invoice_number ?? null,
              child_name: inv?.students?.full_name ?? null,
            });
          }),
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load payments");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  useEffect(() => {
    if (!scope) return;
    const filter =
      scope.mode === "school" && scope.schoolId
        ? `school_id=eq.${scope.schoolId}`
        : undefined;
    const channel = supabase
      .channel(`payment-tx-${scope.mode}-${scope.mode === "parent" ? scope.schoolId : scope.mode === "school" ? scope.schoolId : scope.studentId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "billing_payments",
          ...(filter ? { filter } : {}),
        },
        () => void fetchRows(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [scope, fetchRows]);

  return { rows, loading, error, refetch: fetchRows };
}
