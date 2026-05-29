// @ts-nocheck
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useBillingAuth } from "@/billing/hooks/useBillingAuth";
import { useSchoolInfo } from "@/hooks/useSchoolInfo";
import { BILLING_DASHBOARD_STATS_REFETCH_EVENT } from "@/billing/lib/billingDashboardSync";

function parseMemberCountsPayload(data: unknown): {
  students: number;
  parents: number;
  teachers: number;
  accountants: number;
} {
  const fallback = { students: 0, parents: 0, teachers: 0, accountants: 0 };
  if (data == null || data === "") return fallback;
  let obj: Record<string, unknown> | null = null;
  if (typeof data === "string") {
    try {
      obj = JSON.parse(data) as Record<string, unknown>;
    } catch {
      return fallback;
    }
  } else if (typeof data === "object") {
    obj = data as Record<string, unknown>;
  }
  if (!obj) return fallback;
  const asNum = (v: unknown): number => {
    if (typeof v === "number" && !Number.isNaN(v)) return Math.max(0, Math.floor(v));
    if (typeof v === "string" && v.trim() !== "") {
      const n = Number(v);
      return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
    }
    return 0;
  };
  return {
    students: asNum(obj.students),
    parents: asNum(obj.parents),
    teachers: asNum(obj.teachers),
    accountants: asNum(obj.accountants),
  };
}

export interface BillingDashboardStats {
  totalBilled: number;
  totalCollected: number;
  outstandingBalance: number;
  overdueFees: number;
  totalStudents: number;
  totalParents: number;
  totalTeachers: number;
  totalAccountants: number;
  feesDueThisWeek: number;
  collectionRate: number;
  defaulterCount: number;
  currency: string;
  schoolName: string;
  collectionsByMonth: { month: string; online: number; manual: number }[];
  totalMonthlyPayrollLiability: number;
  payrollPaidThisMonth: number;
  payrollPendingThisMonth: number;
  loading: boolean;
}

