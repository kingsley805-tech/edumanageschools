import { supabase } from "@/integrations/supabase/client";
import { invokeEdgeFunction } from "@/lib/invokeEdgeFunction";
import { ensureReportCardPdfUrl } from "@/report/lib/report-card-pdf-share";
import type { SubjectRow } from "@/report/lib/shepherd-grading";
import { isMissingSchemaColumnError } from "@/report/lib/supabase-errors";

export type ReportCardSmsSettings = {
  sms_auto_send_report_card: boolean;
  sms_teacher_can_send_report_card: boolean;
  sms_report_card_template: string;
  sms_sender_id: string;
  whatsapp_default_country_code: string;
};

export const DEFAULT_SMS_REPORT_CARD_TEMPLATE =
  "{school_name}: {student_name}'s {term} report card is ready. Download PDF: {pdf_link}";

const DEFAULT_SETTINGS: ReportCardSmsSettings = {
  sms_auto_send_report_card: false,
  sms_teacher_can_send_report_card: false,
  sms_report_card_template: DEFAULT_SMS_REPORT_CARD_TEMPLATE,
  sms_sender_id: "",
  whatsapp_default_country_code: "233",
};

export async function loadReportCardSmsSettings(
  schoolId: string,
): Promise<ReportCardSmsSettings> {
  const { data, error } = await supabase
    .from("school_settings")
    .select(
      "sms_auto_send_report_card, sms_teacher_can_send_report_card, sms_report_card_template, sms_sender_id, whatsapp_default_country_code",
    )
    .eq("school_id", schoolId)
    .maybeSingle();

  if (error) {
    if (isMissingSchemaColumnError(error) || /column|does not exist|schema cache/i.test(error.message)) {
      return { ...DEFAULT_SETTINGS };
    }
    throw error;
  }

  const row = data as Record<string, unknown> | null;
  return {
    sms_auto_send_report_card: Boolean(row?.sms_auto_send_report_card),
    sms_teacher_can_send_report_card: Boolean(row?.sms_teacher_can_send_report_card),
    sms_report_card_template:
      (row?.sms_report_card_template as string | null)?.trim() || DEFAULT_SMS_REPORT_CARD_TEMPLATE,
    sms_sender_id: (row?.sms_sender_id as string | undefined)?.trim() || "",
    whatsapp_default_country_code:
      String(row?.whatsapp_default_country_code || "233").replace(/\D/g, "") || "233",
  };
}

