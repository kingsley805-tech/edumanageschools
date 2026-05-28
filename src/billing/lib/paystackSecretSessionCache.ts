/** Tab-scoped cache so "Saved secret key" can show after save when gateway-list omits the secret. */

const PREFIX = "edubill.paystack_sk.v1:";

function keyForOrg(orgId: string): string {
  return `${PREFIX}${orgId}`;
}

export function getPaystackSecretFromSession(orgId: string | null | undefined): string {
  if (!orgId || typeof window === "undefined") return "";
  try {
    return sessionStorage.getItem(keyForOrg(orgId)) ?? "";
  } catch {
    return "";
  }
}

export function setPaystackSecretInSession(orgId: string | null | undefined, secret: string): void {
  if (!orgId || typeof window === "undefined") return;
  try {
    const k = keyForOrg(orgId);
    if (secret.trim()) sessionStorage.setItem(k, secret);
    else sessionStorage.removeItem(k);
  } catch {
    /* quota / private mode */
  }
}

const SAVED_ACK_PREFIX = "edubill.paystack_sk_saved_ack.v1:";

function savedAckKey(orgId: string): string {
  return `${SAVED_ACK_PREFIX}${orgId}`;
}

/** Set after a successful save that included a secret (this tab only). */
export function markPaystackSecretSavedAckInSession(orgId: string | null | undefined): void {
  if (!orgId || typeof window === "undefined") return;
  try {
    sessionStorage.setItem(savedAckKey(orgId), "1");
  } catch {
    /* ignore */
  }
}

export function getPaystackSecretSavedAckFromSession(orgId: string | null | undefined): boolean {
  if (!orgId || typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(savedAckKey(orgId)) === "1";
  } catch {
    return false;
  }
}
