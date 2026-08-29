// @ts-nocheck
import { supabase } from "@/integrations/supabase/client";
import {
  createBillingInvoiceWithRetry,
  insertBillingInvoiceLineItems,
} from "@/billing/lib/invoices";
import { buildPosInvoiceNumber } from "@/billing/lib/posInvoiceFees";
import { mapStudentIdsToDisplayNames, fetchStudentsWithLinkedProfiles, formatStudentDisplayName } from "@/billing/lib/studentDisplayName";
import { fetchInvoiceAssignableFees } from "@/billing/lib/fee-assignments";
import { fetchStudentsForParent } from "@/lib/parent-students";
import { queueStudentWhatsApp } from "@/lib/whatsapp/send";
import { loadWhatsAppSchoolSettings } from "@/lib/whatsapp/settings";
import { applyWhatsAppTemplate } from "@/lib/whatsapp/phone";
import { DEFAULT_TEMPLATES } from "@/lib/whatsapp/types";
import { formatMoney } from "@/lib/currency";

export const FAMILY_INVOICE_PREFIX = "FAMILY_PARENT:";

export type FamilyParentOption = {
  id: string;
  name: string;
  phone: string | null;
  childCount: number;
};

export type FamilyChildInvoice = {
  id: string;
  invoiceNumber: string;
  studentId: string;
  studentName: string;
  className: string;
  balance: number;
  totalAmount: number;
  amountPaid: number;
  currency: string;
  dueDate: string;
  status: string;
};

export type FamilyInvoiceSummary = {
  id: string;
  invoiceNumber: string;
  totalAmount: number;
  balance: number;
  amountPaid: number;
  currency: string;
  dueDate: string;
  status: string;
  childNames: string[];
};

export type FamilyClassOption = {
  id: string;
  name: string;
  stream: string | null;
  label: string;
};

export type FamilyStudentRow = {
  id: string;
  name: string;
  classId: string;
  className: string;
  admission: string;
};

export type FamilyClassFee = {
  id: string;
  termId: string;
  termName: string;
  feeName: string;
  amount: number;
  currency: string;
  classLabels: string[];
};

export type FamilyParentCandidate = {
  id: string;
  name: string;
  phone: string | null;
  linkedStudentIds: string[];
};

export type FamilyInvoiceLinePreview = {
  studentId: string;
  studentName: string;
  className: string;
  feeName: string;
  amount: number;
  currency: string;
};

function familyNoteFromFees(parentId: string, childIds: string[], feeItemIds: string[]) {
  return `${FAMILY_INVOICE_PREFIX}${parentId}|children=${childIds.join(",")}|fees=${feeItemIds.join(",")}`;
}

function familyNote(parentId: string, childIds: string[], sourceIds: string[]) {
  return `${FAMILY_INVOICE_PREFIX}${parentId}|children=${childIds.join(",")}|sources=${sourceIds.join(",")}`;
}

export function parseFamilyInvoiceNote(notes: string | null): {
  parentId: string;
  childIds: string[];
  sourceIds: string[];
} | null {
  if (!notes?.startsWith(FAMILY_INVOICE_PREFIX)) return null;
  const rest = notes.slice(FAMILY_INVOICE_PREFIX.length);
  const [parentId, ...parts] = rest.split("|");
  if (!parentId) return null;
  const childIds =
    parts
      .find((p) => p.startsWith("children="))
      ?.slice("children=".length)
      .split(",")
      .filter(Boolean) ?? [];
  const sourceIds =
    parts
      .find((p) => p.startsWith("sources="))
      ?.slice("sources=".length)
      .split(",")
      .filter(Boolean) ?? [];
  return { parentId, childIds, sourceIds };
}

