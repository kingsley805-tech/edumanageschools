// @ts-nocheck
import { supabase } from "@/integrations/supabase/client";
import type {
  AiAction,
  AiCall,
  AiCallTranscript,
  AiConversationLog,
  AiEscalation,
  AiKnowledgeArticle,
  AiReceptionistDashboardStats,
  AiVoiceAgent,
  AiVoiceSettings,
  CallFilters,
  OutboundCallPayload,
} from "@/modules/ai-receptionist/lib/types";

/**
 * The ai_* tables are created by public/sql/apply-ai-voice-assistant.sql and
 * are queried through the Supabase client.
 */
const db = supabase as unknown as {
  from: (table: string) => ReturnType<typeof supabase.from>;
  rpc: (fn: string, args?: Record<string, unknown>) => ReturnType<typeof supabase.rpc>;
};

const EMPTY_STATS: AiReceptionistDashboardStats = {
  calls_today: 0,
  completed_today: 0,
  escalated_today: 0,
  avg_duration_seconds: 0,
  pending_followups: 0,
  knowledge_articles: 0,
  avg_satisfaction: 0,
  total_calls: 0,
};

/* -------------------------------------------------------------------------- */
/* Dashboard                                                                   */
/* -------------------------------------------------------------------------- */

export async function fetchDashboardStats(schoolId: string): Promise<AiReceptionistDashboardStats> {
  const { data, error } = await db.rpc("get_ai_receptionist_dashboard_stats", {
    p_school_id: schoolId,
  });
  if (error) throw error;
  return { ...EMPTY_STATS, ...(data as Partial<AiReceptionistDashboardStats>) };
}

/** Fallback stats computed client-side when the RPC is not deployed. */
export function deriveStatsFromCalls(
  calls: AiCall[],
  actions: AiAction[],
  articles: AiKnowledgeArticle[],
): AiReceptionistDashboardStats {
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const today = calls.filter((c) => new Date(c.started_at) >= dayStart);
  const durations = today.filter((c) => c.duration_seconds > 0);
  const rated = today.filter((c) => c.satisfaction_score != null);

  return {
    calls_today: today.length,
    completed_today: today.filter((c) => c.status === "completed").length,
    escalated_today: today.filter((c) => c.status === "escalated" || c.escalated).length,
    avg_duration_seconds: durations.length
      ? Math.round(durations.reduce((s, c) => s + c.duration_seconds, 0) / durations.length)
      : 0,
    pending_followups: actions.filter((a) => a.status === "pending").length,
    knowledge_articles: articles.filter((a) => a.is_published).length,
    avg_satisfaction: rated.length
      ? Number((rated.reduce((s, c) => s + (c.satisfaction_score ?? 0), 0) / rated.length).toFixed(1))
      : 0,
    total_calls: calls.length,
  };
}

/* -------------------------------------------------------------------------- */
/* Voice agent persona                                                         */
/* -------------------------------------------------------------------------- */

export async function fetchVoiceAgent(schoolId: string): Promise<AiVoiceAgent | null> {
  const { data, error } = await supabase
    .from("ai_voice_agents")
    .select("*")
    .eq("school_id", schoolId)
    .maybeSingle();
  if (error) throw error;
  return data as AiVoiceAgent | null;
}

