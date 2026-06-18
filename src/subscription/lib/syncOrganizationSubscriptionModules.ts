import { supabase } from "@/integrations/supabase/client";
import { isMissingSchemaError } from "@/subscription/lib/fetchOrganizationSubscriptionAccess";

export type SyncOrganizationModulesResult = {
  ok?: boolean;
  error?: string;
  status?: string;
  plan_id?: string;
  school_id?: string;
  plan_module_count?: number;
  enabled_count?: number;
};

/** Re-applies the school's active subscription plan modules (entitlements + RBAC). */
export async function syncOrganizationSubscriptionModules(
  schoolId?: string | null,
): Promise<SyncOrganizationModulesResult | null> {
  const { data, error } = await supabase.rpc("sync_organization_subscription_modules", {
    p_school_id: schoolId ?? null,
  });

  if (error) {
    if (isMissingSchemaError(error)) return null;
    throw error;
  }

  return (data ?? null) as SyncOrganizationModulesResult | null;
}
