import { supabase } from "@/integrations/supabase/client";
import { computeGrade, gradingFormatFromSettings, type GradingFormat } from "./grading";
import { formatRankLabel, subjectCanonicalKey, toReportSubjectName } from "./shepherd-grading";
import {
  notifyAdminsOfPoorPerformers,
  performanceTier,
  randomRemarkForAverage,
} from "./report-remarks";

export type ClassScoringProgress = {
  expected: number;
  filled: number;
  ready: boolean;
  studentCount: number;
  subjectCount: number;
  /** Students with all subject marks entered. */
  completedStudents: number;
  /** True when the class has students and subjects (ranking allowed with partial marks). */
  canRank: boolean;
};

export type RankingResult = {
  subjectUpdates: number;
  classPositions: number;
  reportCardsUpdated: number;
  reportCardsCreated?: number;
  eligibleStudents: number;
};

export { formatRankLabel } from "./shepherd-grading";

/** Invalidate all caches that display ranking / report-card positions. */
export function invalidateRankingQueries(
  qc: { invalidateQueries: (opts: { queryKey: string[] }) => void },
) {
  const keys = [
    ["class-results"],
    ["class-scoring-progress"],
    ["term-reports-history"],
    ["term-report"],
    ["admin-term-reports"],
    ["student-performance"],
    ["class-students-report"],
  ];
  for (const queryKey of keys) {
    qc.invalidateQueries({ queryKey });
  }
}

/** @alias Manual "Generate Positions" action */
export async function generateClassPositions(
  classId: string,
  termId: string,
): Promise<RankingResult> {
  return recalculateClassRankings(classId, termId);
}

/** Numeric subject score used for ranking (CA max 40 + exam max 60). */
export function resultRankingScore(ca: number | string | null, exam: number | string | null): number {
  const caN = Number(ca) || 0;
  const examN = Number(exam) || 0;
  return Math.round((caN + examN) * 10000) / 10000;
}

/** Assign competition ranks (1, 2, 2, 4) for equal scores; different scores → different ranks. */
export function assignCompetitionRanks(
  entries: { id: string; score: number }[],
): Map<string, number> {
  const normalized = entries.map((e) => ({
    id: e.id,
    score: Number(e.score) || 0,
  }));
  const sorted = [...normalized].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.id.localeCompare(b.id);
  });
  const ranks = new Map<string, number>();
  let rank = 0;
  let prevScore: number | null = null;
  for (let i = 0; i < sorted.length; i++) {
    const score = sorted[i].score;
    if (prevScore === null || score !== prevScore) {
      rank = i + 1;
      prevScore = score;
    }
    ranks.set(sorted[i].id, rank);
  }
  return ranks;
}

/** Rank students in one subject — only students with a mark entered (score > 0). */
export function rankSubjectScores(
  rows: {
    studentId: string;
    ca: number | string | null;
    exam: number | string | null;
    /** When true, include in ranking even if total is 0 (saved empty row). */
    hasMark?: boolean;
  }[],
): Map<string, number> {
  const entries = rows
    .filter((r) => {
      const score = resultRankingScore(r.ca, r.exam);
      return r.hasMark === true || score > 0;
    })
    .map((r) => ({
      id: r.studentId,
      score: resultRankingScore(r.ca, r.exam),
    }));
  if (!entries.length) return new Map();
  return assignCompetitionRanks(entries);
}

export type ClassRankingsBundle = {
  studentIds: string[];
  /** Per student → subject canonical key → competition rank. */
  subjectPositionsByStudent: Map<string, Map<string, number>>;
  /** Overall class rank per student. */
  classRankByStudent: Map<string, number>;
  resultUpdates: { id: string; position: number; grade: string; remark: string }[];
};

const rankingsCache = new Map<string, { at: number; bundle: ClassRankingsBundle }>();
const CACHE_TTL_MS = 60_000;

export function clearClassRankingsCache(classId?: string, termId?: string) {
  if (classId && termId) {
    for (const key of rankingsCache.keys()) {
      if (key.startsWith(`${classId}:${termId}:`)) rankingsCache.delete(key);
    }
  } else {
    rankingsCache.clear();
  }
}

async function fetchGradingFormatForClass(classId: string): Promise<GradingFormat> {
  const { data: cls } = await supabase.from("classes").select("school_id").eq("id", classId).maybeSingle();
  if (!cls?.school_id) return "letter";
  const { data: settings } = await supabase
    .from("school_settings")
    .select("grading_system")
    .eq("school_id", cls.school_id)
    .maybeSingle();
  return gradingFormatFromSettings(settings as { grading_system?: string | null } | undefined);
}

