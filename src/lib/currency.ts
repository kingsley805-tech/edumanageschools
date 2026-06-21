const CURRENCY_SYMBOLS: Record<string, string> = {
  GHS: "₵",
  USD: "$",
  EUR: "€",
  GBP: "£",
  NGN: "₦",
  KES: "KSh",
  ZAR: "R",
  XOF: "CFA",
  XAF: "FCFA",
  CAD: "CA$",
  AUD: "A$",
  INR: "₹",
  JPY: "¥",
  CNY: "¥",
};

export function normalizeCurrencyCode(code?: string | null): string {
  const c = (code ?? "GHS").trim().toUpperCase();
  return c || "GHS";
}

/** Symbol for display (e.g. GHS → ₵, USD → $) */
export function getCurrencySymbol(currencyCode?: string | null, locale = "en"): string {
  const code = normalizeCurrencyCode(currencyCode);
  if (CURRENCY_SYMBOLS[code]) return CURRENCY_SYMBOLS[code];

  try {
    const parts = new Intl.NumberFormat(locale, {
      style: "currency",
      currency: code,
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).formatToParts(0);
    const sym = parts.find((p) => p.type === "currency")?.value?.trim();
    if (sym && sym.toUpperCase() !== code) return sym;
  } catch {
    /* invalid ISO code — fall through */
  }

  return code;
}

export type FormatMoneyOptions = {
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  /** When true, append code after symbol for ambiguous symbols (e.g. CA$ 10 (CAD)) */
  showCode?: boolean;
};

export function formatMoney(
  amount: number,
  currencyCode?: string | null,
  options: FormatMoneyOptions = {},
): string {
  const code = normalizeCurrencyCode(currencyCode);
  const maximumFractionDigits = options.maximumFractionDigits ?? 2;
  const minimumFractionDigits =
    options.minimumFractionDigits ?? (maximumFractionDigits === 0 ? 0 : 2);
  const n = Number(amount);
  const safe = Number.isFinite(n) ? n : 0;

  const locales = code === "GHS" ? "en-GH" : code === "NGN" ? "en-NG" : "en";
  try {
    const formatted = new Intl.NumberFormat(locales, {
      style: "currency",
      currency: code,
      minimumFractionDigits,
      maximumFractionDigits,
    }).format(safe);
    if (options.showCode && !formatted.includes(code)) {
      return `${formatted} (${code})`;
    }
    return formatted;
  } catch {
    const sym = getCurrencySymbol(code);
    const num = safe.toLocaleString(undefined, {
      minimumFractionDigits,
      maximumFractionDigits,
    });
    return `${sym}${num}`;
  }
}

/** Compact: symbol + number without Intl (for tight UI chips) */
export function formatMoneyCompact(amount: number, currencyCode?: string | null): string {
  const sym = getCurrencySymbol(currencyCode);
  const n = Number(amount);
  const safe = Number.isFinite(n) ? n : 0;
  return `${sym}${safe.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export const COMMON_CURRENCY_OPTIONS = [
  { code: "GHS", label: "Ghana Cedi (GHS)" },
  { code: "USD", label: "US Dollar (USD)" },
  { code: "EUR", label: "Euro (EUR)" },
  { code: "GBP", label: "British Pound (GBP)" },
  { code: "NGN", label: "Nigerian Naira (NGN)" },
  { code: "KES", label: "Kenyan Shilling (KES)" },
  { code: "ZAR", label: "South African Rand (ZAR)" },
  { code: "XOF", label: "West African CFA (XOF)" },
] as const;
