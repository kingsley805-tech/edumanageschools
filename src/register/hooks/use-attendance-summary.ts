import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchAttendanceSummary,
  fetchClassAttendanceSummary,
  fetchMonthlyAttendanceTrend,
  type AttendanceSummary,
} from "@/register/lib/attendance";

export const attendanceQueryKeys = {
  summary: (studentId: string, termId?: string | null) =>
    ["attendance-summary", studentId, termId ?? "current"] as const,
  classSummary: (classId: string, termId?: string | null) =>
    ["class-attendance-summary", classId, termId ?? "current"] as const,
  monthlyTrend: (studentId: string, termId?: string | null) =>
    ["attendance-monthly-trend", studentId, termId ?? "current"] as const,
};

export function useAttendanceSummary(studentId: string | null | undefined, termId?: string | null) {
  return useQuery({
    queryKey: attendanceQueryKeys.summary(studentId ?? "", termId),
    queryFn: () => fetchAttendanceSummary(studentId!, termId),
    enabled: !!studentId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useClassAttendanceSummary(classId: string | null | undefined, termId?: string | null) {
  return useQuery({
    queryKey: attendanceQueryKeys.classSummary(classId ?? "", termId),
    queryFn: () => fetchClassAttendanceSummary(classId!, termId),
    enabled: !!classId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useMonthlyAttendanceTrend(studentId: string | null | undefined, termId?: string | null) {
  return useQuery({
    queryKey: attendanceQueryKeys.monthlyTrend(studentId ?? "", termId),
    queryFn: () => fetchMonthlyAttendanceTrend(studentId!, termId),
    enabled: !!studentId,
    staleTime: 2 * 60 * 1000,
  });
}

export function invalidateAttendanceQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  opts?: { studentId?: string; classId?: string; termId?: string | null },
) {
  if (opts?.studentId) {
    void queryClient.invalidateQueries({ queryKey: ["attendance-summary", opts.studentId] });
    void queryClient.invalidateQueries({ queryKey: ["attendance-monthly-trend", opts.studentId] });
    void queryClient.invalidateQueries({ queryKey: ["student-performance"] });
    void queryClient.invalidateQueries({ queryKey: ["parent-student-attendance", opts.studentId] });
  }
  if (opts?.classId) {
    void queryClient.invalidateQueries({ queryKey: ["class-attendance-summary", opts.classId] });
  }
  void queryClient.invalidateQueries({ queryKey: ["school-attendance-stats"] });
  void queryClient.invalidateQueries({ queryKey: ["school-attendance-trend"] });
}

export type { AttendanceSummary };