export async function fetchFamilyParents(schoolId: string): Promise<FamilyParentOption[]> {
  const { data: parents, error } = await supabase
    .from("parents")
    .select("id, phone, user_id")
    .eq("school_id", schoolId);

  if (error) throw error;
  if (!parents?.length) return [];

  const userIds = parents.map((p) => p.user_id).filter(Boolean) as string[];
  const nameMap = new Map<string, string>();
  if (userIds.length) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, phone")
      .in("id", userIds);
    for (const p of profiles ?? []) {
      nameMap.set(p.id, p.full_name?.trim() || "Parent");
    }
  }

  const { data: links } = await supabase
    .from("parent_student_links")
    .select("parent_id")
    .in(
      "parent_id",
      parents.map((p) => p.id),
    );

  const childCount = new Map<string, number>();
  for (const link of links ?? []) {
    childCount.set(link.parent_id, (childCount.get(link.parent_id) ?? 0) + 1);
  }

  return parents
    .map((p) => ({
      id: p.id,
      name: (p.user_id && nameMap.get(p.user_id)) || "Parent",
      phone: p.phone,
      childCount: childCount.get(p.id) ?? 0,
    }))
    .filter((p) => p.childCount > 0)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function fetchChildInvoicesForParent(
  schoolId: string,
  parentId: string,
): Promise<FamilyChildInvoice[]> {
  const children = await fetchStudentsForParent<{
    id: string;
    full_name?: string;
    first_name?: string;
    last_name?: string;
    admission_no?: string;
    admission_number?: string;
    classes?: { name?: string } | null;
  }>(
    parentId,
    "id, full_name, first_name, last_name, admission_no, admission_number, class_id, classes(name)",
  );

  const studentIds = children.map((c) => c.id);
  if (!studentIds.length) return [];

  const nameFor = (c: (typeof children)[0]) =>
    c.full_name?.trim() ||
    [c.first_name, c.last_name].filter(Boolean).join(" ").trim() ||
    c.admission_no?.trim() ||
    c.admission_number?.trim() ||
    "Student";

  const { data: invoices, error } = await supabase
    .from("billing_invoices")
    .select(
      "id, invoice_number, student_id, total_amount, amount_paid, balance_due, currency, due_date, status, notes",
    )
    .eq("school_id", schoolId)
    .in("student_id", studentIds)
    .in("status", ["draft", "sent", "partially_paid", "overdue", "viewed"])
    .order("due_date");

  if (error) throw error;

  const childMap = new Map(children.map((c) => [c.id, c]));

  return (invoices ?? [])
    .filter((inv) => !parseFamilyInvoiceNote(inv.notes))
    .map((inv) => {
      const child = childMap.get(inv.student_id!);
      const balance = Number(
        inv.balance_due ?? Math.max(0, Number(inv.total_amount) - Number(inv.amount_paid)),
      );
      return {
        id: inv.id,
        invoiceNumber: inv.invoice_number,
        studentId: inv.student_id!,
        studentName: child ? nameFor(child) : "Student",
        className: child?.classes?.name ?? "—",
        balance: Math.max(0, balance),
        totalAmount: Number(inv.total_amount),
        amountPaid: Number(inv.amount_paid),
        currency: inv.currency ?? "GHS",
        dueDate: inv.due_date,
        status: inv.status,
      };
    })
    .filter((inv) => inv.balance > 0);
}

export async function fetchFamilyInvoicesForParent(
  schoolId: string,
  parentId: string,
): Promise<FamilyInvoiceSummary[]> {
  const { data, error } = await supabase
    .from("billing_invoices")
    .select(
      "id, invoice_number, total_amount, amount_paid, balance_due, currency, due_date, status, notes",
    )
    .eq("school_id", schoolId)
    .ilike("notes", `${FAMILY_INVOICE_PREFIX}${parentId}%`)
    .neq("status", "void")
    .order("created_at", { ascending: false });

  if (error) throw error;

  const childIds = [
    ...new Set(
      (data ?? []).flatMap((inv) => parseFamilyInvoiceNote(inv.notes)?.childIds ?? []),
    ),
  ];
  const nameMap = childIds.length
    ? await mapStudentIdsToDisplayNames(schoolId, childIds)
    : new Map<string, string>();

  return (data ?? []).map((inv) => {
    const parsed = parseFamilyInvoiceNote(inv.notes);
    const balance = Number(
      inv.balance_due ?? Math.max(0, Number(inv.total_amount) - Number(inv.amount_paid)),
    );
    return {
      id: inv.id,
      invoiceNumber: inv.invoice_number,
      totalAmount: Number(inv.total_amount),
      balance: Math.max(0, balance),
      amountPaid: Number(inv.amount_paid),
      currency: inv.currency ?? "GHS",
      dueDate: inv.due_date,
      status: inv.status,
      childNames: (parsed?.childIds ?? []).map((id) => nameMap.get(id) ?? "Student"),
    };
  });
}

