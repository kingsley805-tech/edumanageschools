// @ts-nocheck
import type { TenantOverview } from "@/platform/lib/types";

/** Tenants blocked from platform use (pending payment or locked). Mirrors subscription access RPC. */
export function isTenantLockedOrPendingPayment(t: TenantOverview): boolean {
  const status = t.subscription_status;
  if (status == null) return false;

  if (status === "pending") return true;
  if (status === "locked" || status === "suspended" || status === "cancelled") return true;
  if ((status === "trial" || status === "pending") && !t.plan_slug) return true;
  if (status === "expired") return true;

  if (status === "active" && t.expires_at) {
    const expiresAt = new Date(t.expires_at).getTime();
    if (!Number.isNaN(expiresAt) && expiresAt <= Date.now()) return true;
  }

  return false;
}

/** Paid first-time orgs waiting for Super Admin to grant access. */
export function isTenantAwaitingApproval(t: TenantOverview): boolean {
  return t.subscription_status === "pending" && Boolean(t.plan_slug || t.plan_name);
}
