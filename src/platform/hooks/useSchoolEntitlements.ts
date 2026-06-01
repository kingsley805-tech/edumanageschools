// @ts-nocheck
import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSchoolInfo } from "@/hooks/useSchoolInfo";
import { usePermissions } from "@/hooks/usePermissions";
import type { ModuleEntitlementRow } from "@/platform/lib/types";
import { moduleByPath } from "@/lib/rbac/permissionCatalog";

const ENTITLEMENTS_KEY = "school-module-entitlements";

/** Map portal RBAC module key → platform module keys (many-to-one allowed) */
function portalKeysForPath(path: string): string[] {
  const mod = moduleByPath(path);
  if (!mod) return [];
  return [mod.key];
}

export function useSchoolEntitlements(schoolId?: string | null) {
  const { currentSchool } = useSchoolInfo();
  const { isSuperAdmin } = usePermissions();
  const sid = schoolId ?? currentSchool?.id ?? null;
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: [ENTITLEMENTS_KEY, sid],
    enabled: Boolean(sid),
    queryFn: async () => {
      const [modsRes, entRes, subRes, accessRes] = await Promise.all([
        supabase.from("platform_modules").select("*").order("sort_order"),
        supabase.from("school_module_entitlements").select("*").eq("school_id", sid!),
        supabase.from("school_subscriptions").select("status, read_only_on_expiry, block_login_on_expiry, expires_at").eq("school_id", sid!).maybeSingle(),
        supabase.rpc("get_organization_subscription_access", { p_school_id: sid! }),
      ]);
      if (modsRes.error) throw modsRes.error;
      if (entRes.error) throw entRes.error;
      if (subRes.error) throw subRes.error;
      if (accessRes.error) throw accessRes.error;

      const entMap = new Map((entRes.data ?? []).map((e) => [e.module_key, e]));
      const rows: ModuleEntitlementRow[] = (modsRes.data ?? []).map((m) => {
        const e = entMap.get(m.module_key);
        return {
          module_key: m.module_key,
          label: m.label,
          category: m.category,
          portal_module_key: m.portal_module_key,
          enabled: e?.enabled ?? false,
          can_read: e?.can_read ?? false,
          can_create: e?.can_create ?? false,
          can_edit: e?.can_edit ?? false,
          can_delete: e?.can_delete ?? false,
          can_export: e?.can_export ?? false,
        };
      });

      return {
        rows,
        subscription: subRes.data,
        access: accessRes.data,
        enforced: Boolean(subRes.data),
      };
    },
  });

  const enabledPortalKeys = useMemo(() => {
    if (!data?.rows) return null;
    if (isSuperAdmin) return null;
    if (!data.enforced) return null;
    const keys = new Set<string>();
    for (const row of data.rows) {
      if (row.enabled && row.portal_module_key) {
        keys.add(row.portal_module_key);
      }
    }
    return keys;
  }, [data, isSuperAdmin]);

  const isModuleEnabledForPath = useCallback(
    (path: string) => {
      if (isSuperAdmin || !enabledPortalKeys) return true;
      const portalKeys = portalKeysForPath(path);
      if (!portalKeys.length) return true;
      return portalKeys.some((k) => enabledPortalKeys.has(k));
    },
    [enabledPortalKeys, isSuperAdmin],
  );

  const isWritable = useMemo(() => {
    if (isSuperAdmin) return true;
    const access = data?.access as { can_use_platform?: boolean; access_state?: string } | null | undefined;
    if (access?.access_state && access.access_state !== "legacy") {
      return Boolean(access.can_use_platform);
    }
    if (!data?.subscription) return true;
    const st = data.subscription.status;
    if (st === "active" || st === "trial") return true;
    if (st === "expired" && data.subscription.read_only_on_expiry) return false;
    return !["suspended", "expired", "cancelled", "locked", "pending"].includes(st);
  }, [data, isSuperAdmin]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: [ENTITLEMENTS_KEY, sid] });

  return {
    loading: isLoading,
    rows: data?.rows ?? [],
    subscription: data?.subscription ?? null,
    enforced: data?.enforced ?? false,
    enabledPortalKeys,
    isModuleEnabledForPath,
    isWritable,
    invalidate,
  };
}

export function useTenantEntitlementsEditor(schoolId: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [ENTITLEMENTS_KEY, "edit", schoolId],
    enabled: Boolean(schoolId),
    queryFn: async () => {
      const [modsRes, entRes] = await Promise.all([
        supabase.from("platform_modules").select("*").order("sort_order"),
        supabase.from("school_module_entitlements").select("*").eq("school_id", schoolId),
      ]);
      if (modsRes.error) throw modsRes.error;
      if (entRes.error) throw entRes.error;
      const entMap = new Map((entRes.data ?? []).map((e) => [e.module_key, e]));
      return (modsRes.data ?? []).map((m) => {
        const e = entMap.get(m.module_key);
        return {
          module_key: m.module_key,
          label: m.label,
          category: m.category,
          portal_module_key: m.portal_module_key,
          enabled: e?.enabled ?? false,
          can_read: e?.can_read ?? false,
          can_create: e?.can_create ?? false,
          can_edit: e?.can_edit ?? false,
          can_delete: e?.can_delete ?? false,
          can_export: e?.can_export ?? false,
        } satisfies ModuleEntitlementRow;
      });
    },
  });

  const save = async (rows: ModuleEntitlementRow[]) => {
    const { data, error } = await supabase.rpc("save_school_module_entitlements", {
      p_school_id: schoolId,
      p_rows: rows.map((r) => ({
        module_key: r.module_key,
        enabled: r.enabled,
        can_read: r.can_read,
        can_create: r.can_create,
        can_edit: r.can_edit,
        can_delete: r.can_delete,
        can_export: r.can_export,
      })),
    });
    if (error) throw error;
    const res = data as { ok?: boolean; error?: string };
    if (!res?.ok) throw new Error(res?.error ?? "Save failed");
    await queryClient.invalidateQueries({ queryKey: [ENTITLEMENTS_KEY] });
    await queryClient.invalidateQueries({ queryKey: ["platform-tenants"] });
  };

  const applyPlan = async (planId: string, status = "active", expiresAt?: string | null) => {
    const { data, error } = await supabase.rpc("apply_subscription_plan_to_school", {
      p_school_id: schoolId,
      p_plan_id: planId,
      p_status: status,
      p_expires_at: expiresAt ?? null,
    });
    if (error) throw error;
    const res = data as { ok?: boolean; error?: string };
    if (!res?.ok) throw new Error(res?.error ?? "Apply plan failed");
    await queryClient.invalidateQueries({ queryKey: [ENTITLEMENTS_KEY] });
    await queryClient.invalidateQueries({ queryKey: ["platform-tenants"] });
  };

  const grantComplimentary = async (
    planId: string,
    billingCycle: "monthly" | "annual" = "annual",
    expiresAt?: string | null,
  ) => {
    const { data, error } = await supabase.rpc("grant_complimentary_subscription", {
      p_school_id: schoolId,
      p_plan_id: planId,
      p_billing_cycle: billingCycle,
      p_expires_at: expiresAt ?? null,
    });
    if (error) throw error;
    const res = data as { ok?: boolean; error?: string };
    if (!res?.ok) throw new Error(res?.error ?? "Complimentary grant failed");
    await queryClient.invalidateQueries({ queryKey: [ENTITLEMENTS_KEY] });
    await queryClient.invalidateQueries({ queryKey: ["platform-tenants"] });
    await queryClient.invalidateQueries({ queryKey: ["organization-subscription-access"] });
  };

  return { ...query, save, applyPlan, grantComplimentary };
}
