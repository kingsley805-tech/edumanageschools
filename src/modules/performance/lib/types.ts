export type PerformanceRow = {
  student_id: string;
  student_name: string;
  admission_number: string;
  class_name: string;
  academic_year: string | null;
  term_label: string | null;
  total_score: number;
  class_position: number | null;
  attendance_rate: number | null;
  conduct: string | null;
  attitude: string | null;
  awards_count: number;
  failed_subjects: number;
  report_id: string | null;
};

export type PerformanceFilters = {
  academicYear: string;
  termLabel: string;
  className: string;
  search: string;
};

export type PerformanceDashboardStats = {
  total_ranked: number;
  avg_score: number;
  top_avg: number;
  low_count: number;
  attendance_issues: number;
};
