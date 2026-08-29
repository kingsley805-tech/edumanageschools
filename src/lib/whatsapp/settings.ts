import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_TEMPLATES,
  DEFAULT_WHATSAPP_SETTINGS,
  type WhatsAppSchoolSettings,
} from "@/lib/whatsapp/types";

const SETTINGS_COLUMNS =
  "id, school_id, whatsapp_enabled, whatsapp_provider, whatsapp_default_country_code, whatsapp_auto_send_fee_receipt, whatsapp_auto_send_fee_notification, whatsapp_auto_send_report_card, whatsapp_auto_send_weekly_attention, whatsapp_fee_receipt_template, whatsapp_fee_notification_template, whatsapp_report_card_template, whatsapp_weekly_attention_template, pos_terminal_enabled, pos_terminal_label, pos_require_reference, whatsapp_send_receipt_pdf, pos_enabled_payment_methods, pos_auto_print_receipt, pos_receipt_paper_width_mm";

function mapRow(row: Record<string, unknown> | null): WhatsAppSchoolSettings {
  if (!row) return { ...DEFAULT_WHATSAPP_SETTINGS };
  return {
    whatsapp_enabled: Boolean(row.whatsapp_enabled),
    whatsapp_provider: String(row.whatsapp_provider || "cloud_api"),
    whatsapp_default_country_code: String(row.whatsapp_default_country_code || "233"),
    whatsapp_auto_send_fee_receipt: row.whatsapp_auto_send_fee_receipt !== false,
    whatsapp_auto_send_fee_notification: Boolean(row.whatsapp_auto_send_fee_notification),
    whatsapp_auto_send_report_card: row.whatsapp_auto_send_report_card !== false,
    whatsapp_auto_send_weekly_attention: row.whatsapp_auto_send_weekly_attention !== false,
    whatsapp_fee_receipt_template: DEFAULT_TEMPLATES.fee_receipt,
    whatsapp_fee_notification_template: DEFAULT_TEMPLATES.fee_notification,
    whatsapp_report_card_template:
      (row.whatsapp_report_card_template as string | null) || DEFAULT_TEMPLATES.report_card,
    whatsapp_weekly_attention_template:
      (row.whatsapp_weekly_attention_template as string | null) ||
      DEFAULT_TEMPLATES.weekly_attention,
    pos_terminal_enabled: row.pos_terminal_enabled !== false,
    pos_terminal_label: String(row.pos_terminal_label || "POS Terminal"),
    pos_require_reference: row.pos_require_reference !== false,
    whatsapp_send_receipt_pdf: row.whatsapp_send_receipt_pdf !== false,
    pos_enabled_payment_methods: Array.isArray(row.pos_enabled_payment_methods)
      ? (row.pos_enabled_payment_methods as string[])
      : DEFAULT_WHATSAPP_SETTINGS.pos_enabled_payment_methods,
    pos_auto_print_receipt: Boolean(row.pos_auto_print_receipt),
    pos_receipt_paper_width_mm: Number(row.pos_receipt_paper_width_mm) || 80,
  };
}

export async function loadWhatsAppSchoolSettings(
  schoolId: string,
): Promise<WhatsAppSchoolSettings> {
  const { data, error } = await supabase
    .from("school_settings")
    .select(SETTINGS_COLUMNS)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (error) {
    // Columns may not exist yet before migration is applied
    if (/column|does not exist|schema cache/i.test(error.message)) {
      return { ...DEFAULT_WHATSAPP_SETTINGS };
    }
    throw error;
  }

  return mapRow(data as Record<string, unknown> | null);
}

export async function saveWhatsAppSchoolSettings(
  schoolId: string,
  patch: Partial<WhatsAppSchoolSettings>,
): Promise<void> {
  const { data: existing } = await supabase
    .from("school_settings")
    .select("id")
    .eq("school_id", schoolId)
    .maybeSingle();

  // Fee message copy is fixed system templates — never persist UI overrides.
  const {
    whatsapp_fee_receipt_template: _feeReceipt,
    whatsapp_fee_notification_template: _feeNotification,
    ...safePatch
  } = patch;

  const row = {
    school_id: schoolId,
    ...safePatch,
    whatsapp_fee_receipt_template: null,
    whatsapp_fee_notification_template: null,
    updated_at: new Date().toISOString(),
  };

  if (existing?.id) {
    const { error } = await supabase.from("school_settings").update(row).eq("id", existing.id);
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from("school_settings").insert(row);
  if (error) throw error;
}
