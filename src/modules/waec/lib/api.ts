import { supabase } from "@/integrations/supabase/client";
import { invokeEdgeFunction, isEdgeFunctionUnreachable } from "@/lib/invokeEdgeFunction";
import type {
  WaecCatalogEntry,
  WaecGenerationRequest,
  WaecGenerationResult,
  WaecLeaderboardEntry,
  WaecLevel,
  WaecPracticeConfig,
  WaecPracticeSession,
  WaecQuestion,
  WaecQuestionOption,
  WaecQuestionStatus,
  WaecSessionAnswer,
  WaecStudentDashboard,
  WaecSubject,
} from "@/modules/waec/lib/types";

const PAGE_SIZE = 1000;

const EMPTY_DASHBOARD: WaecStudentDashboard = {
  total_attempts: 0,
  average_score: 0,
  best_subject: null,
  weak_subject: null,
  questions_solved: 0,
};

function parseOptions(raw: unknown): WaecQuestionOption[] | null {
  if (!raw || !Array.isArray(raw)) return null;
  return raw as WaecQuestionOption[];
}

export async function fetchWaecSubjects(level?: string): Promise<WaecSubject[]> {
  let q = supabase.from("waec_subjects").select("*").eq("is_active", true).order("sort_order");
  if (level) q = q.eq("level", level);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as WaecSubject[];
}

function mapQuestionRow(row: Record<string, unknown>): WaecQuestion {
  return {
    ...(row as WaecQuestion),
    marks: Number(row.marks ?? 1),
    options: parseOptions(row.options),
    subject_name: (row.waec_subjects as { name?: string } | null)?.name,
  };
}

