import { supabase } from "@/integrations/supabase/client";
import { isSchemaColumnError } from "@/lib/schoolFetch";

export type FeeAssignmentRow = {
  id: string;
  fee_item_id: string;
  class_id: string | null;
  student_id: string | null;
  fee_items: {
    amount: number;
    currency: string;
    fee_categories: { name: string } | null;
    terms: { name: string; fees_due_date?: string | null } | null;
  } | null;
  classes: { name: string; stream?: string | null } | null;
  students: {
    full_name?: string | null;
    admission_number?: string | null;
    student_id?: string | null;
    first_name?: string | null;
    last_name?: string | null;
  } | null;
};

/** PostgREST errors are plain objects — normalize for React Query / UI. */
export function formatSupabaseError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === "object") {
    const e = error as { message?: string; details?: string; hint?: string; code?: string };
    const parts = [e.message, e.details, e.hint, e.code ? `(${e.code})` : ""].filter(Boolean);
    if (parts.length) return parts.join(" — ");
  }
  return "Unknown error";
}

function toThrownError(error: unknown): Error {
  return new Error(formatSupabaseError(error));
}

function isRecoverableSelectError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (isSchemaColumnError(error)) return true;
  const msg = (error.message ?? "").toLowerCase();
  return (
    error.code === "PGRST200" ||
    error.code === "42703" ||
    msg.includes("relationship") ||
    msg.includes("could not find") ||
    msg.includes("column")
  );
}

const SELECT_VARIANTS = [
  "id, fee_item_id, class_id, student_id, fee_items(amount, currency, fee_categories(name), terms(name, fees_due_date)), classes(name), students(admission_number, full_name)",
  "id, fee_item_id, class_id, student_id, fee_items(amount, currency, fee_categories(name), terms(name)), classes(name), students(admission_number, full_name)",
  "id, fee_item_id, class_id, student_id, fee_items(amount, currency, fee_categories(name), terms(name)), classes(name, stream), students(first_name, last_name, student_id)",
  "id, fee_item_id, class_id, student_id, fee_items(amount, currency, fee_categories(name), terms(name)), classes(name), students(student_id)",
  "id, fee_item_id, class_id, student_id, fee_items(amount, currency), classes(name), students(admission_number)",
  "id, fee_item_id, class_id, student_id",
] as const;

export function formatAssignmentStudentLabel(
  student: FeeAssignmentRow["students"]
): string {
  if (!student) return "Student";
  const name =
    student.full_name?.trim() ||
    [student.first_name, student.last_name].filter(Boolean).join(" ").trim() ||
    student.admission_number?.trim() ||
    student.student_id?.trim();
  const id = student.admission_number ?? student.student_id;
  return id && name && name !== id ? `${name} (${id})` : name || id || "Student";
}

export type InvoiceAssignableFee = {
  id: string;
  term_id: string;
  amount: number;
  currency: string;
  fee_categories: { name: string } | null;
  terms: { name: string } | null;
  assignmentSource: "student" | "class";
};

const ASSIGNMENT_FEE_SELECT_VARIANTS = [
  "fee_item_id, fee_items(id, term_id, amount, currency, fee_categories(name), terms(name))",
  "fee_item_id, fee_items(id, term_id, amount, currency, fee_categories(name))",
  "fee_item_id, fee_items(id, term_id, amount, currency)",
] as const;

type AssignmentFeeRow = {
  fee_item_id: string;
  fee_items: InvoiceAssignableFee | null;
};

async function queryAssignmentFees(
  filters: { schoolId: string; studentId?: string; classId?: string; classOnly?: boolean }
): Promise<AssignmentFeeRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const table = () => (supabase.from as any)("fee_assignments");

  let lastError: unknown = null;

  for (const select of ASSIGNMENT_FEE_SELECT_VARIANTS) {
    let q = table().select(select).eq("school_id", filters.schoolId);
    if (filters.studentId) q = q.eq("student_id", filters.studentId);
    if (filters.classId) q = q.eq("class_id", filters.classId);
    if (filters.classOnly) q = q.is("student_id", null);

    const result = await q;
    if (!result.error) return (result.data ?? []) as AssignmentFeeRow[];

    lastError = result.error;
    if (!isRecoverableSelectError(result.error)) break;
  }

  throw toThrownError(lastError);
}

