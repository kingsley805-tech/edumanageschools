/// <reference path="../deno-shim.d.ts" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MODEL = "gemini-2.5-flash";

export type WaecGenParams = {
  action?: string;
  subjectId: string;
  subjectName: string;
  level: "bece" | "wassce";
  topic?: string;
  subTopic?: string;
  difficulty?: "easy" | "medium" | "hard" | "advanced" | "mixed";
  questionType?: "objective" | "structured" | "mock";
  count?: number;
  schoolId?: string | null;
  autoApprove?: boolean;
};

export function isWaecGenerateAction(action: unknown): boolean {
  return action === "waec_generate";
}

const BECE_STYLE = [
  "Write in authentic BECE (JHS) examination style used in Ghana.",
  "Use clear, age-appropriate language for Junior High School candidates (JHS 1–3).",
  "Paper 1 objective items: one stem, four options A–D, exactly one correct answer.",
  "Paper 2 structured items: short-answer, problem-solving, or reasoning with Ghanaian context where natural.",
  "Reference Ghana Education Service (GES) JHS curriculum objectives.",
  "Do NOT mention exam years, past papers, or 'this question is from 20XX'.",
].join(" ");

const WASSCE_STYLE = [
  "Write in authentic WASSCE (SHS) examination style used in Ghana.",
  "Use formal academic language appropriate for Senior High School candidates.",
  "Paper 1 objective items: one stem, four options A–D, exactly one correct answer.",
  "Paper 2 structured items: extended reasoning, calculations, or essay-style short answers with marking points.",
  "Align to WAEC WASSCE syllabus and Ghana Education Service SHS curriculum.",
  "Do NOT mention exam years, past papers, or 'this question is from 20XX'.",
].join(" ");

function buildPrompt(p: WaecGenParams, count: number): string {
  const examStyle = p.level === "bece" ? BECE_STYLE : WASSCE_STYLE;
  const levelLabel = p.level === "bece" ? "BECE (JHS)" : "WASSCE (SHS)";
  const qtype = p.questionType ?? "objective";
  const difficulty = p.difficulty ?? "mixed";
  const topicLine = p.topic
    ? `Focus topic: ${p.topic}${p.subTopic ? ` — ${p.subTopic}` : ""}.`
    : "Cover a proportional spread across the full syllabus for this subject.";

  const difficultyLine =
    difficulty === "mixed"
      ? "Difficulty mix: 30% easy, 40% medium, 20% hard, 10% advanced."
      : `Difficulty: ${difficulty}.`;

  const typeInstructions =
    qtype === "objective"
      ? [
          "Generate ONLY Paper 1 multiple-choice questions.",
          'Each question MUST have "options" as exactly four objects: [{"id":"A","text":"..."},{"id":"B","text":"..."},{"id":"C","text":"..."},{"id":"D","text":"..."}].',
          '"correct_answer" MUST be "A", "B", "C", or "D".',
          'Set "question_type" to "objective" and "paper_type" to "paper_1".',
          "Distractors must be plausible common mistakes.",
        ].join(" ")
      : qtype === "structured"
        ? [
            "Generate ONLY Paper 2 structured/theory questions (no multiple-choice).",
            'Set "options" to null.',
            '"correct_answer" MUST be the full model answer.',
            '"marking_scheme" MUST list mark allocations point-by-point.',
            'Set "question_type" to "structured" and "paper_type" to "paper_2".',
          ].join(" ")
        : [
            "Generate a mixed mock-examination set: mostly objective with some structured items.",
            "Objective items need four options; structured items need model answer and marking_scheme.",
          ].join(" ");

  return [
    `You are a senior WAEC examiner for Ghana. Generate ${count} ORIGINAL, high-quality ${levelLabel} questions for ${p.subjectName}.`,
    examStyle,
    topicLine,
    difficultyLine,
    typeInstructions,
    "Every question must be unique, factually correct, unambiguous, and never copied from real past papers.",
    "Use Ghanaian contexts (cedis, local examples, GES terminology) where appropriate.",
    "Return ONLY a JSON array. Each element MUST include:",
    JSON.stringify({
      question_text: "string",
      question_type: "objective | structured",
      paper_type: "paper_1 | paper_2",
      options: "[{id,text}×4] or null",
      correct_answer: "string",
      explanation: "step-by-step solution",
      marking_scheme: "string or null",
      topic: "string",
      sub_topic: "string",
      difficulty: "easy | medium | hard | advanced",
      learning_objective: "GES syllabus outcome",
      estimated_time_seconds: "integer",
      keywords: ["string"],
      marks: "integer 1-5",
    }),
  ].join("\n");
}