/** Fetch every matching question with pagination (no arbitrary cap). */
export async function fetchWaecQuestions(filters: {
  subjectId?: string;
  level?: WaecLevel;
  year?: number;
  paperType?: string;
  topic?: string;
  limit?: number;
}): Promise<WaecQuestion[]> {
  if (filters.level && !filters.subjectId) {
    const subjects = await fetchWaecSubjects(filters.level);
    const batches = await Promise.all(
      subjects.map((s) =>
        fetchWaecQuestions({ ...filters, subjectId: s.id, level: undefined }),
      ),
    );
    const merged = batches.flat();
    return filters.limit ? merged.slice(0, filters.limit) : merged;
  }

  if (!filters.subjectId) {
    return filters.limit ? [] : [];
  }

  const all: WaecQuestion[] = [];
  let from = 0;

  while (true) {
    let q = supabase
      .from("waec_questions")
      .select("*, waec_subjects(name, level)")
      .eq("subject_id", filters.subjectId)
      .eq("is_active", true)
      .order("id")
      .range(from, from + PAGE_SIZE - 1);

    if (filters.year != null) q = q.eq("year", filters.year);
    if (filters.paperType) q = q.eq("paper_type", filters.paperType);
    if (filters.topic) q = q.ilike("topic", `%${filters.topic}%`);

    const { data, error } = await q;
    if (error) throw error;

    const batch = (data ?? []).map((row) => mapQuestionRow(row));
    all.push(...batch);

    if (filters.limit && all.length >= filters.limit) {
      return all.slice(0, filters.limit);
    }
    if (batch.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return filters.limit ? all.slice(0, filters.limit) : all;
}

export async function fetchWaecExamYears(level?: WaecLevel): Promise<number[]> {
  let q = supabase.from("waec_exam_years").select("year").eq("is_active", true).order("year", { ascending: false });
  if (level) q = q.eq("level", level);
  const { data, error } = await q;
  if (error) {
    // Fallback if catalog table not installed yet
    const { data: fromQuestions } = await supabase
      .from("waec_questions")
      .select("year, waec_subjects(level)")
      .eq("is_active", true);
    const years = new Set<number>();
    for (const r of fromQuestions ?? []) {
      if (!level || (r.waec_subjects as { level?: string } | null)?.level === level) {
        years.add(r.year as number);
      }
    }
    return [...years].sort((a, b) => b - a);
  }
  return [...new Set((data ?? []).map((r) => r.year))];
}

export async function fetchWaecQuestionYears(subjectId: string): Promise<number[]> {
  const { data, error } = await supabase
    .from("waec_questions")
    .select("year")
    .eq("subject_id", subjectId)
    .eq("is_active", true);
  if (error) throw error;
  return [...new Set((data ?? []).map((r) => r.year))].sort((a, b) => b - a);
}

export async function fetchWaecQuestionCount(filters: {
  subjectId: string;
  year?: number;
  paperType?: string;
  topic?: string;
}): Promise<number> {
  let q = supabase
    .from("waec_questions")
    .select("id", { count: "exact", head: true })
    .eq("subject_id", filters.subjectId)
    .eq("is_active", true);
  if (filters.year) q = q.eq("year", filters.year);
  if (filters.paperType) q = q.eq("paper_type", filters.paperType);
  if (filters.topic) q = q.ilike("topic", `%${filters.topic}%`);
  const { count, error } = await q;
  if (error) throw error;
  return count ?? 0;
}

/** Full catalogue: every subject with question counts (no year grouping). */
export async function fetchWaecCatalog(level?: WaecLevel): Promise<WaecCatalogEntry[]> {
  const { data, error } = await supabase.rpc("get_waec_question_catalog", {
    p_level: level ?? null,
  });
  if (!error && data) {
    return data as WaecCatalogEntry[];
  }

  const subjects = await fetchWaecSubjects(level);
  const entries: WaecCatalogEntry[] = [];

  for (const subject of subjects) {
    const questions = await fetchWaecQuestions({ subjectId: subject.id });
    const topics = [...new Set(questions.map((q) => q.topic).filter(Boolean) as string[])].sort();
    entries.push({
      subject_id: subject.id,
      subject_name: subject.name,
      level: subject.level,
      category: subject.category,
      total_questions: questions.length,
      topics,
    });
  }

  return entries.sort((a, b) => a.subject_name.localeCompare(b.subject_name));
}

export async function fetchWaecTopics(subjectId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("waec_questions")
    .select("topic")
    .eq("subject_id", subjectId)
    .eq("is_active", true)
    .not("topic", "is", null);
  if (error) throw error;
  return [...new Set((data ?? []).map((r) => r.topic).filter(Boolean) as string[])].sort();
}

export async function startWaecSession(
  userId: string,
  schoolId: string | null,
  studentId: string | null,
  config: WaecPracticeConfig,
): Promise<{ session: WaecPracticeSession; questions: WaecQuestion[] }> {
  const pool = await fetchWaecQuestions({
    subjectId: config.subjectId,
    paperType: config.paperType,
    topic: config.topic,
  });

  if (pool.length === 0) {
    throw new Error("No questions found for this subject. Ask your teacher to generate the question bank.");
  }

  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, Math.min(config.questionCount, shuffled.length));
  const questionIds = selected.map((q) => q.id);

  const { data: session, error } = await supabase
    .from("waec_practice_sessions")
    .insert({
      user_id: userId,
      school_id: schoolId,
      student_id: studentId,
      subject_id: config.subjectId,
      level: config.level,
      mode: config.mode,
      year_filter: null,
      paper_type: config.paperType,
      topic_filter: config.topic ?? null,
      question_count: selected.length,
      duration_minutes: config.durationMinutes ?? (config.mode === "exam" ? 120 : null),
      question_ids: questionIds,
      max_score: selected.reduce((s, q) => s + q.marks, 0),
      status: "in_progress",
    })
    .select("*")
    .single();

  if (error) throw error;

  const answerRows = questionIds.map((qid) => ({
    session_id: session.id,
    question_id: qid,
  }));
  const { error: ansErr } = await supabase.from("waec_session_answers").insert(answerRows);
  if (ansErr) throw ansErr;

  return {
    session: session as WaecPracticeSession,
    questions: selected,
  };
}

/** Start a session from an explicit set of question IDs (used by the AI exam generator). */
export async function startWaecSessionFromQuestions(
  userId: string,
  schoolId: string | null,
  studentId: string | null,
  config: WaecPracticeConfig,
  questionIds: string[],
): Promise<{ session: WaecPracticeSession; questions: WaecQuestion[] }> {
  const uniqueIds = [...new Set(questionIds)].filter(Boolean);
  if (uniqueIds.length === 0) {
    throw new Error("No questions were generated. Try again.");
  }

  const { data: rows, error: qErr } = await supabase
    .from("waec_questions")
    .select("*, waec_subjects(name, level)")
    .in("id", uniqueIds);
  if (qErr) throw qErr;

  const byId = new Map((rows ?? []).map((r) => [r.id as string, mapQuestionRow(r)]));
  const selected = uniqueIds.map((id) => byId.get(id)).filter(Boolean) as WaecQuestion[];
  if (selected.length === 0) {
    throw new Error("Generated questions could not be loaded. Try again.");
  }

  const orderedIds = selected.map((q) => q.id);

  const { data: session, error } = await supabase
    .from("waec_practice_sessions")
    .insert({
      user_id: userId,
      school_id: schoolId,
      student_id: studentId,
      subject_id: config.subjectId,
      level: config.level,
      mode: config.mode,
      year_filter: null,
      paper_type: config.paperType,
      topic_filter: config.topic ?? null,
      question_count: selected.length,
      duration_minutes: config.durationMinutes ?? (config.mode === "exam" ? 120 : null),
      question_ids: orderedIds,
      max_score: selected.reduce((s, q) => s + q.marks, 0),
      status: "in_progress",
    })
    .select("*")
    .single();

  if (error) throw error;

  const answerRows = orderedIds.map((qid) => ({ session_id: session.id, question_id: qid }));
  const { error: ansErr } = await supabase.from("waec_session_answers").insert(answerRows);
  if (ansErr) throw ansErr;

  return { session: session as WaecPracticeSession, questions: selected };
}

export async function saveWaecAnswer(sessionId: string, questionId: string, answer: string) {
  const { error } = await supabase
    .from("waec_session_answers")
    .update({ selected_answer: answer, answered_at: new Date().toISOString() })
    .eq("session_id", sessionId)
    .eq("question_id", questionId);
  if (error) throw error;
}

export async function submitWaecSession(sessionId: string) {
  const { data, error } = await supabase.rpc("submit_waec_session", { p_session_id: sessionId });
  if (error) throw error;
  const result = data as { ok?: boolean; error?: string };
  if (!result?.ok) throw new Error(result?.error ?? "Submit failed");
  return result;
}

export async function fetchWaecSession(sessionId: string): Promise<{
  session: WaecPracticeSession;
  answers: WaecSessionAnswer[];
  questions: WaecQuestion[];
}> {
  const { data: session, error } = await supabase
    .from("waec_practice_sessions")
    .select("*, waec_subjects(name)")
    .eq("id", sessionId)
    .single();
  if (error) throw error;

  const { data: answers, error: aErr } = await supabase
    .from("waec_session_answers")
    .select("*")
    .eq("session_id", sessionId);
  if (aErr) throw aErr;

  const questionIds = (session.question_ids as string[]) ?? [];
  const { data: questions, error: qErr } = await supabase
    .from("waec_questions")
    .select("*")
    .in("id", questionIds);
  if (qErr) throw qErr;

  const qMap = new Map(
    (questions ?? []).map((q) => [
      q.id,
      { ...q, marks: Number(q.marks), options: parseOptions(q.options) } as WaecQuestion,
    ]),
  );

  return {
    session: {
      ...(session as WaecPracticeSession),
      subject_name: (session.waec_subjects as { name?: string } | null)?.name,
    },
    answers: (answers ?? []).map((a) => ({
      ...a,
      marks_awarded: Number(a.marks_awarded),
      question: qMap.get(a.question_id),
    })),
    questions: questionIds.map((id) => qMap.get(id)).filter(Boolean) as WaecQuestion[],
  };
}

export async function fetchStudentWaecSessions(userId: string): Promise<WaecPracticeSession[]> {
  const { data, error } = await supabase
    .from("waec_practice_sessions")
    .select("*, waec_subjects(name)")
    .eq("user_id", userId)
    .order("started_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []).map((s) => ({
    ...s,
    score: Number(s.score),
    max_score: Number(s.max_score),
    percentage: Number(s.percentage),
    subject_name: (s.waec_subjects as { name?: string } | null)?.name,
  }));
}