export function useBillingDashboardData(): BillingDashboardStats {
  const { schoolId, loading: authLoading } = useBillingAuth();
  const { currentSchool } = useSchoolInfo();
  const [stats, setStats] = useState<BillingDashboardStats>({
    totalBilled: 0,
    totalCollected: 0,
    outstandingBalance: 0,
    overdueFees: 0,
    totalStudents: 0,
    totalParents: 0,
    totalTeachers: 0,
    totalAccountants: 0,
    feesDueThisWeek: 0,
    collectionRate: 0,
    defaulterCount: 0,
    currency: "GHS",
    schoolName: "",
    collectionsByMonth: [],
    totalMonthlyPayrollLiability: 0,
    payrollPaidThisMonth: 0,
    payrollPendingThisMonth: 0,
    loading: true,
  });

  const fetchStats = useCallback(async () => {
    if (!schoolId) return;
    const now = new Date();

    const curYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const [invoicesRes, paymentsRes, memberCountsRes, payrollCfgRes, salariesRes] = await Promise.all([
      supabase
        .from("billing_invoices")
        .select("id, total_amount, amount_paid, balance_due, status, due_date, created_at, student_id")
        .eq("school_id", schoolId),
      supabase
        .from("billing_payments")
        .select("amount, status, paid_at, created_at, gateway")
        .eq("school_id", schoolId)
        .eq("status", "paid"),
      supabase.rpc("school_dashboard_billing_counts" as never, { _school_id: schoolId } as never),
      supabase
        .from("teacher_payroll_config")
        .select("base_monthly_salary, default_allowances, default_deductions")
        .eq("school_id", schoolId),
      supabase
        .from("staff_salaries")
        .select("amount, status, month")
        .eq("school_id", schoolId),
    ]);

    const memberCounts = parseMemberCountsPayload(memberCountsRes.data);
    const invoices = invoicesRes.data || [];
    const payments = paymentsRes.data || [];
    const currency =
      (currentSchool as { currency?: string } | null)?.currency?.trim() ||
      invoices[0]?.currency ||
      "GHS";
    const schoolName =
      currentSchool?.name?.trim() ||
      currentSchool?.school_name?.trim() ||
      "Your school";

    const totalBilled = invoices.reduce((s, i) => s + Number(i.total_amount), 0);
    const totalCollected = payments.reduce((s, p) => s + Number(p.amount), 0);
    const outstandingBalance = invoices.reduce(
      (s, i) =>
        s +
        Number(
          i.balance_due ??
            Math.max(0, Number(i.total_amount) - Number(i.amount_paid || 0)),
        ),
      0,
    );

    const overdueInvoices = invoices.filter(
      (i) =>
        i.status === "overdue" ||
        (new Date(i.due_date) < now && !["paid", "void"].includes(i.status)),
    );
    const overdueFees = overdueInvoices.reduce(
      (s, i) =>
        s +
        Number(
          i.balance_due ??
            Math.max(0, Number(i.total_amount) - Number(i.amount_paid || 0)),
        ),
      0,
    );

    const oneWeek = new Date(now.getTime() + 7 * 86400000);
    const dueThisWeek = invoices.filter((i) => {
      const d = new Date(i.due_date);
      return d >= now && d <= oneWeek && !["paid", "void"].includes(i.status);
    });
    const feesDueThisWeek = dueThisWeek.reduce(
      (s, i) =>
        s +
        Number(
          i.balance_due ??
            Math.max(0, Number(i.total_amount) - Number(i.amount_paid || 0)),
        ),
      0,
    );

    const defaulterStudents = new Set(
      overdueInvoices.map((i) => i.student_id).filter(Boolean),
    );
    const collectionRate = totalBilled > 0 ? (totalCollected / totalBilled) * 100 : 0;

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const collectionsByMonth: { month: string; online: number; manual: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth();
      let online = 0;
      let manual = 0;
      for (const p of payments) {
        const pd = new Date(p.paid_at || p.created_at);
        if (pd.getFullYear() === y && pd.getMonth() === m) {
          const g = String(p.gateway || "").toLowerCase();
          if (g === "manual") manual += Number(p.amount || 0);
          else online += Number(p.amount || 0);
        }
      }
      collectionsByMonth.push({ month: monthNames[m].slice(0, 3), online, manual });
    }

    const cfgRows = payrollCfgRes.data ?? [];
    const totalMonthlyPayrollLiability = cfgRows.reduce((sum, r) => {
      const base = Number(r.base_monthly_salary || 0);
      const al = Number(r.default_allowances || 0);
      const de = Number(r.default_deductions || 0);
      return sum + Math.max(0, base + al - de);
    }, 0);
    const salaryRows = salariesRes.data ?? [];
    const payrollPaidThisMonth = salaryRows
      .filter((r) => r.month === curYm && r.status === "paid")
      .reduce((s, r) => s + Number(r.amount || 0), 0);
    const payrollPendingThisMonth = Math.max(0, totalMonthlyPayrollLiability - payrollPaidThisMonth);

    setStats({
      totalBilled,
      totalCollected,
      outstandingBalance,
      overdueFees,
      totalStudents: memberCounts.students,
      totalParents: memberCounts.parents,
      totalTeachers: memberCounts.teachers,
      totalAccountants: memberCounts.accountants,
      feesDueThisWeek,
      collectionRate,
      defaulterCount: defaulterStudents.size,
      currency,
      schoolName,
      collectionsByMonth,
      totalMonthlyPayrollLiability,
      payrollPaidThisMonth,
      payrollPendingThisMonth,
      loading: false,
    });
  }, [schoolId, currentSchool]);

  useEffect(() => {
    if (!schoolId || authLoading) return;
    void fetchStats();

    const onExternalRefetch = () => void fetchStats();
    window.addEventListener(BILLING_DASHBOARD_STATS_REFETCH_EVENT, onExternalRefetch);

    const channel = supabase
      .channel(`billing-dashboard:${schoolId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "billing_invoices", filter: `school_id=eq.${schoolId}` },
        () => void fetchStats(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "billing_payments", filter: `school_id=eq.${schoolId}` },
        () => void fetchStats(),
      )
      .subscribe();

    return () => {
      window.removeEventListener(BILLING_DASHBOARD_STATS_REFETCH_EVENT, onExternalRefetch);
      void supabase.removeChannel(channel);
    };
  }, [fetchStats, schoolId, authLoading]);

  return { ...stats, loading: stats.loading || authLoading };
}