/** Compute subject + class ranks from all results in a class (source of truth for display). */
export async function computeClassRankingsBundle(
  classId: string,
  termId: string,
  gradingFormat?: GradingFormat,
): Promise<ClassRankingsBundle> {
  const format = gradingFormat ?? (await fetchGradingFormatForClass(classId));
  const cacheKey = `${classId}:${termId}:${format}`;
  const cached = rankingsCache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.bundle;

  const [{ data: students }, { data: classSubjects }, { data: reportCards }] = await Promise.all([
    supabase.from("students").select("id").eq("class_id", classId),
    supabase.from("class_subjects").select("subject_id, subjects(name)").eq("class_id", classId),
    supabase
      .from("term_report_cards")
      .select("student_id, subjects")
      .eq("class_id", classId)
      .eq("term_id", termId),
  ]);

  const studentIds = students?.map((s) => s.id) ?? [];
  const subjectIds = [...new Set(classSubjects?.map((cs) => cs.subject_id) ?? [])];
  const subjectNameById = new Map(
    (classSubjects ?? []).map((cs) => [
      cs.subject_id,
      (cs.subjects as { name: string } | null)?.name ?? "",
    ]),
  );

  const empty: ClassRankingsBundle = {
    studentIds,
    subjectPositionsByStudent: new Map(),
    classRankByStudent: new Map(),
    resultUpdates: [],
  };

  if (!studentIds.length || !subjectIds.length) {
    rankingsCache.set(cacheKey, { at: Date.now(), bundle: empty });
    return empty;
  }

  const { data: results, error } = await supabase
    .from("results")
    .select("id, student_id, subject_id, ca_score, exam_score")
    .in("student_id", studentIds)
    .in("subject_id", subjectIds)
    .eq("term_id", termId);

  if (error) throw error;

  // Build per-student per-canonical-subject score map from report-card subjects jsonb,
  // because teachers may enter marks directly on the report card form.
  const rcScoreByStudentSubject = new Map<string, Map<string, number>>();
  for (const rc of reportCards ?? []) {
    const subs =
      (rc.subjects as Array<{
        name?: string;
        total?: number | string;
        classScore?: number | string;
        examScore?: number | string;
      }>) ?? [];
    const m = rcScoreByStudentSubject.get(rc.student_id) ?? new Map<string, number>();
    for (const s of subs) {
      const key = subjectCanonicalKey(toReportSubjectName(s.name ?? ""));
      if (!key) continue;
      const total =
        Number(s.total) ||
        (Number(s.classScore) || 0) + (Number(s.examScore) || 0);
      const prev = m.get(key) ?? 0;
      if (total > prev) m.set(key, total);
    }
    rcScoreByStudentSubject.set(rc.student_id, m);
  }

  const subjectPositionsByStudent = new Map<string, Map<string, number>>();
  const resultUpdates: ClassRankingsBundle["resultUpdates"] = [];

  for (const subjectId of subjectIds) {
    const subjectName = subjectNameById.get(subjectId) ?? "";
    const canonical = subjectCanonicalKey(toReportSubjectName(subjectName));

    const entries = studentIds
      .map((sid) => {
        const r = (results ?? []).find(
          (x) => x.student_id === sid && x.subject_id === subjectId,
        );
        const resultScore = r ? resultRankingScore(r.ca_score, r.exam_score) : 0;
        const rcScore = rcScoreByStudentSubject.get(sid)?.get(canonical) ?? 0;
        const score = Math.max(resultScore, rcScore);
        return { id: sid, score, resultId: r?.id ?? null };
      })
      .filter((e) => e.score > 0);

    if (!entries.length) continue;

    const ranks = assignCompetitionRanks(
      entries.map((e) => ({ id: e.id, score: e.score })),
    );

    for (const e of entries) {
      const rank = ranks.get(e.id)!;
      if (!subjectPositionsByStudent.has(e.id)) {
        subjectPositionsByStudent.set(e.id, new Map());
      }
      subjectPositionsByStudent.get(e.id)!.set(canonical, rank);

      if (e.resultId) {
        const { grade, remark } = computeGrade(e.score, format);
        resultUpdates.push({ id: e.resultId, position: rank, grade, remark });
      }
    }
  }

  const classEntries = studentIds.map((sid) => {
    const perSubject: number[] = [];
    for (const subjectId of subjectIds) {
      const canonical = subjectCanonicalKey(
        toReportSubjectName(subjectNameById.get(subjectId) ?? ""),
      );
      const r = (results ?? []).find(
        (x) => x.student_id === sid && x.subject_id === subjectId,
      );
      const resultScore = r ? resultRankingScore(r.ca_score, r.exam_score) : 0;
      const rcScore = rcScoreByStudentSubject.get(sid)?.get(canonical) ?? 0;
      perSubject.push(Math.max(resultScore, rcScore));
    }
    const score = perSubject.length
      ? perSubject.reduce((a, b) => a + b, 0) / perSubject.length
      : 0;
    return { id: sid, score };
  });

  const classRankByStudent = assignCompetitionRanks(classEntries);

  const bundle: ClassRankingsBundle = {
    studentIds,
    subjectPositionsByStudent,
    classRankByStudent,
    resultUpdates,
  };

  rankingsCache.set(cacheKey, { at: Date.now(), bundle });
  return bundle;
}