export async function createFamilyInvoiceForParent(input: {
  schoolId: string;
  parentId: string;
  parentName: string;
  invoiceIds: string[];
  dueDate: string;
  issuedBy: string;
}): Promise<{ invoiceId: string; invoiceNumber: string }> {
  if (!input.invoiceIds.length) {
    throw new Error("Select at least one student invoice.");
  }

  const openInvoices = await fetchChildInvoicesForParent(input.schoolId, input.parentId);
  const selected = openInvoices.filter((inv) => input.invoiceIds.includes(inv.id));
  if (selected.length !== input.invoiceIds.length) {
    throw new Error("Some selected invoices are no longer available.");
  }

  const total = selected.reduce((sum, inv) => sum + inv.balance, 0);
  if (total <= 0) {
    throw new Error("Selected invoices have no outstanding balance.");
  }

  const childIds = [...new Set(selected.map((inv) => inv.studentId))];
  const currency = selected[0]?.currency ?? "GHS";
  const invoiceNumber = `FAM-${buildPosInvoiceNumber()}`;

  const invoiceId = await createBillingInvoiceWithRetry({
    schoolId: input.schoolId,
    studentId: childIds[0],
    termId: null,
    invoiceNumber,
    status: "sent",
    currency,
    total,
    dueDate: input.dueDate,
    issuedBy: input.issuedBy,
  });

  await supabase
    .from("billing_invoices")
    .update({
      notes: familyNote(input.parentId, childIds, selected.map((s) => s.id)),
    })
    .eq("id", invoiceId);

  await insertBillingInvoiceLineItems(
    invoiceId,
    selected.map((inv) => ({
      description: `${inv.studentName} — ${inv.invoiceNumber}`,
      amount: inv.balance,
    })),
  );

  for (const src of selected) {
    const { data: row } = await supabase
      .from("billing_invoices")
      .select("notes")
      .eq("id", src.id)
      .single();
    const mergedNote = [row?.notes, `Merged into family invoice ${invoiceNumber}`]
      .filter(Boolean)
      .join("\n");
    await supabase
      .from("billing_invoices")
      .update({ status: "void", notes: mergedNote })
      .eq("id", src.id);
  }

  return { invoiceId, invoiceNumber };
}

export async function fetchFamilyInvoicesForParentPortal(
  schoolId: string,
  parentId: string,
) {
  const rows = await fetchFamilyInvoicesForParent(schoolId, parentId);
  return rows.map((r) => ({
    id: r.id,
    invoice_number: r.invoiceNumber,
    total_amount: r.totalAmount,
    amount_paid: r.amountPaid,
    balance_due: r.balance,
    status: r.status,
    due_date: r.dueDate,
    currency: r.currency,
    child_names: r.childNames,
  }));
}

export function isFamilyInvoiceNote(notes: string | null | undefined): boolean {
  return Boolean(notes?.startsWith(FAMILY_INVOICE_PREFIX));
}

export async function fetchFamilyClasses(schoolId: string): Promise<FamilyClassOption[]> {
  const { data, error } = await supabase
    .from("classes")
    .select("id, name, stream")
    .eq("school_id", schoolId)
    .order("name");

  if (error) throw error;

  return (data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    stream: c.stream,
    label: `${c.name}${c.stream ? ` ${c.stream}` : ""}`,
  }));
}

export async function fetchStudentsForClassIds(
  schoolId: string,
  classIds: string[],
): Promise<FamilyStudentRow[]> {
  if (!classIds.length) return [];

  const all = await fetchStudentsWithLinkedProfiles(schoolId);
  const classSet = new Set(classIds);

  const { data: classes } = await supabase
    .from("classes")
    .select("id, name, stream")
    .in("id", classIds);

  const classLabel = new Map<string, string>();
  for (const c of classes ?? []) {
    classLabel.set(c.id, `${c.name}${c.stream ? ` ${c.stream}` : ""}`);
  }

  return all
    .filter((s) => s.class_id && classSet.has(s.class_id))
    .map((s) => ({
      id: s.id,
      name: formatStudentDisplayName(s, s.linkedProfile),
      classId: s.class_id!,
      className: classLabel.get(s.class_id!) ?? "—",
      admission: s.student_id,
    }))
    .sort((a, b) => a.className.localeCompare(b.className) || a.name.localeCompare(b.name));
}

