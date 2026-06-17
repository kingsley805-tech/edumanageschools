// @ts-nocheck
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PlatformDashboardStats, PlatformSchoolSmsOverview, TenantOverview } from "@/platform/lib/types";

export function usePlatformTenants() {
  return useQuery({
    queryKey: ["platform-tenants"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_tenant_overview_v")
        .select("*")
        .order("school_name");
      if (error) throw error;
      return (data ?? []) as TenantOverview[];
    },
  });
}

export function usePlatformDashboardStats() {
  return useQuery({
    queryKey: ["platform-dashboard-stats"],
    queryFn: async (): Promise<PlatformDashboardStats> => {
      const { data: tenants, error } = await supabase.from("platform_tenant_overview_v").select("*");
      if (error) throw error;
      const rows = (tenants ?? []) as TenantOverview[];

      const totalOrganizations = rows.length;
      const activeOrganizations = rows.filter((r) => r.subscription_status === "active" || (!r.subscription_status && r.is_active)).length;
      const suspendedOrganizations = rows.filter((r) => r.subscription_status === "suspended").length;
      const expiredOrganizations = rows.filter((r) => r.subscription_status === "expired").length;
      const trialOrganizations = rows.filter((r) => r.subscription_status === "trial").length;

      return {
        totalOrganizations,
        activeOrganizations,
        suspendedOrganizations,
        expiredOrganizations,
        trialOrganizations,
        totalStudents: rows.reduce((s, r) => s + (r.student_count ?? 0), 0),
        totalTeachers: rows.reduce((s, r) => s + (r.teacher_count ?? 0), 0),
        totalParents: rows.reduce((s, r) => s + (r.parent_count ?? 0), 0),
        totalUsers: rows.reduce((s, r) => s + (r.user_count ?? 0), 0),
        monthlyRevenue: 0,
      };
    },
  });
}

export function useSubscriptionPlans(includeInactive = true) {
  return useQuery({
    queryKey: ["subscription-plans", includeInactive],
    queryFn: async () => {
      let q = supabase.from("subscription_plans").select("*").order("sort_order");
      if (!includeInactive) {
        q = q.eq("is_active", true);
      }
      const { data, error } = await q;
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

export function usePlatformModulesCatalog() {
  return useQuery({
    queryKey: ["platform-modules-catalog"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_modules")
        .select("module_key, category, label, portal_module_key")
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function usePlatformSchoolSmsOverview() {
  return useQuery({
    queryKey: ["platform-school-sms-overview"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_school_sms_overview_v")
        .select("*")
        .order("school_name");
      if (error) {
        if (error.code === "42P01" || error.message?.includes("platform_school_sms_overview_v")) {
          return [] as PlatformSchoolSmsOverview[];
        }
        throw error;
      }
      return (data ?? []) as PlatformSchoolSmsOverview[];
    },
  });
}
