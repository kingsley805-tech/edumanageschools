/** Strip to digits for phone / account validation. */
export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/** Basic contact validation (international-friendly: min digit count). */
export function validateContactPhone(phone: string, minDigits = 9): string | null {
  const d = digitsOnly(phone);
  if (!phone.trim()) return "Phone number is required";
  if (d.length < minDigits) return `Phone must include at least ${minDigits} digits`;
  return null;
}

/** Bank account number: at least `minDigits` digits when a value is provided. */
export function validateBankAccountNumber(accountNumber: string, minDigits = 8): string | null {
  const trimmed = accountNumber.trim();
  if (!trimmed) return null;
  const d = digitsOnly(trimmed);
  if (d.length < minDigits) return `Account number must be at least ${minDigits} digits`;
  return null;
}

/** When MoMo number is set, provider is required. */
export function validateMobileMoneyPair(momoNumber: string, provider: string): string | null {
  const n = momoNumber.trim();
  if (!n) return null;
  const errPhone = validateContactPhone(n, 9);
  if (errPhone) return errPhone;
  if (!provider.trim()) return "Mobile money network is required when a MoMo number is set";
  return null;
}