export async function fetchClassFeesForClassIds(
  schoolId: string,
  classIds: string[],
): Promise<FamilyClassFee[]> {
  if (!classIds.length) return [];

  const { data: classes } = await supabase
    .from("classes")
    .select("id, name, stream")
    .in("id", classIds);

  const classLabel = new Map<string, string>();
  for (const c of classes ?? []) {
    classLabel.set(c.id, `${c.name}${c.stream ? ` ${c.stream}` : ""}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from as any)("fee_assignments")
    .select(
      "class_id, fee_item_id, fee_items(id, term_id, amount, currency, fee_categories(name), terms(name))",
    )
    .eq("school_id", schoolId)
    .in("class_id", classIds)
    .is("student_id", null);

  if (error) throw error;

  const byFee = new Map<string, FamilyClassFee>();

  for (const row of data ?? []) {
    const fee = row.fee_items;
    if (!fee?.id) continue;
    const label = classLabel.get(row.class_id) ?? "Class";
    const existing = byFee.get(fee.id);
    if (existing) {
      if (!existing.classLabels.includes(label)) existing.classLabels.push(label);
      continue;
    }
    byFee.set(fee.id, {
      id: fee.id,
      termId: fee.term_id,
      termName: fee.terms?.name ?? "Term",
      feeName: fee.fee_categories?.name ?? "Fee",
      amount: Number(fee.amount),
      currency: fee.currency ?? "GHS",
      classLabels: [label],
    });
  }

  return Array.from(byFee.values()).sort(
    (a, b) => a.termName.localeCompare(b.termName) || a.feeName.localeCompare(b.feeName),
  );
}

export async function fetchParentsForStudentIds(
  schoolId: string,
  studentIds: string[],
): Promise<FamilyParentCandidate[]> {
  if (!studentIds.length) return [];

  const parentLinks = new Map<string, Set<string>>();

  const { data: links } = await supabase
    .from("parent_student_links")
    .select("parent_id, student_id")
    .in("student_id", studentIds);

  for (const link of links ?? []) {
    if (!link.parent_id || !link.student_id) continue;
    if (!parentLinks.has(link.parent_id)) parentLinks.set(link.parent_id, new Set());
    parentLinks.get(link.parent_id)!.add(link.student_id);
  }

  const { data: students } = await supabase
    .from("students")
    .select("id, guardian_id")
    .in("id", studentIds);

  for (const st of students ?? []) {
    if (!st.guardian_id) continue;
    if (!parentLinks.has(st.guardian_id)) parentLinks.set(st.guardian_id, new Set());
    parentLinks.get(st.guardian_id)!.add(st.id);
  }

  const parentIds = [...parentLinks.keys()];
  if (!parentIds.length) return [];

  const { data: parents, error } = await supabase
    .from("parents")
    .select("id, phone, user_id")
    .eq("school_id", schoolId)
    .in("id", parentIds);

  if (error) throw error;

  const userIds = (parents ?? []).map((p) => p.user_id).filter(Boolean) as string[];
  const nameMap = new Map<string, string>();
  if (userIds.length) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);
    for (const p of profiles ?? []) {
      nameMap.set(p.id, p.full_name?.trim() || "Parent");
    }
  }

  return (parents ?? [])
    .map((p) => ({
      id: p.id,
      name: (p.user_id && nameMap.get(p.user_id)) || "Parent",
      phone: p.phone,
      linkedStudentIds: [...(parentLinks.get(p.id) ?? [])],
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function previewFamilyInvoiceLines(
  schoolId: string,
  students: FamilyStudentRow[],
  feeItemIds: string[],
): Promise<FamilyInvoiceLinePreview[]> {
  if (!students.length || !feeItemIds.length) return [];

  const feeSet = new Set(feeItemIds);
  const lines: FamilyInvoiceLinePreview[] = [];

  for (const student of students) {
    const fees = await fetchInvoiceAssignableFees(schoolId, {
      studentId: student.id,
      classId: student.classId,
    });
    for (const fee of fees) {
      if (!feeSet.has(fee.id)) continue;
      lines.push({
        studentId: student.id,
        studentName: student.name,
        className: student.className,
        feeName: fee.fee_categories?.name ?? "Fee",
        amount: fee.amount,
        currency: fee.currency,
      });
    }
  }

  return lines;
}

export async function resolveFamilyInvoiceParentId(
  studentIds: string[],
  selectedParentId?: string | null,
): Promise<string> {
  if (selectedParentId) return selectedParentId;

  const { data: students } = await supabase
    .from("students")
    .select("id, guardian_id")
    .in("id", studentIds);

  const guardianId = (students ?? []).find((s) => s.guardian_id)?.guardian_id;
  if (guardianId) return guardianId;

  const { data: link } = await supabase
    .from("parent_student_links")
    .select("parent_id")
    .in("student_id", studentIds)
    .limit(1)
    .maybeSingle();

  if (link?.parent_id) return link.parent_id;

  throw new Error("Assign a linked parent or set a guardian on the selected students.");
}

export async function createFamilyInvoiceFromFees(input: {
  schoolId: string;
  parentId?: string | null;
  parentName: string;
  students: FamilyStudentRow[];
  feeItemIds: string[];
  dueDate: string;
  issuedBy: string;
  termId?: string | null;
}): Promise<{ invoiceId: string; invoiceNumber: string; lineItems: FamilyInvoiceLinePreview[]; total: number; currency: string; parentId: string }> {
  const lines = await previewFamilyInvoiceLines(input.schoolId, input.students, input.feeItemIds);
  if (!lines.length) {
    throw new Error("No billable fees for the selected students and class fees.");
  }

  const total = lines.reduce((sum, line) => sum + line.amount, 0);
  if (total <= 0) throw new Error("Invoice total must be greater than zero.");

  const childIds = [...new Set(lines.map((l) => l.studentId))];
  const parentId = await resolveFamilyInvoiceParentId(childIds, input.parentId);
  const currency = lines[0]?.currency ?? "GHS";
  const invoiceNumber = `FAM-${buildPosInvoiceNumber()}`;

  const invoiceId = await createBillingInvoiceWithRetry({
    schoolId: input.schoolId,
    studentId: childIds[0],
    termId: input.termId ?? null,
    invoiceNumber,
    status: "sent",
    currency,
    total,
    dueDate: input.dueDate,
    issuedBy: input.issuedBy,
  });

  await supabase
    .from("billing_invoices")
    .update({
      notes: familyNoteFromFees(parentId, childIds, input.feeItemIds),
    })
    .eq("id", invoiceId);

  await insertBillingInvoiceLineItems(
    invoiceId,
    lines.map((line) => ({
      description: `${line.studentName} (${line.className}) — ${line.feeName}`,
      amount: line.amount,
    })),
  );

  return { invoiceId, invoiceNumber, lineItems: lines, total, currency, parentId };
}

export async function notifyFamilyInvoiceWhatsApp(opts: {
  schoolId: string;
  parentId: string;
  studentId: string;
  invoiceId: string;
  invoiceNumber: string;
  childNames: string[];
  total: number;
  currency: string;
  dueDate: string;
  createdBy?: string | null;
  force?: boolean;
  manualPhone?: string | null;
}) {
  const settings = await loadWhatsAppSchoolSettings(opts.schoolId);
  const { data: school } = await supabase
    .from("schools")
    .select("school_name")
    .eq("id", opts.schoolId)
    .maybeSingle();

  const childLabel = opts.childNames.join(", ") || "your children";
  const body = applyWhatsAppTemplate(DEFAULT_TEMPLATES.fee_notification, {
      school_name: school?.school_name || "School",
      student_name: childLabel,
      balance: formatMoney(opts.total, opts.currency),
      invoice_number: opts.invoiceNumber,
    },
  );

  if (opts.manualPhone?.trim()) {
    const { error } = await supabase.functions.invoke("send-whatsapp", {
      body: {
        school_id: opts.schoolId,
        student_id: opts.studentId,
        parent_id: opts.parentId,
        recipient_phone: opts.manualPhone.trim(),
        message_type: "fee_notification",
        related_entity_type: "billing_invoice",
        related_entity_id: opts.invoiceId,
        message_body: body,
        force: opts.force ?? true,
      },
    });
    if (error) throw error;
    return { queued: 1, errors: [] as string[] };
  }

  const result = await queueStudentWhatsApp({
    schoolId: opts.schoolId,
    studentId: opts.studentId,
    parentId: opts.parentId,
    messageType: "fee_notification",
    messageBody: body,
    relatedEntityType: "billing_invoice",
    relatedEntityId: opts.invoiceId,
    createdBy: opts.createdBy,
    force: opts.force ?? true,
    idempotencyPrefix: `family_invoice:${opts.invoiceId}`,
  });

  return { queued: result.queued, errors: result.errors };
}
