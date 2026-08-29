import { supabase } from "@/integrations/supabase/client";
import { fetchClassSubjectTemplates } from "@/report/lib/class-subjects";
import { assignCompetitionRanks } from "@/report/lib/ranking";
import {
  formatRankLabel,
  subjectCanonicalKey,
  totalFromSubjects,
  type SubjectRow,
} from "@/report/lib/shepherd-grading";

export type OverallClassSubjectCell = {
  score: number | null;
  rank: number | null;
};

export type OverallClassStudentRow = {
  studentId: string;
  name: string;
  hasReport: boolean;
  reportId: string | null;
  scores: OverallClassSubjectCell[];
  total: number | null;
  average: number | null;
  overallRank: number | null;
};

export type OverallClassReportData = {
  classId: string;
  className: string;
  termId: string;
  termLabel: string;
  academicYear: string;
  subjects: string[];
  students: OverallClassStudentRow[];
};

function parsePosition(value: string | number | null | undefined): number | null {
  if (value == null || value === "" || value === "—") return null;
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.round(value);
  }
  const n = parseInt(String(value).replace(/\D/g, ""), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function subjectScoreMap(subjects: SubjectRow[] | null | undefined): Map<string, SubjectRow> {
  const map = new Map<string, SubjectRow>();
  for (const row of subjects ?? []) {
    if (!row?.name) continue;
    map.set(subjectCanonicalKey(row.name), row);
  }
  return map;
}

/**
 * Build the Overall Class Report from individual term_report_cards.
 * Scores come from each student's saved report-card subjects; ranks are
 * recomputed live so edits on a single card appear here immediately.
 */
export async function fetchOverallClassReport(opts: {
  classId: string;
  termId: string;
  className?: string;
  termLabel?: string;
  academicYear?: string;
}): Promise<OverallClassReportData> {
  const [{ data: students, error: studentsErr }, subjectTemplates, reportsResult] =
    await Promise.all([
      supabase
        .from("students")
        .select("id, full_name")
        .eq("class_id", opts.classId)
        .order("full_name"),
      fetchClassSubjectTemplates(opts.classId),
      supabase
        .from("term_report_cards")
        .select(
          "id, student_id, student_name, class_name, term_label, academic_year, class_position, subjects, total_score, updated_at",
        )
        .eq("class_id", opts.classId)
        .eq("term_id", opts.termId),
    ]);

  if (studentsErr) throw studentsErr;
  if (reportsResult.error) throw reportsResult.error;

  const reports = reportsResult.data ?? [];
  const reportByStudent = new Map<string, (typeof reports)[number]>();
  const duplicateStudentIds = new Set<string>();
  for (const r of reports) {
    const sid = r.student_id as string;
    if (reportByStudent.has(sid)) {
      duplicateStudentIds.add(sid);
      // Prefer the most recently updated row when duplicates exist.
      const prev = reportByStudent.get(sid)!;
      const prevAt = Date.parse(String(prev.updated_at ?? 0));
      const nextAt = Date.parse(String(r.updated_at ?? 0));
      if (nextAt >= prevAt) reportByStudent.set(sid, r);
    } else {
      reportByStudent.set(sid, r);
    }
  }
  if (duplicateStudentIds.size > 0) {
    console.warn(
      `Overall class report: ${duplicateStudentIds.size} student(s) have duplicate term_report_cards for class ${opts.classId} / term ${opts.termId}`,
      [...duplicateStudentIds],
    );
  }

  const subjectNames =
    subjectTemplates.length > 0
      ? subjectTemplates.map((s) => s.name)
      : (() => {
          const seen = new Set<string>();
          const names: string[] = [];
          for (const r of reports) {
            for (const s of (r.subjects as SubjectRow[] | null) ?? []) {
              const key = subjectCanonicalKey(s.name);
              if (seen.has(key)) continue;
              seen.add(key);
              names.push(s.name);
            }
          }
          return names;
        })();

  const className =
    opts.className ||
    reports.find((r) => r.class_name)?.class_name ||
    "Class";
  const termLabel =
    opts.termLabel ||
    reports.find((r) => r.term_label)?.term_label ||
    "Current Term";
  const academicYear =
    opts.academicYear ||
    reports.find((r) => r.academic_year)?.academic_year ||
    "";

  type Built = {
    studentId: string;
    name: string;
    hasReport: boolean;
    reportId: string | null;
    subjectScores: (number | null)[];
    total: number | null;
    average: number | null;
    storedOverall: number | null;
    storedSubjectRanks: (number | null)[];
  };

  const built: Built[] = (students ?? []).map((stu) => {
    const report = reportByStudent.get(stu.id);
    if (!report) {
      return {
        studentId: stu.id,
        name: stu.full_name,
        hasReport: false,
        reportId: null,
        subjectScores: subjectNames.map(() => null),
        total: null,
        average: null,
        storedOverall: null,
        storedSubjectRanks: subjectNames.map(() => null),
      };
    }

    const byKey = subjectScoreMap(report.subjects as SubjectRow[]);
    const subjectScores = subjectNames.map((name) => {
      const row = byKey.get(subjectCanonicalKey(name));
      if (!row) return null;
      const total = Number(row.total) || 0;
      return total > 0 ? total : null;
    });
    const subjectsForTotal = subjectNames.map((name) => {
      const row = byKey.get(subjectCanonicalKey(name));
      return row ?? { name, classScore: 0, examScore: 0, total: 0, position: "—", grade: "—", remark: "—" };
    });
    const total =
      report.total_score != null && Number(report.total_score) > 0
        ? Number(report.total_score)
        : totalFromSubjects(subjectsForTotal) || null;
    const scoredCount = subjectScores.filter((s) => s != null && s > 0).length;
    const average =
      total != null && scoredCount > 0 ? total / scoredCount : null;

    return {
      studentId: stu.id,
      name: (report.student_name as string) || stu.full_name,
      hasReport: true,
      reportId: report.id as string,
      subjectScores,
      total: total && total > 0 ? total : null,
      average,
      storedOverall: parsePosition(report.class_position as string | null),
      storedSubjectRanks: subjectNames.map((name) => {
        const row = byKey.get(subjectCanonicalKey(name));
        return parsePosition(row?.position);
      }),
    };
  });

  // Live competition ranks from current scores (keeps class report in sync with card edits).
  const overallRanks = assignCompetitionRanks(
    built
      .filter((b) => b.total != null && b.total > 0)
      .map((b) => ({ id: b.studentId, score: b.total as number })),
  );

  const subjectRankMaps = subjectNames.map((_, subjIdx) =>
    assignCompetitionRanks(
      built
        .filter((b) => {
          const s = b.subjectScores[subjIdx];
          return s != null && s > 0;
        })
        .map((b) => ({ id: b.studentId, score: b.subjectScores[subjIdx] as number })),
    ),
  );

  const studentsOut: OverallClassStudentRow[] = built.map((b) => {
    const liveOverall = overallRanks.get(b.studentId) ?? null;
    return {
      studentId: b.studentId,
      name: b.name,
      hasReport: b.hasReport,
      reportId: b.reportId,
      scores: b.subjectScores.map((score, j) => ({
        score,
        rank: subjectRankMaps[j].get(b.studentId) ?? b.storedSubjectRanks[j] ?? null,
      })),
      total: b.total,
      average: b.average,
      overallRank: liveOverall ?? b.storedOverall,
    };
  });

  studentsOut.sort((a, b) => {
    const ra = a.overallRank ?? Number.POSITIVE_INFINITY;
    const rb = b.overallRank ?? Number.POSITIVE_INFINITY;
    if (ra !== rb) return ra - rb;
    return a.name.localeCompare(b.name);
  });

  return {
    classId: opts.classId,
    className,
    termId: opts.termId,
    termLabel,
    academicYear,
    subjects: subjectNames,
    students: studentsOut,
  };
}

export { formatRankLabel };