/** Subject positions for one student from class-wide computed ranks. */
export async function getComputedSubjectPositionsForStudent(
  classId: string,
  termId: string,
  studentId: string,
): Promise<Map<string, number>> {
  const bundle = await computeClassRankingsBundle(classId, termId);
  return bundle.subjectPositionsByStudent.get(studentId) ?? new Map();
}

export type PositionCoverageMissing = {
  studentId: string;
  studentName: string;
  subjectName: string;
};

export type PositionCoverageReport = {
  studentCount: number;
  subjectCount: number;
  expected: number;
  covered: number;
  missingClassPosition: { studentId: string; studentName: string }[];
  missingSubjectPositions: PositionCoverageMissing[];
  studentsWithoutReportCard: { studentId: string; studentName: string }[];
  complete: boolean;
};

/** One-click check: confirm every student has a class position and a position for every subject. */
export async function checkClassPositionCoverage(
  classId: string,
  termId: string,
): Promise<PositionCoverageReport> {
  const [{ data: students }, { data: classSubjects }, { data: reportCards }] = await Promise.all([
    supabase.from("students").select("id, full_name").eq("class_id", classId).order("full_name"),
    supabase
      .from("class_subjects")
      .select("subject_id, subjects(name)")
      .eq("class_id", classId),
    supabase
      .from("term_report_cards")
      .select("student_id, subjects, class_position")
      .eq("class_id", classId)
      .eq("term_id", termId),
  ]);

  const studentList = (students ?? []).map((s) => ({
    studentId: s.id,
    studentName: s.full_name,
  }));
  const subjectNames = [
    ...new Set(
      (classSubjects ?? [])
        .map((cs) => (cs.subjects as { name: string } | null)?.name ?? "")
        .filter(Boolean),
    ),
  ];

  const expected = studentList.length * subjectNames.length;

  const rcByStudent = new Map<
    string,
    { subjects: Array<{ name?: string; position?: string | number | null }>; class_position: string | null }
  >();
  for (const rc of reportCards ?? []) {
    rcByStudent.set(rc.student_id, {
      subjects: (rc.subjects as Array<{ name?: string; position?: string | number | null }>) ?? [],
      class_position: rc.class_position,
    });
  }

  const isFilledPos = (v: string | number | null | undefined) => {
    if (v == null) return false;
    const s = String(v).trim();
    if (!s || s === "—") return false;
    return /\d/.test(s);
  };

  const missingSubjectPositions: PositionCoverageMissing[] = [];
  const missingClassPosition: { studentId: string; studentName: string }[] = [];
  const studentsWithoutReportCard: { studentId: string; studentName: string }[] = [];
  let covered = 0;

  for (const stu of studentList) {
    const rc = rcByStudent.get(stu.studentId);
    if (!rc) {
      studentsWithoutReportCard.push(stu);
      for (const subjectName of subjectNames) {
        missingSubjectPositions.push({
          studentId: stu.studentId,
          studentName: stu.studentName,
          subjectName,
        });
      }
      missingClassPosition.push(stu);
      continue;
    }
    if (!isFilledPos(rc.class_position)) missingClassPosition.push(stu);
    const posByKey = new Map<string, string | number | null | undefined>();
    for (const s of rc.subjects) {
      if (!s?.name) continue;
      posByKey.set(subjectCanonicalKey(toReportSubjectName(s.name)), s.position);
    }
    for (const subjectName of subjectNames) {
      const key = subjectCanonicalKey(toReportSubjectName(subjectName));
      if (isFilledPos(posByKey.get(key))) {
        covered += 1;
      } else {
        missingSubjectPositions.push({
          studentId: stu.studentId,
          studentName: stu.studentName,
          subjectName,
        });
      }
    }
  }

  return {
    studentCount: studentList.length,
    subjectCount: subjectNames.length,
    expected,
    covered,
    missingClassPosition,
    missingSubjectPositions,
    studentsWithoutReportCard,
    complete:
      expected > 0 &&
      covered === expected &&
      missingClassPosition.length === 0 &&
      studentsWithoutReportCard.length === 0,
  };
}