export async function fetchWaecDashboard(userId: string): Promise<WaecStudentDashboard> {
  const { data, error } = await supabase.rpc("get_waec_student_dashboard", { p_user_id: userId });
  if (error) throw error;
  return { ...EMPTY_DASHBOARD, ...(data as WaecStudentDashboard) };
}

export async function fetchWaecLeaderboard(schoolId: string | null, limit = 20): Promise<WaecLeaderboardEntry[]> {
  let q = supabase
    .from("waec_practice_sessions")
    .select("user_id, percentage, score, profiles(full_name), schools(name)")
    .eq("status", "submitted")
    .order("percentage", { ascending: false })
    .limit(200);

  if (schoolId) q = q.eq("school_id", schoolId);

  const { data, error } = await q;
  if (error) throw error;

  const map = new Map<string, WaecLeaderboardEntry>();
  for (const row of data ?? []) {
    const uid = row.user_id as string;
    const cur = map.get(uid) ?? {
      user_id: uid,
      student_name: (row.profiles as { full_name?: string } | null)?.full_name ?? "Student",
      school_name: (row.schools as { name?: string } | null)?.name ?? null,
      total_score: 0,
      attempts: 0,
      avg_percentage: 0,
    };
    cur.attempts += 1;
    cur.total_score += Number(row.score ?? 0);
    cur.avg_percentage += Number(row.percentage ?? 0);
    map.set(uid, cur);
  }

  return [...map.values()]
    .map((e) => ({ ...e, avg_percentage: Math.round(e.avg_percentage / e.attempts) }))
    .sort((a, b) => b.avg_percentage - a.avg_percentage)
    .slice(0, limit);
}

