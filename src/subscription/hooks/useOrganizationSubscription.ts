// @ts-nocheck
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSchoolInfo } from "@/hooks/useSchoolInfo";
import { usePermissions } from "@/hooks/usePermissions";
import type { OrganizationSubscriptionAccess } from "@/subscription/lib/subscriptionAccess";

const ACCESS_KEY = "organization-subscription-access";

export function useOrganizationSubscription(schoolId?: string | null) {
  const { currentSchool, loading: schoolLoading } = useSchoolInfo();
  const { isSuperAdmin } = usePermissions();
  const sid = schoolId ?? currentSchool?.id ?? null;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [ACCESS_KEY, sid],
    enabled: Boolean(sid) && !isSuperAdmin,
    queryFn: async (): Promise<OrganizationSubscriptionAccess> => {
      const { data, error } = await supabase.rpc("get_organization_subscription_access", {
        p_school_id: sid,
      });
      if (error) throw error;
      return (data ?? { has_subscription_row: false, access_state: "legacy", can_use_platform: true }) as OrganizationSubscriptionAccess;
    },
    refetchInterval: (q) => {
      const state = (q.state.data as OrganizationSubscriptionAccess | undefined)?.access_state;
      if (state === "pending_payment" || state === "expired_grace") return 15_000;
      return false;
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: [ACCESS_KEY, sid] });

  const access = query.data ?? null;
  const blocked = Boolean(access?.has_subscription_row && !access?.can_use_platform && !isSuperAdmin);

  return {
    ...query,
    loading: schoolLoading || query.isLoading,
    access,
    blocked,
    invalidate,
    isSuperAdmin,
  };
}

export function useSubscriptionPlansPublic() {
  return useQuery({
    queryKey: ["subscription-plans-public"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []).map((p) => ({
        ...p,
        default_modules: Array.isArray(p.default_modules)
          ? p.default_modules
          : typeof p.default_modules === "string"
            ? JSON.parse(p.default_modules)
            : [],
      }));
    },
  });
}

export function useSubscriptionPaymentHistory(schoolId?: string | null) {
  const { currentSchool } = useSchoolInfo();
  const sid = schoolId ?? currentSchool?.id ?? null;

  return useQuery({
    queryKey: ["organization-subscription-payments", sid],
    enabled: Boolean(sid),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organization_subscription_payments")
        .select("*, subscription_plans(name, slug)")
        .eq("school_id", sid!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}
