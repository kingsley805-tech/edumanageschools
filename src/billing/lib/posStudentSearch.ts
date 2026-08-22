// @ts-nocheck
import { supabase } from "@/integrations/supabase/client";
import { formatStudentDisplayName, fetchStudentsWithLinkedProfiles } from "@/billing/lib/studentDisplayName";
import {
  resolveStudentParentWhatsAppContacts,
  validWhatsAppContacts,
} from "@/lib/whatsapp/parentContacts";
import { loadWhatsAppSchoolSettings } from "@/lib/whatsapp/settings";
import type { ParentWhatsAppContact } from "@/lib/whatsapp/types";

export type PosStudentSummary = {
  id: string;
  studentId: string;
  admissionNumber: string;
  displayName: string;
  classId: string | null;
  className: string;
};

export type PosOpenInvoice = {
  id: string;
  invoiceNumber: string;
  balance: number;
  amountPaid: number;
  totalAmount: number;
  currency: string;
  dueDate: string;
  termId: string | null;
  termName: string | null;
  academicYear: string | null;
  feeCategory: string | null;
  status: string;
};

export type PosStudentContext = {
  student: PosStudentSummary;
  parentContacts: ParentWhatsAppContact[];
  primaryParent: ParentWhatsAppContact | null;
  parentDisplayName: string | null;
  parentWhatsApp: string | null;
  parentId: string | null;
  invoices: PosOpenInvoice[];
  recentPayments: {
    id: string;
    amount: number;
    currency: string;
    method: string;
    paidAt: string | null;
    receiptNumber: string | null;
  }[];
};

type IndexedStudent = PosStudentSummary & {
  searchText: string;
  parentNames: string[];
  parentPhones: string[];
};

let cachedIndex: { schoolId: string; students: IndexedStudent[] } | null = null;

function normalizeSearch(s: string): string {
  return s.trim().toLowerCase();
}

async function buildStudentIndex(schoolId: string): Promise<IndexedStudent[]> {
  const [studentRows, classesResult] = await Promise.all([
    fetchStudentsWithLinkedProfiles(schoolId),
    supabase.from("classes").select("id, name, stream, level").eq("school_id", schoolId),
  ]);

  const studentIds = studentRows.map((s) => s.id);
  let linksResult: { data: unknown[] | null } = { data: [] };
  if (studentIds.length > 0) {
    linksResult = await supabase
      .from("parent_student_links")
      .select(
        "student_id, relationship, parents(id, phone, whatsapp_number, emergency_contact, profiles:user_id(full_name, phone))",
      )
      .in("student_id", studentIds);
  }

  const classMap = new Map(
    (classesResult.data ?? []).map((c) => [
      c.id,
      [c.name, c.stream].filter(Boolean).join(" ") || c.name,
    ]),
  );

  const parentsByStudent = new Map<string, { names: string[]; phones: string[] }>();

  for (const link of linksResult.data ?? []) {
    const row = link as {
      student_id: string;
      parents?: {
        phone?: string | null;
        whatsapp_number?: string | null;
        emergency_contact?: string | null;
        profiles?: { full_name?: string | null; phone?: string | null } | null;
      } | null;
    };
    if (!row.student_id || !row.parents) continue;
    const entry = parentsByStudent.get(row.student_id) ?? { names: [], phones: [] };
    const name = row.parents.profiles?.full_name?.trim();
    if (name) entry.names.push(name);
    for (const p of [
      row.parents.whatsapp_number,
      row.parents.phone,
      row.parents.profiles?.phone,
      row.parents.emergency_contact,
    ]) {
      if (p?.trim()) entry.phones.push(p.trim());
    }
    parentsByStudent.set(row.student_id, entry);
  }

  return studentRows.map((s) => {
    const displayName = formatStudentDisplayName(
      { first_name: s.first_name, last_name: s.last_name, student_id: s.student_id },
      s.linkedProfile,
    );
    const admission = (s.admission_no ?? s.student_id ?? "").trim();
    const parentInfo = parentsByStudent.get(s.id) ?? { names: [], phones: [] };
    const searchParts = [
      displayName,
      s.student_id,
      admission,
      s.id,
      ...parentInfo.names,
      ...parentInfo.phones,
    ];
    return {
      id: s.id,
      studentId: s.student_id,
      admissionNumber: admission || s.id.slice(0, 8),
      displayName,
      classId: s.class_id,
      className: s.class_id ? classMap.get(s.class_id) ?? "—" : "—",
      searchText: searchParts.join(" ").toLowerCase(),
      parentNames: parentInfo.names,
      parentPhones: parentInfo.phones,
    };
  });
}