export async function saveReportCardSmsSettings(
  schoolId: string,
  patch: Partial<
    Pick<
      ReportCardSmsSettings,
      "sms_auto_send_report_card" | "sms_teacher_can_send_report_card" | "sms_report_card_template"
    >
  >,
): Promise<void> {
  const row = {
    school_id: schoolId,
    ...patch,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase
    .from("school_settings")
    .upsert(row, { onConflict: "school_id" });
  if (error) throw error;
}

export type SendReportCardSmsResult = {
  sent: number;
  skipped: number;
  errors: string[];
  pdfUrl: string | null;
};

/**
 * Ensure PDF exists (client), then ask the Edge Function to derive recipients
 * and message server-side — never send those in the request body.
 */
export async function sendReportCardSms(opts: {
  schoolId: string;
  reportId: string;
  studentId: string;
  studentName: string;
  className?: string | null;
  termLabel?: string | null;
  academicYear?: string | null;
  classPosition?: string | null;
  subjects: SubjectRow[];
  teacherRemark?: string | null;
  existingPdfUrl?: string | null;
  senderRole: "admin" | "teacher";
  /** Manual click — bypasses auto-send toggle (still respects teacher permission). */
  force?: boolean;
}): Promise<SendReportCardSmsResult> {
  const settings = await loadReportCardSmsSettings(opts.schoolId);

  // Teachers: manual requires permission; auto-send requires school auto flag.
  if (opts.senderRole === "teacher") {
    if (opts.force && !settings.sms_teacher_can_send_report_card) {
      return {
        sent: 0,
        skipped: 1,
        errors: [
          "Teachers are not allowed to send report cards by SMS. Ask an admin to enable this in Settings.",
        ],
        pdfUrl: null,
      };
    }
    if (!opts.force && !settings.sms_auto_send_report_card) {
      return { sent: 0, skipped: 1, errors: [], pdfUrl: null };
    }
  } else if (!opts.force && !settings.sms_auto_send_report_card) {
    return { sent: 0, skipped: 1, errors: [], pdfUrl: null };
  }

  const { data: school } = await supabase
    .from("schools")
    .select("name, school_name")
    .eq("id", opts.schoolId)
    .maybeSingle();
  const schoolName =
    (school as { name?: string; school_name?: string } | null)?.name ||
    (school as { school_name?: string } | null)?.school_name ||
    "School";

  const pdfUrl = await ensureReportCardPdfUrl({
    reportId: opts.reportId,
    schoolId: opts.schoolId,
    existingUrl: opts.existingPdfUrl,
    schoolName,
    studentName: opts.studentName,
    className: opts.className,
    termLabel: opts.termLabel,
    academicYear: opts.academicYear,
    classPosition: opts.classPosition,
    subjects: opts.subjects,
    teacherRemark: opts.teacherRemark,
  });

  if (!pdfUrl) {
    return {
      sent: 0,
      skipped: 1,
      errors: ["Could not create a PDF download link for this report card."],
      pdfUrl: null,
    };
  }

  try {
    const result = await invokeEdgeFunction<{
      ok?: boolean;
      sent?: number;
      skipped?: number;
      errors?: string[];
      error?: string;
    }>("send-report-card-sms", {
      school_id: opts.schoolId,
      report_id: opts.reportId,
      sender_role: opts.senderRole,
      force: opts.force === true,
    });

    if (result.errors?.length) {
      console.error("Report card SMS errors:", result.errors);
    }

    return {
      sent: result.sent ?? 0,
      skipped: result.skipped ?? 0,
      errors: result.errors ?? (result.error ? [result.error] : []),
      pdfUrl,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "SMS send failed";
    console.error("Report card SMS invoke failed:", msg);
    return {
      sent: 0,
      skipped: 1,
      errors: [msg],
      pdfUrl,
    };
  }
}

/** Load report row fields needed for SMS and send. */
export async function sendReportCardSmsForReportId(opts: {
  reportId: string;
  senderRole: "admin" | "teacher";
  force?: boolean;
}): Promise<SendReportCardSmsResult> {
  const { data, error } = await supabase
    .from("term_report_cards")
    .select(
      "id, school_id, student_id, student_name, class_name, term_label, academic_year, class_position, subjects, teacher_remark, report_pdf_url",
    )
    .eq("id", opts.reportId)
    .single();

  if (error) {
    if (isMissingSchemaColumnError(error)) {
      const { data: row2, error: err2 } = await supabase
        .from("term_report_cards")
        .select(
          "id, school_id, student_id, student_name, class_name, term_label, academic_year, class_position, subjects, teacher_remark",
        )
        .eq("id", opts.reportId)
        .single();
      if (err2) throw err2;
      return sendReportCardSms({
        schoolId: row2.school_id,
        reportId: row2.id,
        studentId: row2.student_id,
        studentName: row2.student_name,
        className: row2.class_name,
        termLabel: row2.term_label,
        academicYear: row2.academic_year,
        classPosition: row2.class_position,
        subjects: (row2.subjects as SubjectRow[]) ?? [],
        teacherRemark: row2.teacher_remark,
        senderRole: opts.senderRole,
        force: opts.force,
      });
    }
    throw error;
  }

  return sendReportCardSms({
    schoolId: data.school_id,
    reportId: data.id,
    studentId: data.student_id,
    studentName: data.student_name,
    className: data.class_name,
    termLabel: data.term_label,
    academicYear: data.academic_year,
    classPosition: data.class_position,
    subjects: (data.subjects as SubjectRow[]) ?? [],
    teacherRemark: data.teacher_remark,
    existingPdfUrl: (data as { report_pdf_url?: string | null }).report_pdf_url,
    senderRole: opts.senderRole,
    force: opts.force,
  });
}
