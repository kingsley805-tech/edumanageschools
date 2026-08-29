import { supabase } from "@/integrations/supabase/client";
import { applyWhatsAppTemplate } from "@/lib/whatsapp/phone";
import { formatReceiptPaidTime } from "@/billing/lib/paymentTransactions";
import {
  describeMissingWhatsApp,
  resolveStudentParentWhatsAppContacts,
  validWhatsAppContacts,
} from "@/lib/whatsapp/parentContacts";
import { loadWhatsAppSchoolSettings } from "@/lib/whatsapp/settings";
import {
  DEFAULT_TEMPLATES,
  type ParentWhatsAppContact,
  type WhatsAppMessageType,
} from "@/lib/whatsapp/types";

export type QueueWhatsAppResult = {
  queued: number;
  skipped: number;
  deliveryIds: string[];
  errors: string[];
  contacts: ParentWhatsAppContact[];
};

async function invokeSendWhatsApp(payload: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("send-whatsapp", { body: payload });
  if (error) throw error;
  return data as { ok?: boolean; sent?: number; results?: unknown[]; error?: string };
}

/** Queue + process WhatsApp to all valid linked parent contacts for a student. */
export async function queueStudentWhatsApp(opts: {
  schoolId: string;
  studentId: string;
  messageType: WhatsAppMessageType;
  messageBody: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  documentUrl?: string | null;
  createdBy?: string | null;
  force?: boolean;
  /** Prefer a single parent; otherwise all valid contacts */
  parentId?: string | null;
  idempotencyPrefix?: string;
}): Promise<QueueWhatsAppResult> {
  const settings = await loadWhatsAppSchoolSettings(opts.schoolId);
  const errors: string[] = [];

  if (!settings.whatsapp_enabled) {
    return {
      queued: 0,
      skipped: 1,
      deliveryIds: [],
      errors: ["WhatsApp is disabled in Administration Settings. Enable it to send messages."],
      contacts: [],
    };
  }

  const contacts = await resolveStudentParentWhatsAppContacts(
    opts.studentId,
    settings.whatsapp_default_country_code,
  );
  let targets = validWhatsAppContacts(contacts);
  if (opts.parentId) {
    targets = targets.filter((c) => c.parentId === opts.parentId);
  }

  if (targets.length === 0) {
    errors.push(describeMissingWhatsApp(contacts));
    // Record a failed delivery so admins see it in the log
    const { data: failed } = await supabase
      .from("whatsapp_deliveries")
      .insert({
        school_id: opts.schoolId,
        student_id: opts.studentId,
        parent_id: contacts[0]?.parentId ?? null,
        message_type: opts.messageType,
        related_entity_type: opts.relatedEntityType ?? null,
        related_entity_id: opts.relatedEntityId ?? null,
        message_body: opts.messageBody,
        status: "failed",
        error_message: errors[0],
        created_by: opts.createdBy ?? null,
        metadata: { contacts_found: contacts.length },
      })
      .select("id")
      .maybeSingle();

    return {
      queued: 0,
      skipped: 1,
      deliveryIds: failed?.id ? [failed.id] : [],
      errors,
      contacts,
    };
  }

  const deliveryIds: string[] = [];
  let queued = 0;
  let skipped = 0;

  for (const contact of targets) {
    const idempotencyKey = opts.idempotencyPrefix
      ? `${opts.idempotencyPrefix}:${contact.parentId}:${opts.messageType}`
      : null;

    try {
      const result = await invokeSendWhatsApp({
        school_id: opts.schoolId,
        student_id: opts.studentId,
        parent_id: contact.parentId,
        recipient_phone: contact.phoneNormalized,
        recipient_name: contact.fullName,
        message_type: opts.messageType,
        related_entity_type: opts.relatedEntityType ?? null,
        related_entity_id: opts.relatedEntityId ?? null,
        message_body: opts.messageBody,
        document_url: opts.documentUrl ?? null,
        idempotency_key: idempotencyKey,
        force: opts.force ?? false,
        metadata: { source: contact.source },
      });

      if (result?.error) {
        errors.push(result.error);
        skipped += 1;
        continue;
      }

      const firstId = (result as { results?: Array<{ id?: string }> })?.results?.[0]?.id;
      if (firstId) deliveryIds.push(firstId);
      queued += 1;
    } catch (err) {
      errors.push(err instanceof Error ? err.message : "Failed to queue WhatsApp");
      skipped += 1;
    }
  }

  return { queued, skipped, deliveryIds, errors, contacts };
}

