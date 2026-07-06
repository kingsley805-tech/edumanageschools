import { supabase } from "@/integrations/supabase/client";
import { isMissingRpcError, isMissingSchemaTableError } from "@/report/lib/supabase-errors";

export const PAYROLL_SETUP_SQL_PATH = "public/sql/apply-payroll-module.sql";
export const PAYROLL_SETUP_SQL_URL =
  "https://supabase.com/dashboard/project/xbhhpjtwawfawifhpxbe/sql/new";

export type PayrollTeacherRow = {
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  admission_number: string;
  class_label: string;
  subject_label: string | null;
  base_monthly_salary: number;
  default_allowances: number;
  default_deductions: number;
  payment_bank_name?: string | null;
  payment_bank_code?: string | null;
  payment_account_number?: string | null;
  payment_account_holder?: string | null;
  payment_mobile_money_number?: string | null;
  payment_mobile_money_provider?: string | null;
  payment_notes?: string | null;
  preferred_payout_method?: string | null;
};

function splitFullName(fullName: string | null | undefined) {
  const trimmed = (fullName ?? "").trim();
  const space = trimmed.indexOf(" ");
  if (space < 0) return { first_name: trimmed, last_name: "" };
  return {
    first_name: trimmed.slice(0, space),
    last_name: trimmed.slice(space + 1).trim(),
  };
}

async function fetchTeachersForPayrollFallback(
  schoolId: string,
): Promise<PayrollTeacherRow[]> {
  const [teachersRes, cfgRes, bankRes] = await Promise.all([
    supabase
      .from("teachers")
      .select("user_id, employee_no, subject_specialty, profiles(email, full_name, phone)")
      .eq("school_id", schoolId),
    supabase.from("teacher_payroll_config").select("*").eq("school_id", schoolId),
    supabase.from("staff_bank_accounts").select("*").eq("school_id", schoolId),
  ]);

  if (teachersRes.error) {
    if (isMissingSchemaTableError(teachersRes.error)) {
      throw new Error(
        `Payroll is not set up. Run ${PAYROLL_SETUP_SQL_PATH} in Supabase SQL Editor, then Settings → API → Reload schema.`,
      );
    }
    throw teachersRes.error;
  }

  const cfgMap = new Map((cfgRes.data ?? []).map((row) => [row.staff_user_id, row]));
  const bankMap = new Map((bankRes.data ?? []).map((row) => [row.staff_user_id, row]));

  const classIds = [
    ...new Set((cfgRes.data ?? []).map((row) => row.class_id).filter(Boolean)),
  ] as string[];
  const classMap = new Map<string, string>();
  if (classIds.length) {
    const { data: classes } = await supabase
      .from("classes")
      .select("id, name, stream")
      .in("id", classIds);
    for (const cls of classes ?? []) {
      classMap.set(cls.id, [cls.name, cls.stream].filter(Boolean).join(" "));
    }
  }

  return (teachersRes.data ?? [])
    .filter((row) => row.user_id)
    .map((row) => {
      const profile = row.profiles as {
        email?: string;
        full_name?: string;
        phone?: string;
      } | null;
      const cfg = cfgMap.get(row.user_id);
      const bank = bankMap.get(row.user_id);
      const { first_name, last_name } = splitFullName(profile?.full_name);

      return {
        user_id: row.user_id,
        email: profile?.email ?? "",
        first_name,
        last_name,
        phone: profile?.phone ?? null,
        admission_number: row.employee_no ?? "",
        class_label: cfg?.class_id ? classMap.get(cfg.class_id) ?? "" : "",
        subject_label: cfg?.subject_label ?? row.subject_specialty ?? null,
        base_monthly_salary: Number(cfg?.base_monthly_salary ?? 0),
        default_allowances: Number(cfg?.default_allowances ?? 0),
        default_deductions: Number(cfg?.default_deductions ?? 0),
        payment_bank_name: bank?.bank_name ?? null,
        payment_bank_code: bank?.bank_code ?? null,
        payment_account_number: bank?.account_number ?? null,
        payment_account_holder: bank?.account_name ?? null,
        payment_mobile_money_number: bank?.mobile_money_number ?? null,
        payment_mobile_money_provider: bank?.mobile_money_provider ?? null,
        payment_notes: bank?.payment_notes ?? null,
        preferred_payout_method: bank?.preferred_payout_method ?? null,
      } satisfies PayrollTeacherRow;
    });
}

/** Loads payroll teacher rows via RPC, with a direct-table fallback when SQL is not applied yet. */
export async function fetchTeachersForPayroll(schoolId: string): Promise<PayrollTeacherRow[]> {
  const { data, error } = await supabase.rpc("list_teachers_for_payroll", {
    p_school_id: schoolId,
  });

  if (!error) return (data ?? []) as PayrollTeacherRow[];

  if (isMissingRpcError(error)) {
    return fetchTeachersForPayrollFallback(schoolId);
  }

  throw error;
}

export function isPayrollSetupError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    message.includes(PAYROLL_SETUP_SQL_PATH) ||
    message.includes("apply-payroll-module") ||
    lower.includes("payroll is not set up") ||
    (lower.includes("schema cache") &&
      (lower.includes("staff_salaries") ||
        lower.includes("teacher_payroll_config") ||
        lower.includes("staff_bank_accounts") ||
        lower.includes("list_teachers_for_payroll")))
  );
}

export function getPayrollSetupMessage(error: unknown): string {
  return `Payroll is not set up. Run ${PAYROLL_SETUP_SQL_PATH} in Supabase SQL Editor, then Settings → API → Reload schema.`;
}

export function throwIfPayrollSetupMissing(error: unknown): never {
  if (isMissingSchemaTableError(error as { code?: string; message?: string } | null)) {
    throw new Error(getPayrollSetupMessage(error));
  }
  const msg = error instanceof Error ? error.message : String(error ?? "");
  if (isPayrollSetupError(msg)) {
    throw new Error(getPayrollSetupMessage(error));
  }
  throw error instanceof Error ? error : new Error(msg);
}

export type StaffSalaryRow = {
  id: string;
  staff_user_id: string;
  month: string;
  amount: number;
  allowances: number | null;
  deductions: number | null;
  status: string;
  method: string;
  gateway: string;
  gateway_ref: string | null;
  paid_at: string | null;
  notes: string | null;
  payout_snapshot: Record<string, unknown> | null;
};

const STAFF_SALARY_SELECT =
  "id, staff_user_id, month, amount, allowances, deductions, status, method, gateway, gateway_ref, paid_at, notes, payout_snapshot";

/** Loads staff salary rows for a school, with a clear error when payroll tables are missing. */
export async function fetchStaffSalaries(schoolId: string): Promise<StaffSalaryRow[]> {
  const { data, error } = await supabase
    .from("staff_salaries")
    .select(STAFF_SALARY_SELECT)
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false });

  if (error) throwIfPayrollSetupMissing(error);
  return (data ?? []) as StaffSalaryRow[];
}
