import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { useAuth as useBaseAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "super_admin" | "school_admin" | "teacher" | "student" | "parent";

interface Profile {
  id: string;
  full_name: string;
  email: string | null;
  avatar_url: string | null;
  school_id: string | null;
}

const ROLE_PRIORITY: AppRole[] = ["super_admin", "school_admin", "teacher", "parent", "student"];

function mapRole(role: string | null): AppRole | null {
  if (!role) return null;
  if (role === "admin") return "school_admin";
  if (role === "accountant" || role === "auditor") return "school_admin";
  return role as AppRole;
}

export function useAuth() {
  const { user, session, signOut, loading: authLoading } = useBaseAuth();
  const { roles: rawRoles, role: rawRole, loading: roleLoading } = useUserRole();
  const [profile, setProfile] = useState<Profile | null>(null);

  const loadProfile = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, email, avatar_url, school_id")
      .eq("id", uid)
      .maybeSingle();
    setProfile((data as Profile) ?? null);
  }, []);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }
    void loadProfile(user.id);
  }, [user, loadProfile]);

  const roles = useMemo(
    () =>
      rawRoles
        .map((r) => mapRole(r))
        .filter((r): r is AppRole => r !== null),
    [rawRoles],
  );

  const primaryRole = useMemo(() => {
    const mapped = mapRole(rawRole);
    if (mapped) return mapped;
    return ROLE_PRIORITY.find((r) => roles.includes(r)) ?? null;
  }, [rawRole, roles]);

  return {
    user,
    session,
    profile,
    roles,
    primaryRole,
    loading: authLoading || roleLoading,
    signOut,
    refresh: async () => {
      if (user) await loadProfile(user.id);
    },
  };
}

export const roleLabel: Record<AppRole, string> = {
  super_admin: "Super Admin",
  school_admin: "School Admin",
  teacher: "Teacher",
  student: "Student",
  parent: "Parent",
};
