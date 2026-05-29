// @ts-nocheck
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";
import { gradingFormatFromSettings, type GradingFormat } from "@/report/lib/grading";
import { fetchCurrentTerm } from "@/report/lib/terms";
import { fetchSchoolById, resolveUserSchoolId } from "@/lib/schoolFetch";
import { isMissingSchemaColumnError } from "@/report/lib/supabase-errors";

export type { GradingFormat };

export function useSchool(schoolIdOverride?: string | null) {
  const { profile, user } = useAuth();
  return useQuery({
    queryKey: ["school", schoolIdOverride ?? profile?.school_id, user?.id],
    enabled: !!(schoolIdOverride ?? user?.id),
    queryFn: async () => {
      const schoolId = schoolIdOverride ?? (user ? await resolveUserSchoolId(user.id) : null);
      if (!schoolId) return null;
      const row = await fetchSchoolById(schoolId);
      if (!row) return null;
      return {
        ...row,
        name: row.name ?? row.school_name ?? "",
        phone: row.phone ?? "",
        email: row.email ?? "",
        address: row.address ?? "",
        motto: row.motto ?? "",
        stamp_url: row.stamp_url ?? "",
        principal_name: row.principal_name ?? "",
        logo_url: row.logo_url ?? "",
      };
    },
  });
}

export function useCurrentTerm() {
  const { profile, user } = useAuth();
  return useQuery({
    queryKey: ["current-term", profile?.school_id, user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const schoolId = profile?.school_id ?? (user ? await resolveUserSchoolId(user.id) : null);
      if (!schoolId) return null;
      return fetchCurrentTerm(schoolId);
    },
  });
}

export function useSchoolSettings() {
  const { profile, user } = useAuth();
  const schoolId = profile?.school_id;
  return useQuery({
    queryKey: ["school-settings", schoolId, user?.id],
    enabled: !!(schoolId || user?.id),
    queryFn: async () => {
      const sid = schoolId ?? (user ? await resolveUserSchoolId(user.id) : null);
      if (!sid) return null;
      const { data, error } = await supabase
        .from("school_settings")
        .select("*")
        .eq("school_id", sid)
        .maybeSingle();
      if (error && !isMissingSchemaColumnError(error)) throw error;
      if (error && isMissingSchemaColumnError(error)) return null;
      return data;
    },
  });
}

export function useGradingFormat(): GradingFormat {
  const { data: settings } = useSchoolSettings();
  return gradingFormatFromSettings(
    settings as { grading_system?: string | null } | null | undefined,
  );
}

export function useDashboardStats() {
  const { profile } = useAuth();
  const schoolId = profile?.school_id;
  return useQuery({
    queryKey: ["dashboard-stats", schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const [students, teachers, classes, parents, alerts] = await Promise.all([
        supabase.from("students").select("id", { count: "exact", head: true }).eq("school_id", schoolId!),
        supabase.from("user_roles").select("id", { count: "exact", head: true }).eq("school_id", schoolId!).eq("role", "teacher"),
        supabase.from("classes").select("id", { count: "exact", head: true }).eq("school_id", schoolId!),
        supabase.from("user_roles").select("id", { count: "exact", head: true }).eq("school_id", schoolId!).eq("role", "parent"),
        supabase.from("academic_alerts").select("id", { count: "exact", head: true }).eq("school_id", schoolId!).eq("status", "pending"),
      ]);
      return {
        students: students.count ?? 0,
        teachers: teachers.count ?? 0,
        classes: classes.count ?? 0,
        parents: parents.count ?? 0,
        alerts: alerts.count ?? 0,
      };
    },
  });
}