async function resolveGeminiApiKey(admin: ReturnType<typeof createClient>): Promise<string | null> {
  const fromEnv = Deno.env.get("GEMINI_API_KEY")?.trim();
  if (fromEnv) return fromEnv;
  const { data } = await admin
    .from("platform_ai_config")
    .select("gemini_api_key")
    .eq("id", 1)
    .maybeSingle();
  return (data?.gemini_api_key as string | undefined)?.trim() || null;
}

async function callGeminiJson(apiKey: string, prompt: string): Promise<{ text: string; tokens: number }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120_000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.85,
          maxOutputTokens: 8192,
          responseMimeType: "application/json",
        },
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error?.message ?? "Gemini API request failed");
    }
    const text =
      data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
    const tokens = data?.usageMetadata?.totalTokenCount ?? 0;
    if (!text.trim()) throw new Error("Empty response from Gemini");
    return { text: text.trim(), tokens };
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error("Generation timed out. Try a smaller batch size.");
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

function parseQuestions(raw: string): Record<string, unknown>[] {
  let text = raw.trim();
  if (text.startsWith("```")) {
    text = text.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  }
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start !== -1 && end !== -1 && end > start) {
    text = text.slice(start, end + 1);
  }
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed)) throw new Error("Model did not return a JSON array.");
  return parsed as Record<string, unknown>[];
}

export async function handleWaecAiGenerate(
  body: WaecGenParams,
  authHeader: string | null,
  env: { supabaseUrl: string; supabaseAnon: string; serviceKey: string },
  respond: (payload: unknown, status?: number) => Response,
): Promise<Response> {
  if (!authHeader) return respond({ error: "Unauthorized" }, 401);

  const userClient = createClient(env.supabaseUrl, env.supabaseAnon, {
    global: { headers: { Authorization: authHeader } },
  });
  const admin = createClient(env.supabaseUrl, env.serviceKey);

  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user) return respond({ error: "Unauthorized" }, 401);

  const { data: roleRows } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id);
  const roles = (roleRows ?? []).map((r) => r.role);
  const isStaff = roles.some((r) => ["admin", "super_admin", "teacher"].includes(r));
  const isStudent = roles.includes("student");
  if (!isStaff && !isStudent) {
    return respond({ error: "You are not allowed to generate questions." }, 403);
  }

  if (!body.subjectId || !body.subjectName || !body.level) {
    return respond({ error: "subjectId, subjectName and level are required." }, 400);
  }

  const maxCount = isStaff ? 25 : 20;
  const count = Math.min(Math.max(Number(body.count) || 10, 1), maxCount);

  const apiKey = await resolveGeminiApiKey(admin);
  if (!apiKey) {
    return respond(
      { error: "AI is not configured yet. Ask your Super Admin to add the Gemini API key in AI Assistant." },
      500,
    );
  }

  let schoolId: string | null;
  const autoApprove = isStaff ? body.autoApprove === true : true;
  if (isStaff && body.schoolId !== undefined) {
    schoolId = body.schoolId;
  } else {
    const { data: profile } = await admin
      .from("profiles")
      .select("school_id")
      .eq("id", userData.user.id)
      .maybeSingle();
    schoolId = (profile?.school_id as string | undefined) ?? null;
  }

  const prompt = buildPrompt(body, count);
  const { text, tokens } = await callGeminiJson(apiKey, prompt);

  let rows: Record<string, unknown>[];
  try {
    rows = parseQuestions(text);
  } catch (e) {
    return respond({ error: `Could not parse AI output: ${e instanceof Error ? e.message : "unknown"}` }, 502);
  }

  if (!rows.length) return respond({ error: "No questions were generated. Try again." }, 502);

  const { data: insertRes, error: insertErr } = await userClient.rpc(
    "insert_waec_generated_questions",
    {
      p_subject_id: body.subjectId,
      p_school_id: schoolId,
      p_ai_model: MODEL,
      p_rows: rows,
      p_auto_approve: autoApprove,
    },
  );

  if (insertErr) {
    return respond({ error: insertErr.message }, 500);
  }

  const result = (insertRes ?? {}) as {
    ok?: boolean;
    inserted?: number;
    skipped?: number;
    ids?: string[];
    error?: string;
  };
  if (!result.ok) {
    return respond({ error: result.error ?? "Insert failed." }, 500);
  }

  try {
    await admin.from("ai_usage_logs").insert({
      school_id: schoolId,
      user_id: userData.user.id,
      module_context: "waec-generator",
      prompt_preview: `Generate ${count} ${body.subjectName} (${body.level}) questions`,
      tokens,
    });
  } catch {
    /* optional */
  }

  return respond({
    ok: true,
    requested: count,
    inserted: result.inserted ?? 0,
    skipped: result.skipped ?? 0,
    questionIds: result.ids ?? [],
    tokens,
  });
}
