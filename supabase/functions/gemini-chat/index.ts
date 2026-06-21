/// <reference path="../deno-shim.d.ts" />
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MODEL = "gemini-2.5-flash";
const DEFAULT_MONTHLY_LIMIT = 1000;

type ChatMessage = { role: "user" | "assistant" | "system"; content: string };

type AiContext = {
  module?: string;
  moduleLabel?: string;
  pagePath?: string;
  userRole?: string;
  userName?: string;
  schoolName?: string;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: toGeminiContents(history, message),
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 4096,
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
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) return json({ error: "GEMINI_API_KEY is not configured on the server." }, 500);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json();
    const action = body.action as string;

    if (action === "chat") {
      const message = String(body.message ?? "").trim();
      const conversationId = body.conversationId as string | undefined;
      const context = (body.context ?? {}) as AiContext;
      const history = (body.history ?? []) as ChatMessage[];

      if (!message) return json({ error: "Message is required" }, 400);

      const { data: profile } = await userClient
        .from("profiles")
        .select("school_id, full_name")
        .eq("id", userData.user.id)
        .maybeSingle();

      const schoolId = profile?.school_id;
      if (!schoolId) return json({ error: "School context required" }, 400);

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
        return json({ error: `Monthly AI request limit (${limit}) reached for your school.` }, 429);
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

      await admin.from("ai_usage_logs").insert({
        school_id: schoolId,
        user_id: userData.user.id,
        conversation_id: conversationId ?? null,
        module_context: context.moduleLabel ?? context.module ?? null,
        prompt_preview: message.slice(0, 200),
        tokens,
      });

      return json({ content: text, tokens });
    }

    if (action === "usage_stats") {
      const { data: profile } = await userClient
        .from("profiles")
        .select("school_id")
        .eq("id", userData.user.id)
        .maybeSingle();

      if (!profile?.school_id) return json({ error: "School context required" }, 400);

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

      return json({
        totalRequests: totalRequests ?? 0,
        totalTokens,
        monthlyLimit: limit,
        remaining: Math.max(0, limit - (totalRequests ?? 0)),
      });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Internal error";
    return json({ error: message }, 500);
  }
});
