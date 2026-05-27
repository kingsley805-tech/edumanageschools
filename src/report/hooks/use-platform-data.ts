import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useSchoolsList() {
  return useQuery({
    queryKey: ["platform-schools"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schools")
        .select("id, name, school_name, school_code, created_at, email, phone")
        .order("school_name");
      if (error) throw error;
      return (data ?? []).map((s) => ({
        ...s,
        name: (s.name as string | undefined) ?? s.school_name,
      }));
    },
  });
}

export function usePlatformStats(schoolId?: string | null) {
  return useQuery({
    queryKey: ["platform-stats", schoolId ?? "all"],
    queryFn: async () => {
      const withSchool = <T extends { eq: (col: string, val: string) => T }>(q: T) =>
        schoolId ? q.eq("school_id", schoolId) : q;

      const [reports, pendingReports, approvedReports, rejectedReports] = await Promise.all([
        withSchool(supabase.from("term_report_cards").select("id", { count: "exact", head: true })),
        withSchool(
          supabase
            .from("term_report_cards")
            .select("id", { count: "exact", head: true })
            .in("status", ["pending_review", "saved", "reviewed"]),
        ),
        withSchool(
          supabase
            .from("term_report_cards")
            .select("id", { count: "exact", head: true })
            .in("status", ["approved", "published"]),
        ),
        withSchool(
          supabase.from("term_report_cards").select("id", { count: "exact", head: true }).eq("status", "rejected"),
        ),
      ]);

      return {
        reports: reports.count ?? 0,
        pendingReports: pendingReports.count ?? 0,
        approvedReports: approvedReports.count ?? 0,
        rejectedReports: rejectedReports.count ?? 0,
      };
    },
  });
}
