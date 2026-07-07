import { supabase } from "@/integrations/supabase/client";
import type { OrganizationSubscriptionAccess } from "@/subscription/lib/subscriptionAccess";

export const LEGACY_SUBSCRIPTION_ACCESS: OrganizationSubscriptionAccess = {
  has_subscription_row: false,
  access_state: "legacy",
  can_use_platform: true,
};

type SupabaseErrorLike = { code?: string; message?: string; status?: number } | null;

export function isMissingSchemaError(error: SupabaseErrorLike): boolean {
  if (!error) return false;
  const code = error.code ?? "";
  const msg = (error.message ?? "").toLowerCase();
  return (
    code === "PGRST202" ||
    code === "PGRST205" ||
    code === "PGRST204" ||
    code === "42703" ||
    code === "42883" ||
    error.status === 404 ||
    (error.status === 400 &&
      (msg.includes("column") ||
        msg.includes("schema cache") ||
        msg.includes("could not find"))) ||
    msg.includes("could not find the function") ||
    msg.includes("could not find the table") ||
    msg.includes("could not find the column") ||
    (msg.includes("column") && msg.includes("does not exist")) ||
    msg.includes("does not exist") ||
    msg.includes("get_organization_subscription_access")
  );
}

export type SchoolSubscriptionEntitlementsRow = {
  status: string | null;
  read_only_on_expiry: boolean | null;
  block_login_on_expiry: boolean | null;
  expires_at: string | null;
  plan_id: string | null;
  entitlements_override?: boolean | null;
};

const BASE_SUBSCRIPTION_SELECT =
  "status, read_only_on_expiry, block_login_on_expiry, expires_at, plan_id";

/** After a failed probe, skip selecting entitlements_override for the session. */
let entitlementsOverrideColumnAvailable: boolean | undefined;

/** Subscription row for module gating; avoids 400 when entitlements_override is not migrated yet. */
export async function fetchSchoolSubscriptionForEntitlements(
  schoolId: string,
): Promise<{ data: SchoolSubscriptionEntitlementsRow | null; entitlementsOverride: boolean }> {
  const { data, error } = await supabase
    .from("school_subscriptions")
    .select(BASE_SUBSCRIPTION_SELECT)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (error) {
    if (isMissingSchemaError(error)) {
      return { data: null, entitlementsOverride: false };
    }
    throw error;
  }

  let entitlementsOverride = false;
  if (entitlementsOverrideColumnAvailable !== false) {
    const overrideRes = await supabase
      .from("school_subscriptions")
      .select("entitlements_override")
      .eq("school_id", schoolId)
      .maybeSingle();

    if (!overrideRes.error) {
      entitlementsOverrideColumnAvailable = true;
      entitlementsOverride = Boolean(overrideRes.data?.entitlements_override);
    } else if (isMissingSchemaError(overrideRes.error)) {
      entitlementsOverrideColumnAvailable = false;
    } else {
      throw overrideRes.error;
    }
  }

  return {
    data: data as SchoolSubscriptionEntitlementsRow | null,
    entitlementsOverride,
  };
}

/** After first 404/missing-function response, skip RPC for the rest of the session. */
let organizationSubscriptionRpcAvailable: boolean | undefined;