/** Fees assigned to a student and/or their class — for invoice creation. */
export async function fetchInvoiceAssignableFees(
  schoolId: string,
  opts: { studentId: string; classId: string | null; termId?: string | null }
): Promise<InvoiceAssignableFee[]> {
  const [studentRows, classRows] = await Promise.all([
    queryAssignmentFees({ schoolId, studentId: opts.studentId }),
    opts.classId
      ? queryAssignmentFees({ schoolId, classId: opts.classId, classOnly: true })
      : Promise.resolve([]),
  ]);

  const unique = new Map<string, InvoiceAssignableFee>();

  for (const row of studentRows) {
    const fee = row.fee_items;
    if (!fee?.id) continue;
    unique.set(fee.id, {
      id: fee.id,
      term_id: fee.term_id,
      amount: Number(fee.amount),
      currency: fee.currency ?? "GHS",
      fee_categories: fee.fee_categories ?? null,
      terms: fee.terms ?? null,
      assignmentSource: "student",
    });
  }

  for (const row of classRows) {
    const fee = row.fee_items;
    if (!fee?.id || unique.has(fee.id)) continue;
    unique.set(fee.id, {
      id: fee.id,
      term_id: fee.term_id,
      amount: Number(fee.amount),
      currency: fee.currency ?? "GHS",
      fee_categories: fee.fee_categories ?? null,
      terms: fee.terms ?? null,
      assignmentSource: "class",
    });
  }

  const all = Array.from(unique.values());
  if (!opts.termId) return all;

  const forTerm = all.filter((fee) => fee.term_id === opts.termId);
  return forTerm.length > 0 ? forTerm : all;
}

export async function fetchFeeAssignments(schoolId: string): Promise<FeeAssignmentRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const table = () => (supabase.from as any)("fee_assignments");

  let lastError: unknown = null;

  for (const select of SELECT_VARIANTS) {
    const result = await table()
      .select(select)
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false });

    if (!result.error) {
      const rows = (result.data ?? []) as FeeAssignmentRow[];
      if (select === "id, fee_item_id, class_id, student_id") {
        return enrichBareAssignments(schoolId, rows);
      }
      return rows;
    }

    lastError = result.error;
    if (!isRecoverableSelectError(result.error)) break;
  }

  throw toThrownError(lastError);
}

async function fetchStudentsForAssignments(studentIds: string[]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fromStudents = () => (supabase.from as any)("students");
  for (const select of [
    "id, full_name, admission_number, student_id",
    "id, admission_number, student_id",
    "id, student_id",
  ]) {
    const { data, error } = await fromStudents().select(select).in("id", studentIds);
    if (!error) return data ?? [];
    if (!isRecoverableSelectError(error)) throw toThrownError(error);
  }
  return [];
}

async function enrichBareAssignments(
  schoolId: string,
  rows: FeeAssignmentRow[]
): Promise<FeeAssignmentRow[]> {
  if (rows.length === 0) return rows;

  const feeItemIds = [...new Set(rows.map((r) => r.fee_item_id))];
  const classIds = [...new Set(rows.map((r) => r.class_id).filter(Boolean))] as string[];
  const studentIds = [...new Set(rows.map((r) => r.student_id).filter(Boolean))] as string[];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const feeItemsQ = (supabase.from as any)("fee_items")
    .select("id, amount, currency, fee_categories(name), terms(name)")
    .eq("school_id", schoolId)
    .in("id", feeItemIds);

  const classesQ =
    classIds.length > 0
      ? supabase.from("classes").select("id, name").in("id", classIds)
      : Promise.resolve({ data: [], error: null });

  const studentsQ =
    studentIds.length > 0 ? fetchStudentsForAssignments(studentIds) : Promise.resolve([]);

  const [feeItemsRes, classesRes, studentsRes] = await Promise.all([
    feeItemsQ,
    classesQ,
    studentsQ,
  ]);

  if (feeItemsRes.error) throw toThrownError(feeItemsRes.error);
  if (classesRes.error) throw toThrownError(classesRes.error);

  const feeById = new Map((feeItemsRes.data ?? []).map((f: { id: string }) => [f.id, f]));
  const classById = new Map((classesRes.data ?? []).map((c: { id: string }) => [c.id, c]));
  const studentById = new Map(studentsRes.map((s: { id: string }) => [s.id, s]));

  return rows.map((row) => ({
    ...row,
    fee_items: (feeById.get(row.fee_item_id) as FeeAssignmentRow["fee_items"]) ?? null,
    classes: row.class_id ? ((classById.get(row.class_id) as FeeAssignmentRow["classes"]) ?? null) : null,
    students: row.student_id
      ? ((studentById.get(row.student_id) as FeeAssignmentRow["students"]) ?? null)
      : null,
  }));
}
