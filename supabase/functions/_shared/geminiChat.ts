/// <reference path="../deno-shim.d.ts" />
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const MODEL = "gemini-2.5-flash";
const DEFAULT_MONTHLY_LIMIT = 1000;

const GEMINI_ACTIONS = new Set(["chat", "usage_stats"]);

type ChatMessage = { role: "user" | "assistant" | "system"; content: string };

export type AiContext = {
  module?: string;
  moduleLabel?: string;
  pagePath?: string;
  userRole?: string;
  userName?: string;
  schoolName?: string;
};

export function isGeminiChatAction(action: unknown): boolean {
  return typeof action === "string" && GEMINI_ACTIONS.has(action);
}

function buildSystemPrompt(ctx: AiContext): string {
  return [
    "You are EduManage AI, an expert assistant for school management systems in Ghana and Africa.",
    "Help administrators, teachers, students, parents, and staff with academics, administration, finance, communication, and HR.",
    "Be professional, accurate, and practical. Use clear formatting with headings and bullet lists when helpful.",
    "If you lack specific data, say so and provide a useful template or general guidance.",
    ctx.schoolName ? `School: ${ctx.schoolName}` : "",
    ctx.userName ? `User: ${ctx.userName}` : "",
    ctx.userRole ? `Role: ${ctx.userRole}` : "",
    ctx.moduleLabel ? `Current module: ${ctx.moduleLabel}` : ctx.module ? `Current module: ${ctx.module}` : "",
    ctx.pagePath ? `Current page: ${ctx.pagePath}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function toGeminiContents(history: ChatMessage[], latestUser: string) {
  const contents: { role: string; parts: { text: string }[] }[] = [];
  for (const m of history) {
    if (m.role === "system") continue;
    contents.push({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    });
  }
  contents.push({ role: "user", parts: [{ text: latestUser }] });
  return contents;
}

async function callGemini(apiKey: string, systemPrompt: string, history: ChatMessage[], message: string) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120_000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: toGeminiContents(history, message),
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048,
        },
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      const err = data?.error?.message ?? "Gemini API request failed";
      throw new Error(err);
    }

    const text =
      data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
    const tokens = data?.usageMetadata?.totalTokenCount ?? 0;
    if (!text.trim()) throw new Error("Empty response from Gemini");
    return { text: text.trim(), tokens };
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error("Gemini request timed out. Try a shorter message.");
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

async function logUsage(
  admin: SupabaseClient,
  row: {
    school_id: string;
    user_id: string;
    conversation_id?: string | null;
    module_context?: string | null;
    prompt_preview?: string | null;
    tokens: number;
  },
) {
  try {
    await admin.from("ai_usage_logs").insert(row);
  } catch {
    /* table may not exist yet */
  }
}

async function resolveGeminiApiKey(admin: SupabaseClient): Promise<string | null> {
  const fromEnv = Deno.env.get("GEMINI_API_KEY")?.trim();
  if (fromEnv) return fromEnv;
  const { data } = await admin
    .from("platform_ai_config")
    .select("gemini_api_key")
    .eq("id", 1)
    .maybeSingle();
  const fromDb = data?.gemini_api_key?.trim();
  return fromDb || null;
}

export async function handleGeminiChat(
  body: Record<string, unknown>,
  authHeader: string | null,
  env: { supabaseUrl: string; supabaseAnon: string; serviceKey: string },
  respond: (payload: unknown, status?: number) => Response,
): Promise<Response> {
  if (!authHeader) return respond({ error: "Unauthorized" }, 401);

  const userClient = createClient(env.supabaseUrl, env.supabaseAnon, {
    global: { headers: { Authorization: authHeader } },
  });
  const admin = createClient(env.supabaseUrl, env.serviceKey);

  const apiKey = await resolveGeminiApiKey(admin);
  if (!apiKey) {
    return respond({
      error: "Platform AI is not configured yet. The Super Admin must add the shared Gemini API key in AI Assistant.",
    }, 500);
  }

  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user) return respond({ error: "Unauthorized" }, 401);

  const action = body.action as string;

  if (action === "chat") {
    const message = String(body.message ?? "").trim();
    const conversationId = body.conversationId as string | undefined;
    const context = (body.context ?? {}) as AiContext;
    const history = (body.history ?? []) as ChatMessage[];

    if (!message) return respond({ error: "Message is required" }, 400);

    const { data: profile } = await userClient
      .from("profiles")
      .select("school_id, full_name")
      .eq("id", userData.user.id)
      .maybeSingle();

    const schoolId = profile?.school_id;
    if (!schoolId) return respond({ error: "School context required" }, 400);

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const { count: monthlyCount } = await admin
      .from("ai_usage_logs")
      .select("id", { count: "exact", head: true })
      .eq("school_id", schoolId)
      .gte("created_at", monthStart.toISOString());

    const limit = Number(Deno.env.get("AI_MONTHLY_REQUEST_LIMIT") ?? DEFAULT_MONTHLY_LIMIT);
    if ((monthlyCount ?? 0) >= limit) {
      return respond({ error: `Monthly AI request limit (${limit}) reached for your school.` }, 429);
    }

    let schoolName = "";
    const { data: school } = await admin.from("schools").select("name").eq("id", schoolId).maybeSingle();
    schoolName = school?.name ?? "";

    const systemPrompt = buildSystemPrompt({
      ...context,
      userName: profile?.full_name ?? context.userName,
      schoolName,
    });

    const { text, tokens } = await callGemini(apiKey, systemPrompt, history, message);

    await logUsage(admin, {
      school_id: schoolId,
      user_id: userData.user.id,
      conversation_id: conversationId ?? null,
      module_context: context.moduleLabel ?? context.module ?? null,
      prompt_preview: message.slice(0, 200),
      tokens,
    });

    return respond({ content: text, tokens });
  }

  if (action === "usage_stats") {
    const { data: profile } = await userClient
      .from("profiles")
      .select("school_id")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (!profile?.school_id) return respond({ error: "School context required" }, 400);

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const { count: totalRequests } = await admin
      .from("ai_usage_logs")
      .select("id", { count: "exact", head: true })
      .eq("school_id", profile.school_id)
      .gte("created_at", monthStart.toISOString());

    const { data: tokenRows } = await admin
      .from("ai_usage_logs")
      .select("tokens")
      .eq("school_id", profile.school_id)
      .gte("created_at", monthStart.toISOString());

    const totalTokens = (tokenRows ?? []).reduce((s, r) => s + (r.tokens ?? 0), 0);
    const limit = Number(Deno.env.get("AI_MONTHLY_REQUEST_LIMIT") ?? DEFAULT_MONTHLY_LIMIT);

    return respond({
      totalRequests: totalRequests ?? 0,
      totalTokens,
      monthlyLimit: limit,
      remaining: Math.max(0, limit - (totalRequests ?? 0)),
    });
  }

  return respond({ error: "Unknown action" }, 400);
}