export async function resendWhatsAppDelivery(deliveryId: string): Promise<void> {
  await supabase
    .from("whatsapp_deliveries")
    .update({
      status: "queued",
      error_message: null,
      queued_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", deliveryId);

  const result = await invokeSendWhatsApp({ delivery_id: deliveryId, force: true });
  if (result?.error) throw new Error(result.error);
}

export async function sendFeeReceiptWhatsApp(opts: {
  schoolId: string;
  studentId: string;
  studentName: string;
  amount: string;
  currency: string;
  method: string;
  invoiceNumber: string;
  balance: string;
  reference: string;
  paidAt: string;
  paymentId: string;
  feeType?: string | null;
  createdBy?: string | null;
  force?: boolean;
  documentUrl?: string | null;
}): Promise<QueueWhatsAppResult> {
  const settings = await loadWhatsAppSchoolSettings(opts.schoolId);
  if (!settings.whatsapp_auto_send_fee_receipt && !opts.force) {
    return { queued: 0, skipped: 1, deliveryIds: [], errors: [], contacts: [] };
  }

  const { data: school } = await supabase
    .from("schools")
    .select("school_name")
    .eq("id", opts.schoolId)
    .maybeSingle();

  const paidTime = formatReceiptPaidTime(opts.paidAt);
  const body = applyWhatsAppTemplate(DEFAULT_TEMPLATES.fee_receipt, {
      school_name: school?.school_name || "School",
      student_name: opts.studentName,
      amount: `${opts.currency} ${opts.amount}`,
      method: opts.method,
      invoice_number: opts.invoiceNumber,
      balance: `${opts.currency} ${opts.balance}`,
      reference: opts.reference || "—",
      fee_type: opts.feeType?.trim() || "School fee",
      paid_time: paidTime,
      date: paidTime,
    },
  );

  return queueStudentWhatsApp({
    schoolId: opts.schoolId,
    studentId: opts.studentId,
    messageType: "fee_receipt",
    messageBody: body,
    relatedEntityType: "billing_payment",
    relatedEntityId: opts.paymentId,
    documentUrl: opts.documentUrl ?? null,
    createdBy: opts.createdBy,
    force: opts.force,
    idempotencyPrefix: `fee_receipt:${opts.paymentId}`,
  });
}

export async function sendFeeNotificationWhatsApp(opts: {
  schoolId: string;
  studentId: string;
  studentName: string;
  balance: string;
  currency: string;
  invoiceNumber?: string;
  invoiceId?: string;
  createdBy?: string | null;
  force?: boolean;
}): Promise<QueueWhatsAppResult> {
  const settings = await loadWhatsAppSchoolSettings(opts.schoolId);
  if (!settings.whatsapp_auto_send_fee_notification && !opts.force) {
    return { queued: 0, skipped: 1, deliveryIds: [], errors: [], contacts: [] };
  }

  const { data: school } = await supabase
    .from("schools")
    .select("school_name")
    .eq("id", opts.schoolId)
    .maybeSingle();

  const body = applyWhatsAppTemplate(DEFAULT_TEMPLATES.fee_notification, {
      school_name: school?.school_name || "School",
      student_name: opts.studentName,
      balance: `${opts.currency} ${opts.balance}`,
      invoice_number: opts.invoiceNumber || "—",
    },
  );

  return queueStudentWhatsApp({
    schoolId: opts.schoolId,
    studentId: opts.studentId,
    messageType: "fee_notification",
    messageBody: body,
    relatedEntityType: opts.invoiceId ? "billing_invoice" : undefined,
    relatedEntityId: opts.invoiceId,
    createdBy: opts.createdBy,
    force: opts.force,
    idempotencyPrefix: opts.invoiceId
      ? `fee_notification:${opts.invoiceId}`
      : `fee_notification:${opts.studentId}:${Date.now()}`,
  });
}

export async function sendReportCardWhatsApp(opts: {
  schoolId: string;
  studentId: string;
  studentName: string;
  className?: string | null;
  termLabel?: string | null;
  reportId: string;
  createdBy?: string | null;
  force?: boolean;
}): Promise<QueueWhatsAppResult> {
  const settings = await loadWhatsAppSchoolSettings(opts.schoolId);
  if (!settings.whatsapp_auto_send_report_card && !opts.force) {
    return { queued: 0, skipped: 1, deliveryIds: [], errors: [], contacts: [] };
  }

  const { data: school } = await supabase
    .from("schools")
    .select("school_name")
    .eq("id", opts.schoolId)
    .maybeSingle();

  const body = applyWhatsAppTemplate(
    settings.whatsapp_report_card_template || DEFAULT_TEMPLATES.report_card,
    {
      school_name: school?.school_name || "School",
      student_name: opts.studentName,
      class_name: opts.className || "—",
      term_label: opts.termLabel || "term",
    },
  );

  return queueStudentWhatsApp({
    schoolId: opts.schoolId,
    studentId: opts.studentId,
    messageType: "report_card",
    messageBody: body,
    relatedEntityType: "term_report_card",
    relatedEntityId: opts.reportId,
    createdBy: opts.createdBy,
    force: opts.force,
    idempotencyPrefix: `report_card:${opts.reportId}`,
  });
}

export async function sendWeeklyAttentionWhatsApp(opts: {
  schoolId: string;
  studentId: string;
  studentName: string;
  className?: string | null;
  teacherName?: string | null;
  weekLabel: string;
  attentionSummary: string;
  academicNotes?: string | null;
  behaviouralNotes?: string | null;
  recommendations?: string | null;
  reportId: string;
  createdBy?: string | null;
  force?: boolean;
}): Promise<QueueWhatsAppResult> {
  const settings = await loadWhatsAppSchoolSettings(opts.schoolId);
  if (!settings.whatsapp_auto_send_weekly_attention && !opts.force) {
    return { queued: 0, skipped: 1, deliveryIds: [], errors: [], contacts: [] };
  }

  const { data: school } = await supabase
    .from("schools")
    .select("school_name")
    .eq("id", opts.schoolId)
    .maybeSingle();

  const academicBlock = opts.academicNotes?.trim()
    ? `\n\nAcademic notes:\n${opts.academicNotes.trim()}`
    : "";
  const behaviourBlock = opts.behaviouralNotes?.trim()
    ? `\n\nBehavioural notes:\n${opts.behaviouralNotes.trim()}`
    : "";
  const recommendationsBlock = opts.recommendations?.trim()
    ? `\n\nRecommendations:\n${opts.recommendations.trim()}`
    : "";

  const body = applyWhatsAppTemplate(
    settings.whatsapp_weekly_attention_template || DEFAULT_TEMPLATES.weekly_attention,
    {
      school_name: school?.school_name || "School",
      student_name: opts.studentName,
      class_name: opts.className || "—",
      week_label: opts.weekLabel,
      teacher_name: opts.teacherName || "Class Teacher",
      attention_summary: opts.attentionSummary,
      academic_block: academicBlock,
      behaviour_block: behaviourBlock,
      recommendations_block: recommendationsBlock,
    },
  );

  return queueStudentWhatsApp({
    schoolId: opts.schoolId,
    studentId: opts.studentId,
    messageType: "weekly_attention",
    messageBody: body,
    relatedEntityType: "weekly_attention_report",
    relatedEntityId: opts.reportId,
    createdBy: opts.createdBy,
    force: opts.force,
    idempotencyPrefix: `weekly_attention:${opts.reportId}`,
  });
}