// Admin question management
export async function saveWaecQuestion(
  payload: Partial<WaecQuestion> & { subject_id: string; question_text: string; correct_answer: string },
  schoolId: string | null,
  id?: string,
) {
  const row = {
    school_id: schoolId,
    subject_id: payload.subject_id,
    year: null,
    paper_type: payload.paper_type ?? "paper_1",
    topic: payload.topic ?? null,
    difficulty: payload.difficulty ?? "medium",
    question_text: payload.question_text.trim(),
    options: payload.options ?? null,
    correct_answer: payload.correct_answer.trim(),
    explanation: payload.explanation ?? null,
    marking_scheme: payload.marking_scheme ?? null,
    marks: payload.marks ?? 1,
    is_active: payload.is_active ?? true,
    updated_at: new Date().toISOString(),
  };

  if (id) {
    const { error } = await supabase.from("waec_questions").update(row).eq("id", id);
    if (error) throw error;
    return id;
  }

  const { data, error } = await supabase.from("waec_questions").insert(row).select("id").single();
  if (error) throw error;
  return data.id;
}

export async function deleteWaecQuestion(id: string) {
  const { error } = await supabase.from("waec_questions").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchAllWaecQuestionsAdmin(filters?: {
  subjectId?: string;
  level?: WaecLevel;
  search?: string;
}): Promise<WaecQuestion[]> {
  let rows = await fetchWaecQuestions({
    subjectId: filters?.subjectId,
    level: filters?.level,
  });

  if (filters?.search) {
    const s = filters.search.toLowerCase();
    rows = rows.filter((r) => r.question_text.toLowerCase().includes(s));
  }

  return rows;
}

// ---------------------------------------------------------------------------
// AI Question Generation Engine
// ---------------------------------------------------------------------------

/** Ask the AI to generate a batch of questions for a subject. */
export async function generateWaecQuestions(
  req: WaecGenerationRequest,
): Promise<WaecGenerationResult> {
  const payload = {
    subjectId: req.subjectId,
    subjectName: req.subjectName,
    level: req.level,
    topic: req.topic,
    subTopic: req.subTopic,
    difficulty: req.difficulty,
    questionType: req.questionType,
    count: req.count,
    schoolId: req.schoolId ?? null,
    autoApprove: req.autoApprove === true,
  };

  // Prefer paystack (already deployed on most projects); fall back to dedicated function.
  const paystackPayload = { action: "waec_generate" as const, ...payload };
  try {
    return await invokeEdgeFunction<WaecGenerationResult>("paystack", paystackPayload);
  } catch (e) {
    const msg = e instanceof Error ? e.message.toLowerCase() : "";
    const notDeployed = isEdgeFunctionUnreachable(e) || msg.includes("not found");
    if (!notDeployed) throw e;
    return invokeEdgeFunction<WaecGenerationResult>("waec-ai-generate", payload);
  }
}

/** Count approved active questions for a subject. */
export async function countWaecSubjectQuestions(subjectId: string): Promise<number> {
  const { count, error } = await supabase
    .from("waec_questions")
    .select("id", { count: "exact", head: true })
    .eq("subject_id", subjectId)
    .eq("is_active", true);
  if (error) throw error;
  return count ?? 0;
}

/** Standard WAEC bank: 300 objective + 150 structured + 50 mock = 500 per subject. */
export const WAEC_BANK_TARGET = 500;
export const WAEC_BANK_MIX: { questionType: "objective" | "structured" | "mock"; count: number }[] = [
  { questionType: "objective", count: 300 },
  { questionType: "structured", count: 150 },
  { questionType: "mock", count: 50 },
];

export type WaecBankProgress = {
  subjectName: string;
  phase: string;
  done: number;
  total: number;
  inserted: number;
  skipped: number;
};

/** Generate the full 500-question bank for one subject (batched). */
export async function generateWaecSubjectBank(
  subject: WaecSubject,
  opts: {
    schoolId: string | null;
    autoApprove?: boolean;
    onProgress?: (p: WaecBankProgress) => void;
    existingCount?: number;
  },
): Promise<{ inserted: number; skipped: number }> {
  const BATCH = 15;
  let inserted = 0;
  let skipped = 0;
  const existing = opts.existingCount ?? (await countWaecSubjectQuestions(subject.id));
  const needed = Math.max(0, WAEC_BANK_TARGET - existing);
  if (needed === 0) {
    return { inserted: 0, skipped: 0 };
  }

  // Scale mix proportionally if we only need a partial top-up.
  const scale = needed / WAEC_BANK_TARGET;
  const phases = WAEC_BANK_MIX.map((m) => ({
    questionType: m.questionType,
    count: Math.max(1, Math.round(m.count * scale)),
  }));
  // Adjust last phase so total ~= needed
  const phaseTotal = phases.reduce((s, p) => s + p.count, 0);
  if (phaseTotal > needed) {
    phases[phases.length - 1].count -= phaseTotal - needed;
  }

  let done = 0;
  for (const phase of phases) {
    let phaseDone = 0;
    while (phaseDone < phase.count) {
      const batchCount = Math.min(BATCH, phase.count - phaseDone);
      opts.onProgress?.({
        subjectName: subject.name,
        phase: phase.questionType,
        done,
        total: needed,
        inserted,
        skipped,
      });
      const res = await generateWaecQuestions({
        subjectId: subject.id,
        subjectName: subject.name,
        level: subject.level,
        difficulty: "mixed",
        questionType: phase.questionType,
        count: batchCount,
        schoolId: opts.schoolId,
        autoApprove: opts.autoApprove ?? true,
      });
      inserted += res.inserted ?? 0;
      skipped += res.skipped ?? 0;
      phaseDone += batchCount;
      done += batchCount;
    }
  }

  opts.onProgress?.({
    subjectName: subject.name,
    phase: "done",
    done: needed,
    total: needed,
    inserted,
    skipped,
  });

  return { inserted, skipped };
}

/** Draft/rejected questions for the admin review queue (bypasses is_active filter). */
export async function fetchWaecQuestionsByStatus(
  status: WaecQuestionStatus,
  filters?: { subjectId?: string; search?: string; limit?: number },
): Promise<WaecQuestion[]> {
  let q = supabase
    .from("waec_questions")
    .select("*, waec_subjects(name, level)")
    .eq("status", status)
    .order("updated_at", { ascending: false })
    .limit(filters?.limit ?? 300);

  if (filters?.subjectId) q = q.eq("subject_id", filters.subjectId);

  const { data, error } = await q;
  if (error) throw error;

  let rows = (data ?? []).map((row) => mapQuestionRow(row));
  if (filters?.search) {
    const s = filters.search.toLowerCase();
    rows = rows.filter((r) => r.question_text.toLowerCase().includes(s));
  }
  return rows;
}

export async function countWaecDrafts(subjectId?: string): Promise<number> {
  let q = supabase
    .from("waec_questions")
    .select("id", { count: "exact", head: true })
    .eq("status", "draft");
  if (subjectId) q = q.eq("subject_id", subjectId);
  const { count, error } = await q;
  if (error) throw error;
  return count ?? 0;
}

export async function setWaecQuestionStatus(id: string, status: WaecQuestionStatus): Promise<void> {
  const { data, error } = await supabase.rpc("set_waec_question_status", {
    p_question_id: id,
    p_status: status,
  });
  if (error) throw error;
  const res = data as { ok?: boolean; error?: string };
  if (!res?.ok) throw new Error(res?.error ?? "Failed to update question status.");
}

export async function approveWaecDraftsForSubject(subjectId: string): Promise<number> {
  const { data, error } = await supabase.rpc("approve_waec_drafts_for_subject", {
    p_subject_id: subjectId,
  });
  if (error) throw error;
  const res = data as { ok?: boolean; approved?: number; error?: string };
  if (!res?.ok) throw new Error(res?.error ?? "Failed to approve drafts.");
  return res.approved ?? 0;
}