export async function getClassScoringProgress(
  classId: string,
  termId: string,
): Promise<ClassScoringProgress> {
  const [{ data: students }, { data: classSubjects }] = await Promise.all([
    supabase.from("students").select("id").eq("class_id", classId),
    supabase.from("class_subjects").select("subject_id").eq("class_id", classId),
  ]);

  const studentIds = students?.map((s) => s.id) ?? [];
  const subjectIds = [...new Set(classSubjects?.map((cs) => cs.subject_id) ?? [])];
  const expected = studentIds.length * subjectIds.length;

  if (!expected) {
    return {
      expected: 0,
      filled: 0,
      ready: false,
      canRank: false,
      studentCount: studentIds.length,
      subjectCount: subjectIds.length,
      completedStudents: 0,
    };
  }

  const { data: results } = await supabase
    .from("results")
    .select("student_id, subject_id")
    .in("student_id", studentIds)
    .in("subject_id", subjectIds)
    .eq("term_id", termId);

  const filled = results?.length ?? 0;

  const completedByStudent = new Map<string, Set<string>>();
  for (const r of results ?? []) {
    if (!completedByStudent.has(r.student_id)) {
      completedByStudent.set(r.student_id, new Set());
    }
    completedByStudent.get(r.student_id)!.add(r.subject_id);
  }
  const completedStudents = [...completedByStudent.values()].filter(
    (set) => set.size >= subjectIds.length,
  ).length;

  const canRank = studentIds.length > 0 && subjectIds.length > 0;

  return {
    expected,
    filled,
    ready: canRank,
    canRank,
    studentCount: studentIds.length,
    subjectCount: subjectIds.length,
    completedStudents,
  };
}

/**
 * Rank students per subject and overall class; persist positions to results and
 * sync report cards. Uses client-side numeric ranking (correct 3 vs 5 → 2nd vs 1st),
 * then optional RPC for report sync when the DB function is up to date.
 */
export async function recalculateClassRankings(
  classId: string,
  termId: string,
): Promise<RankingResult> {
  clearClassRankingsCache(classId, termId);
  const format = await fetchGradingFormatForClass(classId);
  const bundle = await computeClassRankingsBundle(classId, termId, format);

  // Persist via SECURITY DEFINER RPC. This bypasses per-row RLS issues where a
  // subject teacher can't update another teacher's results row, or a class
  // teacher can't update term_report_cards owned by another teacher. The RPC
  // writes: results.position/grade/remark, term_report_cards.subjects[].position,
  // and term_report_cards.class_position for every student in the class.
  let subjectUpdates = 0;
  let reportCardsUpdated = 0;
  const { data: rpcData, error: rpcError } = await supabase.rpc(
    "recalculate_class_rankings" as never,
    { p_class_id: classId, p_term_id: termId } as never,
  );
  if (rpcError) {
    console.error("recalculate_class_rankings RPC failed:", rpcError);
    // Fallback: best-effort client-side writes (may be limited by RLS).
    for (const upd of bundle.resultUpdates) {
      const { error } = await supabase
        .from("results")
        .update({ position: upd.position, grade: upd.grade, remark: upd.remark })
        .eq("id", upd.id);
      if (!error) subjectUpdates++;
    }
  } else if (rpcData && typeof rpcData === "object") {
    const r = rpcData as { subjectUpdates?: number; reportCardsUpdated?: number };
    subjectUpdates = r.subjectUpdates ?? bundle.resultUpdates.length;
    reportCardsUpdated = r.reportCardsUpdated ?? 0;
  }

  // Auto-remarks + poor-performer notifications (and class_position write for
  // any report card the RPC may have missed).
  try {
    await applyAutoRemarksAndAlerts(classId, termId, bundle, format);
  } catch (e) {
    console.warn("auto-remarks/alerts failed:", e);
  }

  clearClassRankingsCache(classId, termId);

  return {
    subjectUpdates,
    classPositions: bundle.classRankByStudent.size,
    reportCardsUpdated,
    reportCardsCreated: 0,
    eligibleStudents: bundle.studentIds.length,
  };
}

