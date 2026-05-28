/** Paystack key format checks (https://paystack.com/docs/payments/accept-payments). */

export function isValidPaystackPublicKey(trimmed: string): boolean {
  return trimmed.startsWith("pk_test_") || trimmed.startsWith("pk_live_");
}

export function isValidPaystackSecretKey(trimmed: string): boolean {
  return trimmed.startsWith("sk_test_") || trimmed.startsWith("sk_live_");
}

export const PAYSTACK_PUBLIC_KEY_HINT = "Must start with pk_test_ or pk_live_";
export const PAYSTACK_SECRET_KEY_HINT = "Must start with sk_test_ or sk_live_";
