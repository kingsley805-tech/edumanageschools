export type SubscriptionAccessState =
  | "legacy"
  | "pending_payment"
  | "active"
  | "expiring_soon"
  | "expired_grace"
  | "locked";

export type OrganizationSubscriptionAccess = {
  has_subscription_row: boolean;
  access_state: SubscriptionAccessState;
  can_use_platform: boolean;
  status?: string;
  plan_id?: string | null;
  billing_cycle?: "monthly" | "annual" | null;
  started_at?: string | null;
  expires_at?: string | null;
  grace_period_ends_at?: string | null;
  reminder_day?: number;
  days_remaining?: number | null;
  locked_at?: string | null;
};

/** Paths allowed when subscription is not active (payment / support only). */
export const SUBSCRIPTION_ALLOWED_PATHS = [
  "/admin/subscription",
  "/admin/subscription/history",
  "/admin/support",
  "/contact",
] as const;

export function isSubscriptionAllowedPath(pathname: string): boolean {
  return SUBSCRIPTION_ALLOWED_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

export function subscriptionRequiresPayment(access: OrganizationSubscriptionAccess | null | undefined): boolean {
  if (!access?.has_subscription_row) return false;
  return !access.can_use_platform;
}

export function subscriptionBannerMessage(access: OrganizationSubscriptionAccess | null | undefined): string | null {
  if (!access?.has_subscription_row) return null;
  switch (access.access_state) {
    case "expiring_soon":
      return access.days_remaining != null
        ? `Your subscription expires in ${access.days_remaining} day${access.days_remaining === 1 ? "" : "s"}. Renew to avoid interruption.`
        : "Your subscription is expiring soon. Please renew.";
    case "expired_grace": {
      const day = access.reminder_day ?? 1;
      if (day >= 3) {
        return "Final reminder: your account will be locked if payment is not received today.";
      }
      return `Your subscription has expired. Grace period day ${day} of 3 — please renew now.`;
    }
    case "locked":
      return "Your organization is locked due to an expired subscription. Renew to restore access.";
    default:
      return null;
  }
}

export function subscriptionBannerVariant(
  access: OrganizationSubscriptionAccess | null | undefined,
): "default" | "destructive" {
  if (access?.access_state === "expired_grace" && (access.reminder_day ?? 0) >= 2) {
    return "destructive";
  }
  if (access?.access_state === "locked") return "destructive";
  return "default";
}
