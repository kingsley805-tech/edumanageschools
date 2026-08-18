import { supabase } from "@/integrations/supabase/client";
import type {
  PerformanceDashboardStats,
  PerformanceFilters,
  PerformanceRow,
} from "@/modules/performance/lib/types";

type SubjectEntry = {
  name?: string;
  score?: number | string;
  total?: number | string;
  grade?: string;
  remark?: string;
};

function toFiniteNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function countFailedSubjects(subjects: unknown): number {
  if (!Array.isArray(subjects)) return 0;
  let failed = 0;
  for (const raw of subjects as SubjectEntry[]) {
    const grade = String(raw.grade ?? "").toUpperCase();
    const remark = String(raw.remark ?? "").toLowerCase();
    const score = Number(raw.score);
    const total = Number(raw.total) || 100;
    if (grade === "F" || grade === "9" || remark.includes("fail")) {
      failed += 1;
      continue;
    }
    if (Number.isFinite(score) && total > 0 && (score / total) * 100 < 40) {
      failed += 1;
    }
  }
  return failed;
}

function attendanceRate(made: string | null, total: string | null): number | null {
  const m = Number(made);
  const t = Number(total);
  if (!Number.isFinite(m) || !Number.isFinite(t) || t <= 0) return null;
  return Math.round((m / t) * 1000) / 10;
}

export async function fetchPerformanceRows(
  schoolId: string,
  filters: PerformanceFilters,
): Promise<PerformanceRow[]> {
  let query = supabase
    .from("term_report_cards")
    .select(
      "id, student_id, student_name, class_name, academic_year, term_label, total_score, class_position, attendance_made, attendance_total, conduct, attitude, subjects, students(admission_number)",
    )
    .eq("school_id", schoolId)
    .in("status", ["approved", "published"]);

  if (filters.academicYear) query = query.eq("academic_year", filters.academicYear);
  if (filters.termLabel) query = query.eq("term_label", filters.termLabel);
  if (filters.className) query = query.eq("class_name", filters.className);

  const { data, error } = await query.order("total_score", { ascending: false });
  if (error) throw error;

  const studentIds = [...new Set((data ?? []).map((r) => r.student_id))];
  const awardsMap = new Map<string, number>();

  if (studentIds.length > 0) {
    const { data: awards } = await supabase
      .from("achievements")
      .select("student_id")
      .eq("school_id", schoolId)
      .eq("is_archived", false)
      .in("status", ["approved", "active"])
      .in("student_id", studentIds);
    for (const a of awards ?? []) {
      awardsMap.set(a.student_id, (awardsMap.get(a.student_id) ?? 0) + 1);
    }
  }

  const search = filters.search.trim().toLowerCase();
  const rows: PerformanceRow[] = (data ?? []).map((r) => {
    const admission =
      (r.students as { admission_number?: string } | null)?.admission_number ?? "";
    return {
      student_id: r.student_id,
      student_name: r.student_name,
      admission_number: admission,
      class_name: r.class_name ?? "",
      academic_year: r.academic_year,
      term_label: r.term_label,
      total_score: toFiniteNumber(r.total_score, 0),
      class_position: (() => {
        if (r.class_position == null || String(r.class_position).trim() === "") return null;
        const n = Number(r.class_position);
        return Number.isFinite(n) ? n : null;
      })(),
      attendance_rate: attendanceRate(r.attendance_made, r.attendance_total),
      conduct: r.conduct,
      attitude: r.attitude,
      awards_count: awardsMap.get(r.student_id) ?? 0,
      failed_subjects: countFailedSubjects(r.subjects),
      report_id: r.id,
    };
  });

  if (!search) return rows;
  return rows.filter(
    (r) =>
      r.student_name.toLowerCase().includes(search) ||
      r.admission_number.toLowerCase().includes(search) ||
      r.class_name.toLowerCase().includes(search),
  );
}

export function computePerformanceStats(rows: PerformanceRow[]): PerformanceDashboardStats {
  if (rows.length === 0) {
    return { total_ranked: 0, avg_score: 0, top_avg: 0, low_count: 0, attendance_issues: 0 };
  }
  const scores = rows.map((r) => r.total_score).filter((n) => Number.isFinite(n));
  if (scores.length === 0) {
    return {
      total_ranked: rows.length,
      avg_score: 0,
      top_avg: 0,
      low_count: rows.filter((r) => r.failed_subjects > 0).length,
      attendance_issues: rows.filter(
        (r) => r.attendance_rate != null && r.attendance_rate < 80,
      ).length,
    };
  }
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  const top = [...rows]
    .filter((r) => Number.isFinite(r.total_score))
    .sort((a, b) => b.total_score - a.total_score)
    .slice(0, 10);
  const topAvg = top.reduce((a, b) => a + b.total_score, 0) / Math.max(top.length, 1);
  return {
    total_ranked: rows.length,
    avg_score: Math.round(avg * 10) / 10,
    top_avg: Math.round(topAvg * 10) / 10,
    low_count: rows.filter((r) => r.total_score < 50 || r.failed_subjects > 0).length,
    attendance_issues: rows.filter(
      (r) => r.attendance_rate != null && r.attendance_rate < 80,
    ).length,
  };
}

export async function fetchPerformanceFilterOptions(schoolId: string) {
  const { data, error } = await supabase
    .from("term_report_cards")
    .select("academic_year, term_label, class_name")
    .eq("school_id", schoolId);
  if (error) throw error;
  const years = [...new Set((data ?? []).map((r) => r.academic_year).filter(Boolean))] as string[];
  const terms = [...new Set((data ?? []).map((r) => r.term_label).filter(Boolean))] as string[];
  const classes = [...new Set((data ?? []).map((r) => r.class_name).filter(Boolean))] as string[];
  return {
    years: years.sort(),
    terms: terms.sort(),
    classes: classes.sort(),
  };
}