function computeAccessFromRow(sub: {
  status?: string | null;
  plan_id?: string | null;
  expires_at?: string | null;
  grace_period_ends_at?: string | null;
  reminder_day?: number | null;
  billing_cycle?: string | null;
  locked_at?: string | null;
  started_at?: string | null;
}): OrganizationSubscriptionAccess {
  const now = Date.now();
  const expiresAt = sub.expires_at ? new Date(sub.expires_at).getTime() : null;
  const graceEnds = sub.grace_period_ends_at ? new Date(sub.grace_period_ends_at).getTime() : null;
  const daysRemaining =
    expiresAt != null ? Math.max(0, Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24))) : null;

  const status = sub.status ?? "trial";
  const pending =
    status === "pending" || ((status === "trial" || status === "pending") && !sub.plan_id);

  if (pending) {
    return {
      has_subscription_row: true,
      access_state: "pending_payment",
      can_use_platform: false,
      status,
      plan_id: sub.plan_id ?? null,
      billing_cycle: (sub.billing_cycle as "monthly" | "annual") ?? null,
      started_at: sub.started_at ?? null,
      expires_at: sub.expires_at ?? null,
      grace_period_ends_at: sub.grace_period_ends_at ?? null,
      reminder_day: sub.reminder_day ?? 0,
      days_remaining: daysRemaining,
      locked_at: sub.locked_at ?? null,
    };
  }

  if (status === "locked" || status === "suspended") {
    return {
      has_subscription_row: true,
      access_state: "locked",
      can_use_platform: false,
      status,
      plan_id: sub.plan_id ?? null,
      billing_cycle: (sub.billing_cycle as "monthly" | "annual") ?? null,
      started_at: sub.started_at ?? null,
      expires_at: sub.expires_at ?? null,
      grace_period_ends_at: sub.grace_period_ends_at ?? null,
      reminder_day: sub.reminder_day ?? 0,
      days_remaining: daysRemaining,
      locked_at: sub.locked_at ?? null,
    };
  }

  if (
    (status === "active" || status === "trial") &&
    sub.plan_id &&
    (expiresAt == null || expiresAt > now)
  ) {
    const expiringSoon = daysRemaining != null && daysRemaining <= 7;
    return {
      has_subscription_row: true,
      access_state: expiringSoon ? "expiring_soon" : "active",
      can_use_platform: true,
      status,
      plan_id: sub.plan_id ?? null,
      billing_cycle: (sub.billing_cycle as "monthly" | "annual") ?? null,
      started_at: sub.started_at ?? null,
      expires_at: sub.expires_at ?? null,
      grace_period_ends_at: sub.grace_period_ends_at ?? null,
      reminder_day: sub.reminder_day ?? 0,
      days_remaining: daysRemaining,
      locked_at: sub.locked_at ?? null,
    };
  }

  if (status === "expired" || (expiresAt != null && expiresAt <= now)) {
    if (graceEnds != null && now <= graceEnds) {
      return {
        has_subscription_row: true,
        access_state: "expired_grace",
        can_use_platform: false,
        status,
        plan_id: sub.plan_id ?? null,
        billing_cycle: (sub.billing_cycle as "monthly" | "annual") ?? null,
        started_at: sub.started_at ?? null,
        expires_at: sub.expires_at ?? null,
        grace_period_ends_at: sub.grace_period_ends_at ?? null,
        reminder_day: sub.reminder_day ?? 0,
        days_remaining: daysRemaining,
        locked_at: sub.locked_at ?? null,
      };
    }
    return {
      has_subscription_row: true,
      access_state: "locked",
      can_use_platform: false,
      status,
      plan_id: sub.plan_id ?? null,
      billing_cycle: (sub.billing_cycle as "monthly" | "annual") ?? null,
      started_at: sub.started_at ?? null,
      expires_at: sub.expires_at ?? null,
      grace_period_ends_at: sub.grace_period_ends_at ?? null,
      reminder_day: sub.reminder_day ?? 0,
      days_remaining: daysRemaining,
      locked_at: sub.locked_at ?? null,
    };
  }

  return {
    has_subscription_row: true,
    access_state: "pending_payment",
    can_use_platform: false,
    status,
    plan_id: sub.plan_id ?? null,
    billing_cycle: (sub.billing_cycle as "monthly" | "annual") ?? null,
    started_at: sub.started_at ?? null,
    expires_at: sub.expires_at ?? null,
    grace_period_ends_at: sub.grace_period_ends_at ?? null,
    reminder_day: sub.reminder_day ?? 0,
    days_remaining: daysRemaining,
    locked_at: sub.locked_at ?? null,
  };
}

async function loadAccessFromSubscriptionTable(
  schoolId: string,
): Promise<OrganizationSubscriptionAccess> {
  const { data: sub, error: subErr } = await supabase
    .from("school_subscriptions")
    .select(
      "status, plan_id, expires_at, grace_period_ends_at, reminder_day, billing_cycle, locked_at, started_at",
    )
    .eq("school_id", schoolId)
    .maybeSingle();

  if (subErr) {
    // Schema may be partially applied (table exists, newer columns missing).
    if (isMissingSchemaError(subErr)) {
      const { data: subMinimal, error: minimalErr } = await supabase
        .from("school_subscriptions")
        .select("status, plan_id, expires_at, started_at")
        .eq("school_id", schoolId)
        .maybeSingle();

      if (minimalErr) {
        if (isMissingSchemaError(minimalErr)) return LEGACY_SUBSCRIPTION_ACCESS;
        throw minimalErr;
      }

      if (!subMinimal) return LEGACY_SUBSCRIPTION_ACCESS;
      return computeAccessFromRow(subMinimal);
    }
    throw subErr;
  }

  if (!sub) return LEGACY_SUBSCRIPTION_ACCESS;
  return computeAccessFromRow(sub);
}

/** Loads subscription access via RPC, with table/read fallback when migrations are not applied yet. */
export async function fetchOrganizationSubscriptionAccess(
  schoolId: string,
): Promise<OrganizationSubscriptionAccess> {
  if (organizationSubscriptionRpcAvailable !== false) {
    const { data, error } = await supabase.rpc("get_organization_subscription_access", {
      p_school_id: schoolId,
    });

    if (!error) {
      organizationSubscriptionRpcAvailable = true;
      return (data ?? LEGACY_SUBSCRIPTION_ACCESS) as OrganizationSubscriptionAccess;
    }

    if (!isMissingSchemaError(error)) {
      throw error;
    }

    organizationSubscriptionRpcAvailable = false;
  }

  return loadAccessFromSubscriptionTable(schoolId);
}
