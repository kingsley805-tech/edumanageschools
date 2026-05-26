import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";

const CACHE_TTL_MS = 5 * 60 * 1000;
const permissionCache = new Map<string, { codes: Set<string>; expires: number }>();

export const usePermissions = () => {
  const { user } = useAuth();
  const { role: portalRole, loading: roleLoading } = useUserRole();
  const [permissions, setPermissions] = useState<Set<string>>(new Set());
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPermissions = useCallback(async () => {
    if (!user) {
      setPermissions(new Set());
      setSchoolId(null);
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("school_id")
      .eq("id", user.id)
      .single();

    const sid = profile?.school_id ?? null;
    setSchoolId(sid);

    const cacheKey = `${user.id}:${sid ?? "global"}`;
    const cached = permissionCache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      setPermissions(cached.codes);
      setLoading(false);
      return;
    }

    if (portalRole === "super_admin") {
      const { data: allPerms } = await supabase.from("permissions").select("code");
      const codes = new Set((allPerms ?? []).map((p) => p.code));
      permissionCache.set(cacheKey, { codes, expires: Date.now() + CACHE_TTL_MS });
      setPermissions(codes);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase.rpc("get_user_permissions", {
      _user_id: user.id,
      _school_id: sid,
    });

    if (error) {
      console.error("Failed to load permissions:", error);
      setPermissions(new Set());
    } else {
      const codes = new Set((data as string[]) ?? []);
      permissionCache.set(cacheKey, { codes, expires: Date.now() + CACHE_TTL_MS });
      setPermissions(codes);
    }
    setLoading(false);
  }, [user, portalRole]);

  useEffect(() => {
    if (!roleLoading) fetchPermissions();
  }, [fetchPermissions, roleLoading]);

  const hasPermission = useCallback(
    (code: string) => portalRole === "super_admin" || permissions.has(code),
    [permissions, portalRole]
  );

  const hasAnyPermission = useCallback(
    (codes: string[]) => portalRole === "super_admin" || codes.some((c) => permissions.has(c)),
    [permissions, portalRole]
  );

  const hasAllPermissions = useCallback(
    (codes: string[]) => portalRole === "super_admin" || codes.every((c) => permissions.has(c)),
    [permissions, portalRole]
  );

  const canAccessSchool = useCallback(
    async (targetSchoolId: string) => {
      if (!user) return false;
      if (portalRole === "super_admin") return true;
      return schoolId === targetSchoolId;
    },
    [user, portalRole, schoolId]
  );

  const invalidateCache = useCallback(() => {
    if (user) permissionCache.delete(`${user.id}:${schoolId ?? "global"}`);
    fetchPermissions();
  }, [user, schoolId, fetchPermissions]);

  const rbacRoles = useMemo(() => permissions, [permissions]);

  return {
    permissions: rbacRoles,
    schoolId,
    loading: loading || roleLoading,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    canAccessSchool,
    invalidateCache,
    isSuperAdmin: portalRole === "super_admin",
  };
};

export const clearPermissionCache = () => permissionCache.clear();
