/** Normalize Ghana-style (and international) phone numbers for WhatsApp. */
export function normalizeWhatsAppPhone(
  raw: string | null | undefined,
  defaultCountry = "233",
): string | null {
  if (!raw?.trim()) return null;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  const cc = defaultCountry.replace(/\D/g, "") || "233";
  if (digits.startsWith(cc) && digits.length >= 11) return digits;
  if (digits.startsWith("0") && digits.length >= 10) return `${cc}${digits.slice(1)}`;
  let local = digits.startsWith("0") ? digits.slice(1) : digits;
  if (local.length >= 8 && local.length <= 10) return `${cc}${local}`;
  return local.length >= 10 ? local : null;
}

export function formatPhoneDisplay(normalized: string | null): string {
  if (!normalized) return "—";
  if (normalized.startsWith("233") && normalized.length >= 12) {
    return `0${normalized.slice(3)}`;
  }
  return `+${normalized}`;
}

export function applyWhatsAppTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? "");
}