export async function ensurePosStudentIndex(schoolId: string): Promise<IndexedStudent[]> {
  if (cachedIndex?.schoolId === schoolId) return cachedIndex.students;
  const students = await buildStudentIndex(schoolId);
  cachedIndex = { schoolId, students };
  return students;
}

export function invalidatePosStudentIndex(): void {
  cachedIndex = null;
}

export async function searchPosStudents(
  schoolId: string,
  query: string,
  limit = 20,
): Promise<PosStudentSummary[]> {
  const q = normalizeSearch(query);
  const index = await ensurePosStudentIndex(schoolId);
  if (!q) return index.slice(0, limit).map(({ searchText: _s, parentNames: _n, parentPhones: _p, ...rest }) => rest);
  return index
    .filter((s) => s.searchText.includes(q))
    .slice(0, limit)
    .map(({ searchText: _s, parentNames: _n, parentPhones: _p, ...rest }) => rest);
}

export async function loadPosStudentContext(
  schoolId: string,
  studentId: string,
): Promise<PosStudentContext | null> {
  const index = await ensurePosStudentIndex(schoolId);
  const student = index.find((s) => s.id === studentId);
  if (!student) return null;

  const settings = await loadWhatsAppSchoolSettings(schoolId);
  const contacts = await resolveStudentParentWhatsAppContacts(
    studentId,
    settings.whatsapp_default_country_code,
  );
  const valid = validWhatsAppContacts(contacts);
  const primary = valid[0] ?? contacts[0] ?? null;

  const { data: invoicesRaw, error: invoicesErr } = await supabase
    .from("billing_invoices")
    .select(
      "id, invoice_number, total_amount, amount_paid, balance_due, currency, due_date, status, term_id, notes, terms:term_id(name, academic_year_id, academic_years:academic_year_id(name))",
    )
    .eq("school_id", schoolId)
    .eq("student_id", studentId)
    .in("status", ["draft", "sent", "partially_paid", "overdue", "viewed"])
    .order("due_date");

  if (invoicesErr) throw invoicesErr;

  const invoices: PosOpenInvoice[] = (invoicesRaw ?? [])
    .map((i) => {
      const term = i.terms as {
        name?: string;
        academic_years?: { name?: string } | null;
      } | null;
      const balance = Number(i.balance_due ?? Number(i.total_amount) - Number(i.amount_paid));
      return {
        id: i.id,
        invoiceNumber: i.invoice_number,
        balance: Math.max(0, balance),
        amountPaid: Number(i.amount_paid),
        totalAmount: Number(i.total_amount),
        currency: i.currency,
        dueDate: i.due_date,
        termId: i.term_id,
        termName: term?.name ?? null,
        academicYear: term?.academic_years?.name ?? null,
        feeCategory: i.notes?.trim() || null,
        status: i.status,
      };
    })
    .filter((i) => i.balance > 0 && i.status !== "void");

  const { data: recentRaw } = await supabase
    .from("billing_payments")
    .select("id, amount, currency, method, paid_at, receipt_number, gateway_ref")
    .eq("school_id", schoolId)
    .eq("student_id", studentId)
    .eq("gateway", "manual")
    .eq("status", "paid")
    .order("paid_at", { ascending: false })
    .limit(5);

  const recentPayments = (recentRaw ?? []).map((p) => ({
    id: p.id,
    amount: Number(p.amount),
    currency: p.currency,
    method: p.method,
    paidAt: p.paid_at,
    receiptNumber: p.receipt_number ?? p.gateway_ref,
  }));

  return {
    student: {
      id: student.id,
      studentId: student.studentId,
      admissionNumber: student.admissionNumber,
      displayName: student.displayName,
      classId: student.classId,
      className: student.className,
    },
    parentContacts: contacts,
    primaryParent: primary,
    parentDisplayName: primary?.fullName ?? contacts[0]?.fullName ?? null,
    parentWhatsApp: primary?.phoneNormalized ?? null,
    parentId: primary?.parentId ?? contacts[0]?.parentId ?? null,
    invoices,
    recentPayments,
  };
}
