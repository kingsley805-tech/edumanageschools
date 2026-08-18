// Conversation engine for the AI school receptionist.
// Handles intent detection, caller verification, knowledge lookup and
// secure retrieval of student records from EduManage.

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

export type Speaker = "ai" | "caller" | "staff" | "system";

export type TurnRequest = {
  schoolId: string;
  callId?: string;
  callerPhone?: string;
  utterance?: string;
  language?: string;
  event?: "call_started" | "caller_spoke" | "call_ended";
  durationSeconds?: number;
};

export type TurnResponse = {
  callId: string;
  reply: string;
  intent: string;
  verified: boolean;
  shouldEscalate: boolean;
  shouldHangUp: boolean;
};

const ESCALATION_DEFAULTS = [
  "emergency",
  "ambulance",
  "hospital",
  "accident",
  "police",
  "abuse",
  "bullying",
  "suicide",
  "speak to a human",
  "talk to someone",
  "real person",
  "manager",
  "headmaster",
  "headmistress",
];

const PRIVATE_INTENTS = new Set([
  "attendance_inquiry",
  "grades_inquiry",
  "fees_inquiry",
  "behaviour_inquiry",
  "report_inquiry",
]);

export function serviceClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );
}

/* -------------------------------------------------------------------------- */
/* Intent detection                                                            */
/* -------------------------------------------------------------------------- */

const INTENT_RULES: { intent: string; patterns: RegExp[] }[] = [
  { intent: "attendance_inquiry", patterns: [/attend/i, /absent/i, /present/i, /came to school/i] },
  { intent: "grades_inquiry", patterns: [/grade/i, /result/i, /score/i, /exam/i, /report card/i] },
  { intent: "fees_inquiry", patterns: [/fee/i, /owe/i, /balance/i, /payment/i, /invoice/i, /pay/i] },
  { intent: "admissions_inquiry", patterns: [/admission/i, /enrol/i, /enroll/i, /apply/i, /register my/i] },
  { intent: "meeting_request", patterns: [/meet/i, /appointment/i, /see the teacher/i, /speak with .*teacher/i] },
  { intent: "absence_report", patterns: [/will not (be )?(come|attend)/i, /is sick/i, /not coming/i, /ill/i] },
  { intent: "calendar_inquiry", patterns: [/calendar/i, /term/i, /holiday/i, /vacation/i, /reopen/i, /event/i] },
  { intent: "transport_inquiry", patterns: [/bus/i, /transport/i, /pick ?up/i, /drop ?off/i] },
  { intent: "uniform_inquiry", patterns: [/uniform/i, /dress code/i] },
  { intent: "general_inquiry", patterns: [/where.*located/i, /address/i, /open/i, /contact/i] },
];

export function detectIntent(utterance: string): string {
  const text = utterance ?? "";
  for (const rule of INTENT_RULES) {
    if (rule.patterns.some((p) => p.test(text))) return rule.intent;
  }
  return "general_inquiry";
}

export function detectSentiment(utterance: string): "positive" | "neutral" | "negative" {
  const negative = /(angry|upset|terrible|unacceptable|complain|disappointed|furious|worst)/i;
  const positive = /(thank|great|wonderful|appreciate|helpful|excellent)/i;
  if (negative.test(utterance)) return "negative";
  if (positive.test(utterance)) return "positive";
  return "neutral";
}

export function shouldEscalate(utterance: string, extraKeywords: string[] = []): boolean {
  const keywords = [...ESCALATION_DEFAULTS, ...extraKeywords.map((k) => k.toLowerCase())];
  const text = (utterance ?? "").toLowerCase();
  return keywords.some((k) => k && text.includes(k));
}

/* -------------------------------------------------------------------------- */
/* Caller verification                                                         */
/* -------------------------------------------------------------------------- */

export type VerifiedCaller = {
  verified: boolean;
  parentUserId: string | null;
  callerName: string | null;
  students: { id: string; full_name: string; admission_no: string | null }[];
};

/** Matches the inbound number against a registered parent profile. */
export async function verifyCaller(
  db: SupabaseClient,
  schoolId: string,
  callerPhone?: string,
): Promise<VerifiedCaller> {
  const empty: VerifiedCaller = {
    verified: false,
    parentUserId: null,
    callerName: null,
    students: [],
  };
  if (!callerPhone) return empty;

  const digits = callerPhone.replace(/\D/g, "").slice(-9);
  if (digits.length < 7) return empty;

  const { data: profiles } = await db
    .from("profiles")
    .select("id, full_name, phone")
    .eq("school_id", schoolId)
    .not("phone", "is", null);

  const match = (profiles ?? []).find(
    (p: { phone?: string | null }) => (p.phone ?? "").replace(/\D/g, "").slice(-9) === digits,
  );
  if (!match) return empty;

  const students = await loadChildren(db, schoolId, match.id);
  return {
    verified: students.length > 0,
    parentUserId: match.id,
    callerName: match.full_name ?? null,
    students,
  };
}

async function loadChildren(db: SupabaseClient, schoolId: string, parentUserId: string) {
  const { data: links } = await db
    .from("parent_student_links")
    .select("student_id, students(id, full_name, admission_no)")
    .eq("parent_id", parentUserId);

  const fromLinks = (links ?? [])
    .map((l: { students?: unknown }) => l.students)
    .filter(Boolean) as { id: string; full_name: string; admission_no: string | null }[];

  if (fromLinks.length) return fromLinks;

  const { data: guarded } = await db
    .from("students")
    .select("id, full_name, admission_no")
    .eq("school_id", schoolId)
    .eq("guardian_id", parentUserId);

  return (guarded ?? []) as { id: string; full_name: string; admission_no: string | null }[];
}

