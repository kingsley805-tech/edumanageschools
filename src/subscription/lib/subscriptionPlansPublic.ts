import { supabase } from "@/integrations/supabase/client";
import { isMissingSchemaError } from "@/subscription/lib/fetchOrganizationSubscriptionAccess";

export const SUBSCRIPTION_PLANS_PUBLIC_KEY = "subscription-plans-public";

export type PublicSubscriptionPlan = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  price_monthly: number;
  price_annual: number;
  sms_addon_fee_monthly?: number;
  sms_addon_fee_annual?: number;
  sms_included_quantity?: number;
  sms_price_per_message?: number;
  max_students: number | null;
  max_teachers: number | null;
  max_storage_gb: number | null;
  is_custom: boolean;
  is_active: boolean;
  sort_order?: number;
  default_modules: string[];
};

export function normalizeSubscriptionPlan(row: Record<string, unknown>): PublicSubscriptionPlan {
  const rawModules = row.default_modules;
  let default_modules: string[] = [];
  if (Array.isArray(rawModules)) {
    default_modules = [...rawModules] as string[];
  } else if (typeof rawModules === "string") {
    try {
      default_modules = JSON.parse(rawModules);
    } catch {
      default_modules = [];
    }
  }

  return {
    ...(row as PublicSubscriptionPlan),
    default_modules,
  };
}

/** Active plans shown on the school subscription checkout page. */
export function isPlanAvailableForCheckout(plan: Pick<PublicSubscriptionPlan, "is_custom" | "price_monthly" | "price_annual">): boolean {
  if (!plan.is_custom) return true;
  return Number(plan.price_monthly ?? 0) > 0 || Number(plan.price_annual ?? 0) > 0;
}

export async function fetchPublicSubscriptionPlans(): Promise<PublicSubscriptionPlan[]> {
  const { data, error } = await supabase
    .from("subscription_plans")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");

  if (error) {
    if (isMissingSchemaError(error)) return [];
    throw error;
  }

  return (data ?? []).map((row) => normalizeSubscriptionPlan(row as Record<string, unknown>));
}

export function invalidatePublicSubscriptionPlans(queryClient: { invalidateQueries: (opts: { queryKey: string[] }) => Promise<unknown> }) {
  return queryClient.invalidateQueries({ queryKey: [SUBSCRIPTION_PLANS_PUBLIC_KEY] });
}
