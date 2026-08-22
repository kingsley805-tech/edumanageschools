// @ts-nocheck
import { supabase } from "@/integrations/supabase/client";
import type { ManualPaymentMethod } from "@/billing/lib/recordManualPayment";

export type PosSchoolSettings = {
  enabledMethods: ManualPaymentMethod[];
  autoPrintReceipt: boolean;
  paperWidthMm: number;
  posTerminalEnabled: boolean;
  posTerminalLabel: string;
  posRequireReference: boolean;
  whatsappAutoSendFeeReceipt: boolean;
  whatsappSendReceiptPdf: boolean;
};

export const ALL_PAYMENT_METHODS: { value: ManualPaymentMethod; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "mobile_money", label: "Mobile Money" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "bank_deposit", label: "Bank Deposit" },
  { value: "card", label: "Card" },
  { value: "cheque", label: "Cheque" },
  { value: "pos_terminal", label: "POS Terminal" },
  { value: "other", label: "Other" },
];

const DEFAULT_METHODS: ManualPaymentMethod[] = [
  "cash",
  "mobile_money",
  "bank_transfer",
  "bank_deposit",
  "card",
  "cheque",
  "pos_terminal",
  "other",
];

export async function loadPosSchoolSettings(schoolId: string): Promise<PosSchoolSettings> {
  const { data, error } = await supabase
    .from("school_settings")
    .select(
      "pos_enabled_payment_methods, pos_auto_print_receipt, pos_receipt_paper_width_mm, pos_terminal_enabled, pos_terminal_label, pos_require_reference, whatsapp_auto_send_fee_receipt, whatsapp_send_receipt_pdf",
    )
    .eq("school_id", schoolId)
    .maybeSingle();

  if (error && !/column|does not exist|schema cache/i.test(error.message)) {
    throw error;
  }

  let enabledMethods = DEFAULT_METHODS;
  if (data?.pos_enabled_payment_methods && Array.isArray(data.pos_enabled_payment_methods)) {
    enabledMethods = data.pos_enabled_payment_methods.filter((m) =>
      ALL_PAYMENT_METHODS.some((o) => o.value === m),
    ) as ManualPaymentMethod[];
  }

  if (data?.pos_terminal_enabled === false) {
    enabledMethods = enabledMethods.filter((m) => m !== "pos_terminal");
  }

  if (enabledMethods.length === 0) {
    enabledMethods = ["cash", "mobile_money", "bank_transfer"];
  }

  return {
    enabledMethods,
    autoPrintReceipt: Boolean(data?.pos_auto_print_receipt),
    paperWidthMm: Number(data?.pos_receipt_paper_width_mm) || 80,
    posTerminalEnabled: data?.pos_terminal_enabled !== false,
    posTerminalLabel: String(data?.pos_terminal_label || "POS Terminal"),
    posRequireReference: data?.pos_require_reference !== false,
    whatsappAutoSendFeeReceipt: data?.whatsapp_auto_send_fee_receipt !== false,
    whatsappSendReceiptPdf: data?.whatsapp_send_receipt_pdf !== false,
  };
}
