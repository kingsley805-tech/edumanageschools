import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { effectivePortalRoles, isPortalStudentUser } from "@/lib/portalIdentity";

const ROLE_PRIORITY = [
  "super_admin",
  "admin",
  "accountant",
  "auditor",
  "teacher",
  "parent",
  "student",
] as const;

const ROLE_CACHE_TTL_MS = 10 * 60 * 1000;
const ROLE_STORAGE_KEY = "schoolhub_user_roles_v1";
const roleCache = new Map<string, { roles: string[]; isStudent: boolean; expires: number }>();

function readRoleCache(userId: string) {
  const hit = roleCache.get(userId);
  if (hit && hit.expires > Date.now()) return hit;
  try {
    const raw = localStorage.getItem(`${ROLE_STORAGE_KEY}_${userId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.expires > Date.now()) {
        roleCache.set(userId, parsed);
        return parsed;
      }
    }
  } catch {
    // fallback
  }
  return null;
}

function writeRoleCache(userId: string, data: { roles: string[]; isStudent: boolean; expires: number }) {
  roleCache.set(userId, data);
  try {
    localStorage.setItem(`${ROLE_STORAGE_KEY}_${userId}`, JSON.stringify(data));
  } catch {
    // fallback
  }
}

export const useUserRole = () => {
  const { user } = useAuth();
  const cached = user?.id ? readRoleCache(user.id) : null;
  const [roles, setRoles] = useState<string[]>(cached?.roles ?? []);
  const [isStudent, setIsStudent] = useState(cached?.isStudent ?? false);
  const [loading, setLoading] = useState(Boolean(user?.id && !cached));

  useEffect(() => {
    const fetchRoles = async () => {
      if (!user) {
        setRoles([]);
        setIsStudent(false);
        setLoading(false);
        return;
      }

      const hit = readRoleCache(user.id);
      if (hit) {
        setRoles(hit.roles);
        setIsStudent(hit.isStudent);
        setLoading(false);
        return;
      }

      setLoading(true);
      const [{ data, error }, studentAccount] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user.id),
        isPortalStudentUser(user.id),
      ]);

      const rawRoles = !error && data?.length ? data.map((r) => r.role as string) : [];
      const nextRoles = effectivePortalRoles(rawRoles, studentAccount);
      setIsStudent(studentAccount);
      setRoles(nextRoles);
      writeRoleCache(user.id, {
        roles: nextRoles,
        isStudent: studentAccount,
        expires: Date.now() + ROLE_CACHE_TTL_MS,
      });
      setLoading(false);
    };

    void fetchRoles();
  }, [user]);

  const role = useMemo(() => {
    if (isStudent) return "student";
    if (!roles.length) return null;
    for (const r of ROLE_PRIORITY) {
      if (roles.includes(r)) return r;
    }
    return roles[0];
  }, [roles, isStudent]);

  const hasPortalRole = (r: string) => roles.includes(r);

  return { role, roles, loading, hasPortalRole, isStudent };
};
