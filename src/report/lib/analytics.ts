import { computeGrade, type GradingFormat } from "./grading";

export interface ResultRow {
  student_id: string;
  student_name?: string;
  subject_id: string;
  subject_name?: string;
  ca_score: number;
  exam_score: number;
  total: number;
  grade: string | null;
  position?: number | null;
}

export function calculateGPA(totals: number[]): number {
  if (!totals.length) return 0;
  const points: number[] = totals.map((t) => {
    if (t >= 80) return 4;
    if (t >= 70) return 3;
    if (t >= 60) return 2.5;
    if (t >= 50) return 2;
    if (t >= 40) return 1.5;
    return 0;
  });
  return Math.round((points.reduce((a, b) => a + b, 0) / points.length) * 100) / 100;
}

export function studentAverage(results: ResultRow[]): number {
  if (!results.length) return 0;
  const sum = results.reduce((a, r) => a + Number(r.total || 0), 0);
  return Math.round((sum / results.length) * 10) / 10;
}

export function rankStudents(
  students: { id: string; name: string }[],
  results: ResultRow[],
): { id: string; name: string; average: number; position: number }[] {
  const avgs = students.map((s) => ({
    id: s.id,
    name: s.name,
    average: studentAverage(results.filter((r) => r.student_id === s.id)),
  }));
  avgs.sort((a, b) => b.average - a.average);
  return avgs.map((s, i) => ({ ...s, position: i + 1 }));
}

export function subjectStats(results: ResultRow[]) {
  const bySubject = new Map<string, { name: string; scores: number[] }>();
  for (const r of results) {
    const key = r.subject_id;
    const entry = bySubject.get(key) ?? { name: r.subject_name || "Subject", scores: [] };
    entry.scores.push(Number(r.total));
    bySubject.set(key, entry);
  }
  return Array.from(bySubject.entries()).map(([id, { name, scores }]) => ({
    subject_id: id,
    subject_name: name,
    average: Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10,
    pass_rate: Math.round((scores.filter((s) => s >= 40).length / scores.length) * 100),
    count: scores.length,
  }));
}

export function passFailRatio(results: ResultRow[], passMark = 40) {
  const totals = results.map((r) => Number(r.total));
  if (!totals.length) return { pass: 0, fail: 0, passRate: 0 };
  const pass = totals.filter((t) => t >= passMark).length;
  const fail = totals.length - pass;
  return { pass, fail, passRate: Math.round((pass / totals.length) * 100) };
}

export function enrichResults<T extends { ca_score: number; exam_score: number; grade?: string | null; remark?: string | null }>(
  rows: T[],
  gradingFormat: GradingFormat = "letter",
): (T & { total: number; grade: string; remark: string })[] {
  return rows.map((r) => {
    const total = Number(r.ca_score || 0) + Number(r.exam_score || 0);
    const { grade, remark } = computeGrade(total, gradingFormat);
    return { ...r, total, grade: r.grade || grade, remark: remark };
  });
}
