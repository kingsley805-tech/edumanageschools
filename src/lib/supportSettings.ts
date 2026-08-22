import { supabase } from "@/integrations/supabase/client";

export type SupportContactSettings = {
  phonePrimary: string;
  phoneSecondary: string | null;
  email: string;
};

const DEFAULT_SUPPORT: SupportContactSettings = {
  phonePrimary: "+233 50 368 8781",
  phoneSecondary: "+233 50 323 0804",
  email: "edumanagesystems@gmail.com",
};

const SUPPORT_KEYS = [
  "support_phone_primary",
  "support_phone_secondary",
  "support_email",
] as const;

function isMissingRelationError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const msg = (error.message ?? "").toLowerCase();
  return (
    error.code === "PGRST205" ||
    error.code === "42P01" ||
    msg.includes("could not find the table") ||
    msg.includes("does not exist")
  );
}

export function phoneToTelHref(phone: string): string {
  return `tel:${phone.replace(/\s+/g, "")}`;
}

export function phoneToWhatsAppHref(phone: string, message?: string): string {
  const digits = phone.replace(/[^0-9]/g, "");
  const text = message
    ? encodeURIComponent(message)
    : encodeURIComponent(
        "Hello EduManage Team, I need assistance with my administrator registration or account verification.",
      );
  return `https://wa.me/${digits}?text=${text}`;
}

export async function fetchSupportContactSettings(): Promise<SupportContactSettings> {
  try {
    const { data, error } = await supabase
      .from("system_settings" as never)
      .select("key, value")
      .in("key", [...SUPPORT_KEYS]);

    if (error) {
      if (isMissingRelationError(error as { code?: string; message?: string })) {
        return DEFAULT_SUPPORT;
      }
      return DEFAULT_SUPPORT;
    }

    const rows = (data ?? []) as { key: string; value: string }[];
    const map = new Map(rows.map((r) => [r.key, r.value]));

    return {
      phonePrimary: map.get("support_phone_primary")?.trim() || DEFAULT_SUPPORT.phonePrimary,
      phoneSecondary: map.get("support_phone_secondary")?.trim() || DEFAULT_SUPPORT.phoneSecondary,
      email: map.get("support_email")?.trim() || DEFAULT_SUPPORT.email,
    };
  } catch {
    return DEFAULT_SUPPORT;
  }
}
