import { supabase } from "@/integrations/supabase/client";
import { fetchStudentAttendanceRate } from "@/lib/attendance-queries";
import { formatMoney, normalizeCurrencyCode } from "@/lib/currency";

export type StudentEntityStats = {
  attendanceLabel: string;
  attendanceRate: number;
  termFeesLabel: string;
  feesPaidLabel: string;
  balanceLabel: string;
  termLabel: string;
  currency: string;
  totalFees: number;
  feesPaid: number;
  balance: number;
};

export type ClassEntityStats = {
  enrolled: number;
  attendanceLabel: string;
  subjectsLabel: string;
  subjectCount: number;
  capacityLabel: string;
};

export type TeacherEntityStats = {
  classCount: number;
  subjectCount: number;
  registersLabel: string;
  registersSubmitted: number;
};

export async function fetchCurrentTermLabel(schoolId: string | null | undefined): Promise<string> {
  if (!schoolId) return "—";
  const { data } = await supabase
    .from("terms")
    .select("name, academic_years(name)")
    .eq("school_id", schoolId)
    .eq("is_current", true)
    .maybeSingle();
  if (!data) return "—";
  const yearName = (data.academic_years as { name?: string } | null)?.name;
  return yearName ? `${data.name} (${yearName})` : String(data.name || "—");
}

export async function fetchStudentEntityStats(
  studentId: string,
  schoolId: string | null | undefined,
  currencyHint?: string | null,
): Promise<StudentEntityStats> {
  const currency = normalizeCurrencyCode(currencyHint);

  const [attendance, invoicesRes, termLabel, schoolRes] = await Promise.all([
    fetchStudentAttendanceRate(studentId),
    schoolId
      ? supabase
          .from("billing_invoices")
          .select("total_amount, amount_paid, balance_due, status, currency")
          .eq("student_id", studentId)
          .eq("school_id", schoolId)
      : Promise.resolve({ data: [] as Record<string, unknown>[], error: null }),
    fetchCurrentTermLabel(schoolId),
    schoolId
      ? supabase.from("schools").select("currency").eq("id", schoolId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  const schoolCurrency = normalizeCurrencyCode(
    (schoolRes.data as { currency?: string } | null)?.currency ?? currency,
  );

  const invoices = ((invoicesRes.data ?? []) as Array<{
    total_amount?: number | null;
    amount_paid?: number | null;
    balance_due?: number | null;
    status?: string | null;
    currency?: string | null;
  }>).filter((inv) => {
    const status = String(inv.status ?? "").toLowerCase();
    return !["draft", "void", "cancelled", "canceled"].includes(status);
  });

  let totalFees = 0;
  let feesPaid = 0;
  let balance = 0;
  for (const inv of invoices) {
    const total = Number(inv.total_amount ?? 0);
    const paid = Number(inv.amount_paid ?? 0);
    const due = Number(inv.balance_due ?? Math.max(0, total - paid));
    totalFees += total;
    feesPaid += paid;
    balance += due;
  }

  const displayCurrency =
    normalizeCurrencyCode(invoices[0]?.currency) !== "GHS" && invoices[0]?.currency
      ? normalizeCurrencyCode(invoices[0]?.currency)
      : schoolCurrency;

  return {
    attendanceRate: attendance.rate,
    attendanceLabel: attendance.total
      ? `${Math.round(attendance.rate)}%`
      : "—",
    termFeesLabel: formatMoney(totalFees, displayCurrency),
    feesPaidLabel: formatMoney(feesPaid, displayCurrency),
    balanceLabel: formatMoney(balance, displayCurrency),
    termLabel,
    currency: displayCurrency,
    totalFees,
    feesPaid,
    balance,
  };
}

export async function fetchClassEntityStats(
  classId: string,
  enrolledCount: number,
  capacity?: number | null,
): Promise<ClassEntityStats> {
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const sinceIso = since.toISOString().slice(0, 10);

  const [subjectsRes, attendanceRes] = await Promise.all([
    supabase
      .from("class_subjects")
      .select("id", { count: "exact", head: true })
      .eq("class_id", classId),
    supabase
      .from("attendance_records")
      .select("attendance_status")
      .eq("class_id", classId)
      .gte("attendance_date", sinceIso)
      .limit(5000),
  ]);

  const subjectCount = subjectsRes.count ?? 0;

  const rows = attendanceRes.data ?? [];
  let present = 0;
  for (const row of rows) {
    const status = String((row as { attendance_status?: string }).attendance_status ?? "").toLowerCase();
    if (status === "present" || status === "late") present += 1;
  }
  const attendanceLabel = rows.length
    ? `${Math.round((present / rows.length) * 100)}%`
    : "—";

  return {
    enrolled: enrolledCount,
    attendanceLabel,
    subjectCount,
    subjectsLabel: subjectCount > 0 ? String(subjectCount) : "—",
    capacityLabel: capacity != null && capacity > 0 ? `${capacity} seats` : "—",
  };
}

export async function fetchTeacherEntityStats(
  teacherId: string,
  classCount: number,
  subjectCount: number,
): Promise<TeacherEntityStats> {
  const monthStart = new Date();
  monthStart.setDate(1);
  const monthIso = monthStart.toISOString().slice(0, 10);

  const { count } = await supabase
    .from("class_registers")
    .select("id", { count: "exact", head: true })
    .eq("teacher_id", teacherId)
    .gte("register_date", monthIso)
    .in("status", ["submitted", "approved"]);

  const registersSubmitted = count ?? 0;

  return {
    classCount,
    subjectCount,
    registersSubmitted,
    registersLabel: String(registersSubmitted),
  };
}
