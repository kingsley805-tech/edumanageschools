/// <reference path="../deno-shim.d.ts" />
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MODEL = "gemini-2.5-flash";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

type GenParams = {
  subjectId: string;
  subjectName: string;
  level: "bece" | "wassce";
  topic?: string;
  subTopic?: string;
  difficulty?: "easy" | "medium" | "hard" | "advanced";
  questionType?: "objective" | "structured" | "mock";
  count?: number;
  year?: number;
  schoolId?: string | null;
};

const LEVEL_LABEL: Record<string, string> = {
  bece: "BECE (Junior High School, Ghana)",
  wassce: "WASSCE (Senior High School, Ghana)",
};

function buildPrompt(p: GenParams, count: number): string {
  const level = LEVEL_LABEL[p.level] ?? p.level;
  const qtype = p.questionType ?? "objective";
  const difficulty = p.difficulty ?? "mixed";
  const topicLine = p.topic ? `Topic: ${p.topic}` : "Cover a spread of core syllabus topics.";
  const subTopicLine = p.subTopic ? `Sub-topic focus: ${p.subTopic}` : "";

  const typeInstructions =
    qtype === "objective"
      ? [
          "Produce four-option multiple-choice questions.",
          'Each question MUST include "options" as an array of exactly four objects: [{"id":"A","text":"..."},{"id":"B","text":"..."},{"id":"C","text":"..."},{"id":"D","text":"..."}].',
          '"correct_answer" MUST be one of "A","B","C","D".',
          'Set "question_type" to "objective" and "paper_type" to "paper_1".',
        ].join(" ")
      : qtype === "structured"
        ? [
            "Produce short-answer / structured problem-solving questions (no multiple-choice options).",
            'Set "options" to null.',
            '"correct_answer" MUST contain the full model answer.',
            '"marking_scheme" MUST describe how marks are awarded point-by-point.',
            'Set "question_type" to "structured" and "paper_type" to "paper_2".',
          ].join(" ")
        : [
            "Produce a mixed mock-examination set combining multiple-choice and short structured items.",
            'For multiple-choice items include four "options" and a letter "correct_answer"; for structured items set "options" to null and put the model answer in "correct_answer" with a "marking_scheme".',
            'Set "question_type" to "objective" or "structured" per item, and "paper_type" accordingly.',
          ].join(" ");

  return [
    `You are a senior WAEC examiner and Ghanaian curriculum expert. Generate ${count} ORIGINAL examination questions.`,
    `Examination: ${level}. Subject: ${p.subjectName}.`,
    topicLine,
    subTopicLine,
    `Difficulty: ${difficulty}. When "mixed", spread across easy/medium/hard/advanced.`,
    typeInstructions,
    "Requirements: questions must be original (never copy real past papers verbatim), curriculum-aligned to the Ghana Education Service syllabus and WAEC objectives, unambiguous, and factually correct.",
    "Return ONLY a JSON array (no prose, no markdown fences). Each element MUST have these keys:",
    JSON.stringify({
      question_text: "string",
      question_type: "objective | structured | mock",
      paper_type: "paper_1 | paper_2 | paper_3",
      options: '[{"id":"A","text":"..."}] or null',
      correct_answer: "string",
      explanation: "step-by-step solution and reasoning",
      marking_scheme: "how marks are awarded (structured) or null",
      topic: "string",
      sub_topic: "string",
      difficulty: "easy | medium | hard | advanced",
      learning_objective: "syllabus learning outcome",
      estimated_time_seconds: "integer",
      keywords: ["string"],
      marks: "integer",
    }),
  ]
    .filter(Boolean)
    .join("\n");
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
          temperature: 0.9,
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
  // Strip accidental markdown fences.
  if (text.startsWith("```")) {
    text = text.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  }
  // Extract the first JSON array if extra text sneaks in.
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start !== -1 && end !== -1 && end > start) {
    text = text.slice(start, end + 1);
  }
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed)) throw new Error("Model did not return a JSON array.");
  return parsed as Record<string, unknown>[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !supabaseAnon || !serviceKey) {
      return json({ error: "Supabase environment is not configured." }, 503);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);

    const { data: roleRows } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id);
    const roles = (roleRows ?? []).map((r) => r.role);
    const isStaff = roles.some((r) => ["admin", "super_admin", "teacher"].includes(r));
    if (!isStaff) return json({ error: "Only staff can generate questions." }, 403);

    const body = (await req.json()) as GenParams;
    if (!body.subjectId || !body.subjectName || !body.level) {
      return json({ error: "subjectId, subjectName and level are required." }, 400);
    }

    const count = Math.min(Math.max(Number(body.count) || 10, 1), 25);
    const year = Number(body.year) || new Date().getFullYear();

    const apiKey = await resolveGeminiApiKey(admin);
    if (!apiKey) {
      return json(
        { error: "Platform AI is not configured. The Super Admin must add the Gemini API key in AI Assistant." },
        500,
      );
    }

    // Resolve the target school (default to the caller's school).
    let schoolId = body.schoolId ?? null;
    if (schoolId === undefined) schoolId = null;
    if (schoolId === null && body.schoolId !== null) {
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
      return json({ error: `Could not parse AI output: ${e instanceof Error ? e.message : "unknown"}` }, 502);
    }

    if (!rows.length) return json({ error: "No questions were generated. Try again." }, 502);

    // Insert via RPC (runs as the caller so RLS/staff check applies + dedup).
    const { data: insertRes, error: insertErr } = await userClient.rpc(
      "insert_waec_generated_questions",
      {
        p_subject_id: body.subjectId,
        p_school_id: schoolId,
        p_year: year,
        p_ai_model: MODEL,
        p_rows: rows,
      },
    );

    if (insertErr) {
      return json({ error: insertErr.message }, 500);
    }

    const result = (insertRes ?? {}) as { ok?: boolean; inserted?: number; skipped?: number; error?: string };
    if (!result.ok) {
      return json({ error: result.error ?? "Insert failed." }, 500);
    }

    // Log usage best-effort.
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

    return json({
      ok: true,
      requested: count,
      inserted: result.inserted ?? 0,
      skipped: result.skipped ?? 0,
      tokens,
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Internal error" }, 500);
  }
});