export async function saveVoiceAgent(
  schoolId: string,
  payload: Partial<AiVoiceAgent>,
): Promise<AiVoiceAgent> {
  const row = {
    school_id: schoolId,
    name: payload.name?.trim() || "Emma",
    display_title: payload.display_title?.trim() || "Virtual school assistant",
    greeting: payload.greeting?.trim() || "Thank you for calling. How may I assist you today?",
    voice_style: payload.voice_style ?? "warm_professional",
    languages: payload.languages?.length ? payload.languages : ["en"],
    is_active: payload.is_active ?? true,
    handover_phone: payload.handover_phone?.trim() || null,
    escalation_keywords: payload.escalation_keywords ?? [],
    openai_model: payload.openai_model || "gpt-4o-realtime-preview",
    openai_voice: payload.openai_voice || "alloy",
    system_prompt: payload.system_prompt || null,
    temperature: payload.temperature ?? 0.8,
    enabled_tools: payload.enabled_tools ?? [
      "verify_caller_identity",
      "get_student_info",
      "get_attendance_summary",
      "get_fee_balance",
      "get_academic_grades",
      "report_student_absence",
      "schedule_meeting",
      "search_knowledge_base",
      "transfer_to_human",
    ],
    max_call_duration_seconds: payload.max_call_duration_seconds ?? 600,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("ai_voice_agents")
    .upsert(row, { onConflict: "school_id" })
    .select("*")
    .single();
  if (error) throw error;
  return data as AiVoiceAgent;
}

/* -------------------------------------------------------------------------- */
/* Telephony settings                                                          */
/* -------------------------------------------------------------------------- */

export async function fetchVoiceSettings(schoolId: string): Promise<AiVoiceSettings | null> {
  const { data, error } = await supabase
    .from("ai_voice_settings")
    .select(
      "id, school_id, provider, school_phone_e164, twilio_account_sid, twilio_phone_number, webhook_url, media_stream_url, status_callback_url, support_number, recording_enabled, outbound_enabled, verification_mode, is_enabled",
    )
    .eq("school_id", schoolId)
    .maybeSingle();
  if (error) throw error;
  return data as AiVoiceSettings | null;
}

export async function saveVoiceSettings(
  schoolId: string,
  payload: Partial<AiVoiceSettings> & { twilio_auth_token?: string },
): Promise<void> {
  const row: Record<string, unknown> = {
    school_id: schoolId,
    provider: payload.provider ?? "twilio",
    school_phone_e164: payload.school_phone_e164?.trim() || null,
    twilio_account_sid: payload.twilio_account_sid?.trim() || null,
    twilio_phone_number: payload.twilio_phone_number?.trim() || null,
    webhook_url: payload.webhook_url?.trim() || null,
    media_stream_url: payload.media_stream_url?.trim() || null,
    status_callback_url: payload.status_callback_url?.trim() || null,
    support_number: payload.support_number?.trim() || null,
    recording_enabled: payload.recording_enabled ?? true,
    outbound_enabled: payload.outbound_enabled ?? false,
    verification_mode: payload.verification_mode ?? "registered_phone",
    is_enabled: payload.is_enabled ?? false,
    updated_at: new Date().toISOString(),
  };

  if (payload.twilio_auth_token?.trim()) {
    row.twilio_auth_token_encrypted = payload.twilio_auth_token.trim();
  }

  const { error } = await db.from("ai_voice_settings").upsert(row, { onConflict: "school_id" });
  if (error) throw error;
}

/* -------------------------------------------------------------------------- */
/* Knowledge base                                                              */
/* -------------------------------------------------------------------------- */

export async function fetchKnowledgeArticles(schoolId: string): Promise<AiKnowledgeArticle[]> {
  const { data, error } = await supabase
    .from("ai_knowledge_base")
    .select("*")
    .eq("school_id", schoolId)
    .eq("is_archived", false)
    .order("category")
    .order("sort_order");
  if (error) throw error;
  return (data ?? []) as AiKnowledgeArticle[];
}

export async function saveKnowledgeArticle(
  schoolId: string,
  payload: Partial<AiKnowledgeArticle> & { title: string; content: string },
  id?: string,
): Promise<string> {
  const row = {
    school_id: schoolId,
    category: payload.category ?? "general",
    title: payload.title.trim(),
    content: payload.content.trim(),
    keywords: payload.keywords ?? [],
    language: payload.language ?? "en",
    is_published: payload.is_published ?? true,
    sort_order: payload.sort_order ?? 0,
    updated_at: new Date().toISOString(),
  };

  if (id) {
    const { error } = await db.from("ai_knowledge_base").update(row).eq("id", id);
    if (error) throw error;
    return id;
  }

  const { data, error } = await supabase
    .from("ai_knowledge_base")
    .insert(row)
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function deleteKnowledgeArticle(id: string): Promise<void> {
  const { error } = await supabase
    .from("ai_knowledge_base")
    .update({ is_archived: true, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function toggleKnowledgePublished(id: string, published: boolean): Promise<void> {
  const { error } = await supabase
    .from("ai_knowledge_base")
    .update({ is_published: published, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

/* -------------------------------------------------------------------------- */
/* Calls & Transcripts                                                         */
/* -------------------------------------------------------------------------- */

function mapCall(row: Record<string, unknown>): AiCall {
  const student = row.students as { full_name?: string; admission_no?: string } | null;
  return {
    id: row.id as string,
    school_id: row.school_id as string,
    direction: row.direction as AiCall["direction"],
    status: row.status as AiCall["status"],
    caller_phone: (row.caller_phone as string) ?? null,
    caller_name: (row.caller_name as string) ?? null,
    student_id: (row.student_id as string) ?? null,
    parent_id: (row.parent_id as string) ?? null,
    started_at: row.started_at as string,
    ended_at: (row.ended_at as string) ?? null,
    duration_seconds: Number(row.duration_seconds ?? 0),
    detected_intent: (row.detected_intent as string) ?? null,
    sentiment: (row.sentiment as AiCall["sentiment"]) ?? null,
    satisfaction_score: row.satisfaction_score != null ? Number(row.satisfaction_score) : null,
    summary: (row.summary as string) ?? null,
    follow_up_status: (row.follow_up_status as string) ?? "none",
    recording_url: (row.recording_url as string) ?? null,
    provider_call_sid: (row.provider_call_sid as string) ?? null,
    parent_call_sid: (row.parent_call_sid as string) ?? null,
    ai_session_id: (row.ai_session_id as string) ?? null,
    is_verified: Boolean(row.is_verified),
    escalated: Boolean(row.escalated),
    escalation_reason: (row.escalation_reason as string) ?? null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    language: (row.language as string) ?? null,
    student_name: student?.full_name ?? undefined,
  };
}

export async function fetchCalls(schoolId: string, filters: CallFilters = {}): Promise<AiCall[]> {
  let query = supabase
    .from("ai_calls")
    .select("*, students(full_name, admission_no)")
    .eq("school_id", schoolId)
    .eq("is_archived", false)
    .order("started_at", { ascending: false })
    .limit(filters.limit ?? 200);

  if (filters.status && filters.status !== "all") query = query.eq("status", filters.status);
  if (filters.direction && filters.direction !== "all") query = query.eq("direction", filters.direction);
  if (filters.studentId) query = query.eq("student_id", filters.studentId);
  if (filters.from) query = query.gte("started_at", filters.from);
  if (filters.to) query = query.lte("started_at", filters.to);

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data ?? []).map((r) => mapCall(r as Record<string, unknown>));
  const search = filters.search?.trim().toLowerCase();
  if (!search) return rows;

  return rows.filter((c) =>
    [c.caller_name, c.caller_phone, c.summary, c.detected_intent, c.student_name]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(search)),
  );
}

export async function fetchCallTranscript(callId: string): Promise<AiCallTranscript[]> {
  const { data, error } = await supabase
    .from("ai_call_transcripts")
    .select("id, call_id, speaker, content, spoken_at, sequence_no")
    .eq("call_id", callId)
    .order("sequence_no");
  if (error) throw error;
  return (data ?? []) as AiCallTranscript[];
}

export async function fetchCallConversationLogs(callId: string): Promise<AiConversationLog[]> {
  const { data, error } = await supabase
    .from("ai_conversation_logs")
    .select("id, school_id, call_id, event_type, payload, created_at")
    .eq("call_id", callId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as AiConversationLog[];
}

export async function updateCallFollowUp(callId: string, status: string): Promise<void> {
  const { error } = await supabase
    .from("ai_calls")
    .update({ follow_up_status: status, updated_at: new Date().toISOString() })
    .eq("id", callId);
  if (error) throw error;
}

export async function archiveCall(callId: string): Promise<void> {
  const { error } = await supabase
    .from("ai_calls")
    .update({ is_archived: true, updated_at: new Date().toISOString() })
    .eq("id", callId);
  if (error) throw error;
}

/* -------------------------------------------------------------------------- */
/* Outbound AI Call Trigger                                                   */
/* -------------------------------------------------------------------------- */

export async function triggerOutboundCall(payload: OutboundCallPayload): Promise<{ ok: boolean; callSid?: string; message?: string }> {
  const { data, error } = await supabase.functions.invoke("ai-voice-gateway", {
    body: {
      ...payload,
      pathname: "/outbound",
    },
  });

  if (error) throw error;
  return data;
}

/* -------------------------------------------------------------------------- */
/* Actions & Follow-ups                                                        */
/* -------------------------------------------------------------------------- */

export async function fetchActions(schoolId: string): Promise<AiAction[]> {
  const { data, error } = await supabase
    .from("ai_actions")
    .select("*")
    .eq("school_id", schoolId)
    .eq("is_archived", false)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as AiAction[];
}

export async function saveAction(
  schoolId: string,
  payload: Partial<AiAction> & { title: string },
  id?: string,
): Promise<string> {
  const row = {
    school_id: schoolId,
    call_id: payload.call_id ?? null,
    action_type: payload.action_type ?? "follow_up",
    title: payload.title.trim(),
    description: payload.description?.trim() || null,
    assigned_department: payload.assigned_department?.trim() || null,
    status: payload.status ?? "pending",
    due_at: payload.due_at ?? null,
    updated_at: new Date().toISOString(),
  };

  if (id) {
    const { error } = await db.from("ai_actions").update(row).eq("id", id);
    if (error) throw error;
    return id;
  }

  const { data, error } = await db.from("ai_actions").insert(row).select("id").single();
  if (error) throw error;
  return data.id as string;
}

export async function updateActionStatus(id: string, status: AiAction["status"]): Promise<void> {
  const { error } = await supabase
    .from("ai_actions")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteAction(id: string): Promise<void> {
  const { error } = await supabase
    .from("ai_actions")
    .update({ is_archived: true, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

/* -------------------------------------------------------------------------- */
/* Escalations                                                                 */
/* -------------------------------------------------------------------------- */

export async function fetchEscalations(schoolId: string): Promise<AiEscalation[]> {
  const { data, error } = await supabase
    .from("ai_escalations")
    .select("*")
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as AiEscalation[];
}

export async function updateEscalationStatus(
  id: string,
  status: AiEscalation["status"],
): Promise<void> {
  const { error } = await supabase
    .from("ai_escalations")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}
