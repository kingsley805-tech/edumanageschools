/** Session keys for smooth admin onboarding transitions (avoid page flashes). */

export const ADMIN_PENDING_VERIFICATION_FLAG = "admin_pending_verification";
export const ADMIN_POST_PAYMENT_TRANSITION = "admin_post_payment_transition";

export function setAdminPendingVerificationFlow(): void {
  try {
    sessionStorage.setItem(ADMIN_PENDING_VERIFICATION_FLAG, "1");
    sessionStorage.setItem(ADMIN_POST_PAYMENT_TRANSITION, "1");
  } catch {
    /* ignore */
  }
}

export function clearAdminPendingVerificationFlow(): void {
  try {
    sessionStorage.removeItem(ADMIN_PENDING_VERIFICATION_FLAG);
    sessionStorage.removeItem(ADMIN_POST_PAYMENT_TRANSITION);
  } catch {
    /* ignore */
  }
}

export function isAdminPostPaymentTransition(): boolean {
  try {
    return sessionStorage.getItem(ADMIN_POST_PAYMENT_TRANSITION) === "1";
  } catch {
    return false;
  }
}

export function isAdminPendingVerificationFlag(): boolean {
  try {
    return sessionStorage.getItem(ADMIN_PENDING_VERIFICATION_FLAG) === "1";
  } catch {
    return false;
  }
}