async function applyAutoRemarksAndAlerts(
  classId: string,
  termId: string,
  bundle: ClassRankingsBundle,
  gradingFormat: GradingFormat = "letter",
) {
  const [{ data: cls }, { data: term }, { data: students }, { data: reportCards }] =
    await Promise.all([
      supabase.from("classes").select("name, school_id").eq("id", classId).maybeSingle(),
      supabase.from("terms").select("name, session").eq("id", termId).maybeSingle(),
      supabase.from("students").select("id, full_name").eq("class_id", classId),
      supabase
        .from("term_report_cards")
        .select("id, student_id, status, teacher_remark, subjects")
        .eq("class_id", classId)
        .eq("term_id", termId),
    ]);

  const schoolId = cls?.school_id;
  const className = cls?.name ?? "";
  const termLabel = term ? `${term.name}${term.session ? ` ${term.session}` : ""}` : null;
  const nameById = new Map((students ?? []).map((s) => [s.id, s.full_name]));

  // Compute per-student average across saved subject totals (uses bundle source).
  const avgByStudent = new Map<string, number>();
  for (const rc of reportCards ?? []) {
    const subs =
      (rc.subjects as Array<{ total?: number | string; classScore?: number | string; examScore?: number | string }>) ?? [];
    const totals = subs
      .map((s) => Number(s.total) || (Number(s.classScore) || 0) + (Number(s.examScore) || 0))
      .filter((n) => n > 0);
    if (totals.length) {
      const avg = totals.reduce((a, b) => a + b, 0) / totals.length;
      avgByStudent.set(rc.student_id, avg);
    }
  }

  const poor: { name: string; average: number }[] = [];

  for (const rc of reportCards ?? []) {
    if (rc.status === "approved" || rc.status === "published") continue;
    const avg = avgByStudent.get(rc.student_id);

    // Sync per-subject remark/grade/position into the JSONB subjects column so
    // the Remarks input field reflects the freshly generated values without
    // requiring a separate results merge.
    const subjects = Array.isArray(rc.subjects)
      ? (rc.subjects as Array<Record<string, unknown>>)
      : [];
    const subjectPositions = bundle.subjectPositionsByStudent.get(rc.student_id);
    const nextSubjects = subjects.map((s) => {
      const name = String(s.name ?? "");
      const canonical = subjectCanonicalKey(name);
      const total =
        Number(s.total) || (Number(s.classScore) || 0) + (Number(s.examScore) || 0);
      const next: Record<string, unknown> = { ...s };
      if (total > 0) {
        const { grade, remark } = computeGrade(total, gradingFormat);
        next.grade = grade;
        next.remark = remark;
      }
      const rank = subjectPositions?.get(canonical);
      if (rank != null) next.position = formatRankLabel(rank);
      return next;
    });

    const update: Record<string, unknown> = { subjects: nextSubjects };

    // Persist overall class position for this student on the report card.
    const classRank = bundle.classRankByStudent.get(rc.student_id);
    if (classRank != null) update.class_position = formatRankLabel(classRank);

    if (avg != null) {
      const existing = (rc.teacher_remark ?? "").trim();
      // Only overwrite when blank — never replace a teacher's custom remark.
      if (!existing) update.teacher_remark = randomRemarkForAverage(avg);
    }

    const { error: updErr } = await supabase
      .from("term_report_cards")
      .update(update as never)
      .eq("id", rc.id);
    if (updErr) console.error("term_report_cards update failed:", rc.id, updErr);

    if (avg != null) {
      const tier = performanceTier(avg);
      if (tier === "poor" || tier === "weak") {
        poor.push({
          name: nameById.get(rc.student_id) ?? "Student",
          average: avg,
        });
      }
    }
  }

  if (schoolId && poor.length) {
    await notifyAdminsOfPoorPerformers({
      schoolId,
      className,
      termLabel,
      students: poor,
    });
  }
}

/** Read-only class rank for one student (total aggregate across subjects). */
export async function getStudentClassPosition(
  studentId: string,
  classId: string,
  termId: string,
): Promise<string | null> {
  const bundle = await computeClassRankingsBundle(classId, termId);
  const pos = bundle.classRankByStudent.get(studentId);
  return pos != null ? formatRankLabel(pos) : null;
}

/** @deprecated Use recalculateClassRankings */
export async function recalculateClassPositions(classId: string, termId: string) {
  await recalculateClassRankings(classId, termId);
}
