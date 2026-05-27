export type GradingFormat = "letter" | "numeric";

export interface GradeBand {
  range: string;
  grade: string;
  remark: string;
  min: number;
}

/** Letter grades (A, B+, C, …) — default Shepherd's Heart scale. */
export const LETTER_GRADE_BANDS: GradeBand[] = [
  { range: "80 – 100", grade: "A", remark: "Excellent", min: 80 },
  { range: "70 – 79", grade: "B+", remark: "Very Good", min: 70 },
  { range: "60 – 69", grade: "B", remark: "Good", min: 60 },
  { range: "55 – 59", grade: "C+", remark: "Credit", min: 55 },
  { range: "50 – 54", grade: "C", remark: "Credit", min: 50 },
  { range: "45 – 49", grade: "D+", remark: "Credit", min: 45 },
  { range: "40 – 44", grade: "D", remark: "Pass", min: 40 },
  { range: "35 – 39", grade: "E", remark: "Pass", min: 35 },
  { range: "0 – 34", grade: "F", remark: "Fail", min: 0 },
];

/** Numeric grades (1 = best, 9 = lowest) aligned to the same score bands. */
export const NUMERIC_GRADE_BANDS: GradeBand[] = [
  { range: "80 – 100", grade: "1", remark: "Excellent", min: 80 },
  { range: "70 – 79", grade: "2", remark: "Very Good", min: 70 },
  { range: "60 – 69", grade: "3", remark: "Good", min: 60 },
  { range: "55 – 59", grade: "4", remark: "Credit", min: 55 },
  { range: "50 – 54", grade: "5", remark: "Credit", min: 50 },
  { range: "45 – 49", grade: "6", remark: "Credit", min: 45 },
  { range: "40 – 44", grade: "7", remark: "Pass", min: 40 },
  { range: "35 – 39", grade: "8", remark: "Pass", min: 35 },
  { range: "0 – 34", grade: "9", remark: "Fail", min: 0 },
];

export function normalizeGradingFormat(value: string | null | undefined): GradingFormat {
  return value === "numeric" ? "numeric" : "letter";
}

export function gradingFormatFromSettings(
  settings: { grading_system?: string | null } | null | undefined,
): GradingFormat {
  return normalizeGradingFormat(settings?.grading_system);
}

export function gradingFormatLabel(format: GradingFormat): string {
  return format === "numeric" ? "Numeric (1, 2, 3…)" : "Letter (A, B, C…)";
}

export function getGradeScale(format: GradingFormat = "letter"): GradeBand[] {
  return format === "numeric" ? NUMERIC_GRADE_BANDS : LETTER_GRADE_BANDS;
}

export function computeGrade(
  total: number,
  format: GradingFormat = "letter",
): { grade: string; remark: string } {
  if (total <= 0) return { grade: "—", remark: "—" };

  const bands = getGradeScale(format);
  for (const band of bands) {
    if (total >= band.min) return { grade: band.grade, remark: band.remark };
  }

  const lowest = bands[bands.length - 1];
  return { grade: lowest.grade, remark: lowest.remark };
}

export function gradeColor(_grade: string): string {
  return "text-foreground";
}
