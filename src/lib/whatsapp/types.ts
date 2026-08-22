export type WhatsAppMessageType =
  | "fee_receipt"
  | "fee_notification"
  | "report_card"
  | "weekly_attention"
  | "custom";

export type WhatsAppDeliveryStatus =
  | "pending"
  | "queued"
  | "sending"
  | "sent"
  | "delivered"
  | "failed"
  | "skipped";

export type WhatsAppSchoolSettings = {
  whatsapp_enabled: boolean;
  whatsapp_provider: string;
  whatsapp_default_country_code: string;
  whatsapp_auto_send_fee_receipt: boolean;
  whatsapp_auto_send_fee_notification: boolean;
  whatsapp_auto_send_report_card: boolean;
  whatsapp_auto_send_weekly_attention: boolean;
  whatsapp_fee_receipt_template: string | null;
  whatsapp_fee_notification_template: string | null;
  whatsapp_report_card_template: string | null;
  whatsapp_weekly_attention_template: string | null;
  pos_terminal_enabled: boolean;
  pos_terminal_label: string;
  pos_require_reference: boolean;
  whatsapp_send_receipt_pdf?: boolean;
  pos_enabled_payment_methods?: string[];
  pos_auto_print_receipt?: boolean;
  pos_receipt_paper_width_mm?: number;
};

export type ParentWhatsAppContact = {
  parentId: string;
  userId: string | null;
  fullName: string | null;
  phoneRaw: string | null;
  phoneNormalized: string | null;
  relationship?: string | null;
  source: "whatsapp_number" | "phone" | "profile_phone" | "emergency_contact" | "none";
};

export const DEFAULT_WHATSAPP_SETTINGS: WhatsAppSchoolSettings = {
  whatsapp_enabled: false,
  whatsapp_provider: "cloud_api",
  whatsapp_default_country_code: "233",
  whatsapp_auto_send_fee_receipt: true,
  whatsapp_auto_send_fee_notification: false,
  whatsapp_auto_send_report_card: true,
  whatsapp_auto_send_weekly_attention: true,
  whatsapp_fee_receipt_template: null,
  whatsapp_fee_notification_template: null,
  whatsapp_report_card_template: null,
  whatsapp_weekly_attention_template: null,
  pos_terminal_enabled: true,
  pos_terminal_label: "POS Terminal",
  pos_require_reference: true,
  whatsapp_send_receipt_pdf: true,
  pos_enabled_payment_methods: ["cash", "mobile_money", "bank_transfer", "bank_deposit", "card", "cheque", "pos_terminal", "other"],
  pos_auto_print_receipt: false,
  pos_receipt_paper_width_mm: 80,
};

export const DEFAULT_TEMPLATES = {
  fee_receipt:
    "{school_name}: {fee_type} payment of {amount} received for {student_name} (Invoice {invoice_number}) via {method} on {paid_time}. Receipt ref: {reference}. Balance: {balance}.",
  fee_notification:
    "{school_name}: Fee reminder for {student_name}. Outstanding balance: {balance}. Please settle at your earliest convenience.",
  report_card:
    "{school_name}: {student_name}'s {term_label} report card is now available. Open your parent portal to view or download it.",
  weekly_attention:
    "{school_name} — Weekly Attention\nStudent: {student_name}\nClass: {class_name}\nWeek: {week_label}\nTeacher: {teacher_name}\n\n{attention_summary}{academic_block}{behaviour_block}{recommendations_block}",
};
