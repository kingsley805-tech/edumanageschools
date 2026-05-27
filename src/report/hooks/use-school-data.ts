import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";
import { gradingFormatFromSettings, type GradingFormat } from "@/report/lib/grading";
import { fetchCurrentTerm } from "@/report/lib/terms";

export type { GradingFormat };

export function useSchool(schoolIdOverride?: string | null) {
  const { profile } = useAuth();
  const schoolId = schoolIdOverride ?? profile?.school_id;
  return useQuery({
    queryKey: ["school", schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const { data, error } = await supabase.from("schools").select("*").eq("id", schoolId!).single();
      if (error) throw error;
      const row = data as Record<string, unknown>;
      return {
        ...row,
        name: (row.name as string | undefined) ?? (row.school_name as string | undefined) ?? "",
        phone: (row.phone as string | undefined) ?? "",
        email: (row.email as string | undefined) ?? "",
        address: (row.address as string | undefined) ?? "",
        motto: (row.motto as string | undefined) ?? "",
        stamp_url: (row.stamp_url as string | undefined) ?? "",
        principal_name: (row.principal_name as string | undefined) ?? "",
        logo_url: (row.logo_url as string | undefined) ?? "",
      };
    },
  });
}

export function useCurrentTerm() {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ["current-term", profile?.school_id],
    enabled: !!profile?.school_id,
    queryFn: () => fetchCurrentTerm(profile!.school_id!),
  });
}

export function useSchoolSettings() {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ["school-settings", profile?.school_id],
    enabled: !!profile?.school_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("school_settings")
        .select("*")
        .eq("school_id", profile!.school_id!)
        .maybeSingle();
      if (error) throw error;
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