/* -------------------------------------------------------------------------- */
/* Student data lookups (only for verified callers)                            */
/* -------------------------------------------------------------------------- */

export async function attendanceSummary(
  db: SupabaseClient,
  studentId: string,
  studentName: string,
): Promise<string> {
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const { data } = await db
    .from("attendance")
    .select("status, date")
    .eq("student_id", studentId)
    .gte("date", since.toISOString().slice(0, 10));

  const rows = data ?? [];
  if (!rows.length) {
    return `I don't have any attendance records for ${studentName} in the last thirty days.`;
  }

  const present = rows.filter((r: { status: string }) => r.status === "present").length;
  const absent = rows.filter((r: { status: string }) => r.status === "absent").length;
  const late = rows.filter((r: { status: string }) => r.status === "late").length;
  const rate = Math.round((present / rows.length) * 100);

  return (
    `Over the last thirty days, ${studentName} was present ${present} times, ` +
    `absent ${absent} times, and late ${late} times. That is an attendance rate of ${rate} percent.`
  );
}

export async function feesSummary(
  db: SupabaseClient,
  studentId: string,
  studentName: string,
): Promise<string> {
  const { data } = await db
    .from("invoices")
    .select("total_amount, amount_paid, status, due_date")
    .eq("student_id", studentId)
    .neq("status", "cancelled");

  const rows = data ?? [];
  if (!rows.length) return `I don't see any invoices on file for ${studentName}.`;

  const outstanding = rows.reduce(
    (sum: number, r: { total_amount?: number; amount_paid?: number }) =>
      sum + (Number(r.total_amount ?? 0) - Number(r.amount_paid ?? 0)),
    0,
  );

  if (outstanding <= 0) {
    return `Good news. ${studentName}'s school fees are fully paid. There is no outstanding balance.`;
  }

  const nextDue = rows
    .filter((r: { due_date?: string }) => r.due_date)
    .map((r: { due_date: string }) => r.due_date)
    .sort()[0];

  const dueText = nextDue
    ? ` The next payment deadline is ${new Date(nextDue).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })}.`
    : "";

  return `${studentName} currently has an outstanding balance of ${outstanding.toFixed(2)}.${dueText}`;
}

export async function gradesSummary(
  db: SupabaseClient,
  studentId: string,
  studentName: string,
): Promise<string> {
  const { data } = await db
    .from("grades")
    .select("score, subjects(name)")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false })
    .limit(6);

  const rows = data ?? [];
  if (!rows.length) {
    return `${studentName}'s results have not been published yet. Please check again after the examinations are marked.`;
  }

  const parts = rows
    .map((r: { score?: number; subjects?: { name?: string } }) => {
      const subject = r.subjects?.name ?? "a subject";
      return `${subject}: ${r.score ?? "not recorded"}`;
    })
    .join(", ");

  return `Here are ${studentName}'s most recent results. ${parts}.`;
}

/* -------------------------------------------------------------------------- */
/* Knowledge base lookup                                                       */
/* -------------------------------------------------------------------------- */

export async function knowledgeAnswer(
  db: SupabaseClient,
  schoolId: string,
  utterance: string,
): Promise<string | null> {
  const { data } = await db
    .from("ai_knowledge_base")
    .select("title, content, keywords, category")
    .eq("school_id", schoolId)
    .eq("is_published", true)
    .eq("is_archived", false);

  const rows = data ?? [];
  if (!rows.length) return null;

  const text = (utterance ?? "").toLowerCase();
  const words = text.split(/\W+/).filter((w) => w.length > 3);

  let best: { score: number; content: string } | null = null;
  for (const row of rows) {
    let score = 0;
    const title = (row.title ?? "").toLowerCase();
    const keywords: string[] = row.keywords ?? [];

    for (const kw of keywords) {
      if (kw && text.includes(kw.toLowerCase())) score += 3;
    }
    for (const w of words) {
      if (title.includes(w)) score += 2;
      if ((row.content ?? "").toLowerCase().includes(w)) score += 1;
    }

    if (score > 0 && (!best || score > best.score)) {
      best = { score, content: row.content };
    }
  }

  return best && best.score >= 3 ? best.content : null;
}

/* -------------------------------------------------------------------------- */
/* LLM fallback                                                                */
/* -------------------------------------------------------------------------- */

export async function llmReply(
  systemPrompt: string,
  history: { speaker: Speaker; content: string }[],
  utterance: string,
): Promise<string | null> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) return null;

  const contents = [
    ...history.slice(-8).map((h) => ({
      role: h.speaker === "caller" ? "user" : "model",
      parts: [{ text: h.content }],
    })),
    { role: "user", parts: [{ text: utterance }] },
  ];

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents,
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: { temperature: 0.6, maxOutputTokens: 220 },
        }),
      },
    );
    if (!res.ok) return null;
    const json = await res.json();
    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
    return typeof text === "string" ? text.trim() : null;
  } catch {
    return null;
  }
}

export function buildSystemPrompt(
  schoolName: string,
  agentName: string,
  verified: boolean,
): string {
  return [
    `You are ${agentName}, the virtual receptionist for ${schoolName}.`,
    "You are speaking on a live phone call, so keep replies under three sentences and use plain spoken language.",
    "Be warm, polite, patient and professional, like an experienced school administrator.",
    verified
      ? "The caller's identity has been verified against our records."
      : "The caller is NOT verified. Never reveal attendance, grades, fees or any private student information. Politely ask them to verify first.",
    "Never invent school policies, dates or figures. If you do not know, offer to take a message or transfer the caller.",
    "Do not mention that you are an AI language model.",
  ].join(" ");
}

export { PRIVATE_INTENTS };
