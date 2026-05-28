/** Paystack may omit `status` on redirect; only treat known values as hard failures. */
const EXPLICIT_FAILURE = new Set(["failed", "abandoned", "cancelled", "cancel", "reversed"]);

export type PaystackReturnState = { reference: string; status: string };

export function parsePaystackReturnSearch(search: string): PaystackReturnState | null {
  const params = new URLSearchParams(search);
  const reference = params.get("reference") || params.get("trxref");
  if (!reference) return null;
  const status = (params.get("status") || "").toLowerCase();
  return { reference, status };
}

export function isExplicitPaystackFailure(status: string): boolean {
  return EXPLICIT_FAILURE.has(status);
}

/** Call verify when we have a reference unless the URL clearly says the user did not pay. */
export function shouldAttemptPaystackConfirm(state: PaystackReturnState | null): boolean {
  if (!state) return false;
  if (isExplicitPaystackFailure(state.status)) return false;
  return true;
}
