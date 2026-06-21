import { supabase } from "@/integrations/supabase/client";
import { isMissingRpcError, isMissingSchemaTableError } from "@/report/lib/supabase-errors";
import type { AiContext, AiConversation, AiMessage, AiUsageStats } from "./types";
import {
  getLocalMessages,
  listLocalConversations,
  listLocalFavorites,
  newLocalId,
  saveLocalConversations,
  saveLocalFavorites,
  saveLocalMessages,
} from "./localStore";

export const AI_SETUP_SQL_URL =
  "https://supabase.com/dashboard/project/xbhhpjtwawfawifhpxbe/sql/new";

export const AI_SETUP_HINT =
  "Platform AI uses one shared Gemini key. Super Admin: open AI Assistant and save the platform key.";

const AI_DB_SETUP_MESSAGE =
  "AI database is not set up. Run public/sql/apply-ai-assistant.sql in Supabase SQL Editor, then public/sql/patch-gemini-chat-timeout.sql.";

const AI_TIMEOUT_MESSAGE =
  "Gemini timed out. Run public/sql/patch-gemini-chat-timeout.sql in Supabase SQL Editor, then try a shorter message.";

let aiDbReady: boolean | null = null;
let localUserId: string | null = null;

function isTableMissing(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (isMissingSchemaTableError(error)) return true;
  const msg = (error.message ?? "").toLowerCase();
  return msg.includes("ai_conversations") || msg.includes("404");
}

async function probeAiTables(): Promise<boolean> {
  if (aiDbReady !== null) return aiDbReady;
  const { error } = await supabase.from("ai_conversations").select("id").limit(1);
  aiDbReady = !isTableMissing(error);
  return aiDbReady;
}

function useLocal(userId: string) {
  localUserId = userId;
  aiDbReady = false;
}

export async function fetchSchoolIdForUser(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("profiles")
    .select("school_id")
    .eq("id", userId)
    .maybeSingle();
  return data?.school_id ?? null;
}

export async function listConversations(userId: string): Promise<AiConversation[]> {
  const ready = await probeAiTables();
  if (!ready) {
    useLocal(userId);
    const favs = listLocalFavorites(userId);
    return listLocalConversations(userId).map((c) => ({
      ...c,
      is_favorite: favs.has(c.id),
    }));
  }

  const { data: convs, error } = await supabase
    .from("ai_conversations")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(100);

  if (isTableMissing(error)) {
    useLocal(userId);
    return listConversations(userId);
  }
  if (error) throw error;

  const { data: favs } = await supabase.from("ai_favorites").select("conversation_id");
  const favSet = new Set((favs ?? []).map((f) => f.conversation_id));

  return (convs ?? []).map((c) => ({
    ...c,
    is_favorite: favSet.has(c.id),
  })) as AiConversation[];
}

export async function createConversation(opts: {
  schoolId: string;
  userId: string;
  title?: string;
  context?: AiContext;
}): Promise<AiConversation> {
  const ready = await probeAiTables();
  const now = new Date().toISOString();

  if (!ready) {
    useLocal(opts.userId);
    const conv: AiConversation = {
      id: newLocalId(),
      school_id: opts.schoolId,
      user_id: opts.userId,
      title: opts.title ?? "New chat",
      module_context: opts.context?.moduleLabel ?? opts.context?.module ?? null,
      page_path: opts.context?.pagePath ?? null,
      created_at: now,
      updated_at: now,
    };
    const list = [conv, ...listLocalConversations(opts.userId)];
    saveLocalConversations(opts.userId, list);
    return conv;
  }

  const { data, error } = await supabase
    .from("ai_conversations")
    .insert({
      school_id: opts.schoolId,
      user_id: opts.userId,
      title: opts.title ?? "New chat",
      module_context: opts.context?.moduleLabel ?? opts.context?.module ?? null,
      page_path: opts.context?.pagePath ?? null,
    })
    .select()
    .single();

  if (isTableMissing(error)) {
    useLocal(opts.userId);
    return createConversation(opts);
  }
  if (error) throw error;
  return data as AiConversation;
}

export async function renameConversation(userId: string, id: string, title: string) {
  const ready = await probeAiTables();
  if (!ready) {
    const list = listLocalConversations(userId).map((c) =>
      c.id === id ? { ...c, title, updated_at: new Date().toISOString() } : c,
    );
    saveLocalConversations(userId, list);
    return;
  }

  const { error } = await supabase
    .from("ai_conversations")
    .update({ title, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (isTableMissing(error)) {
    useLocal(userId);
    return renameConversation(userId, id, title);
  }
  if (error) throw error;
}

export async function deleteConversation(userId: string, id: string) {
  const ready = await probeAiTables();
  if (!ready) {
    saveLocalConversations(
      userId,
      listLocalConversations(userId).filter((c) => c.id !== id),
    );
    return;
  }

  const { error } = await supabase.from("ai_conversations").delete().eq("id", id);
  if (isTableMissing(error)) {
    useLocal(userId);
    return deleteConversation(userId, id);
  }
  if (error) throw error;
}

export async function toggleFavorite(userId: string, conversationId: string, favorite: boolean) {
  const ready = await probeAiTables();
  if (!ready) {
    const favs = listLocalFavorites(userId);
    if (favorite) favs.add(conversationId);
    else favs.delete(conversationId);
    saveLocalFavorites(userId, [...favs]);
    return;
  }

  if (favorite) {
    const { error } = await supabase
      .from("ai_favorites")
      .upsert({ user_id: userId, conversation_id: conversationId });
    if (isTableMissing(error)) {
      useLocal(userId);
      return toggleFavorite(userId, conversationId, favorite);
    }
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("ai_favorites")
      .delete()
      .eq("user_id", userId)
      .eq("conversation_id", conversationId);
    if (isTableMissing(error)) {
      useLocal(userId);
      return toggleFavorite(userId, conversationId, favorite);
    }
    if (error) throw error;
  }
}

export async function fetchMessages(userId: string, conversationId: string): Promise<AiMessage[]> {
  const ready = await probeAiTables();
  if (!ready) return getLocalMessages(userId, conversationId);

  const { data, error } = await supabase
    .from("ai_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (isTableMissing(error)) {
    useLocal(userId);
    return getLocalMessages(userId, conversationId);
  }
  if (error) throw error;
  return (data ?? []) as AiMessage[];
}

export async function saveMessage(
  userId: string,
  conversationId: string,
  role: "user" | "assistant",
  content: string,
  tokens = 0,
): Promise<AiMessage> {
  const ready = await probeAiTables();
  const now = new Date().toISOString();

  if (!ready) {
    const msg: AiMessage = {
      id: newLocalId(),
      conversation_id: conversationId,
      role,
      content,
      tokens,
      feedback: null,
      created_at: now,
    };
    const messages = [...getLocalMessages(userId, conversationId), msg];
    saveLocalMessages(userId, conversationId, messages);
    const list = listLocalConversations(userId).map((c) =>
      c.id === conversationId ? { ...c, updated_at: now } : c,
    );
    saveLocalConversations(userId, list);
    return msg;
  }

  const { data, error } = await supabase
    .from("ai_messages")
    .insert({ conversation_id: conversationId, role, content, tokens })
    .select()
    .single();

  if (isTableMissing(error)) {
    useLocal(userId);
    return saveMessage(userId, conversationId, role, content, tokens);
  }
  if (error) throw error;

  await supabase
    .from("ai_conversations")
    .update({ updated_at: now })
    .eq("id", conversationId);

  return data as AiMessage;
}

export async function setMessageFeedback(
  userId: string,
  messageId: string,
  conversationId: string,
  feedback: "like" | "dislike" | null,
) {
  const ready = await probeAiTables();
  if (!ready) {
    const messages = getLocalMessages(userId, conversationId).map((m) =>
      m.id === messageId ? { ...m, feedback } : m,
    );
    saveLocalMessages(userId, conversationId, messages);
    return;
  }

  const { error } = await supabase.from("ai_messages").update({ feedback }).eq("id", messageId);
  if (isTableMissing(error)) {
    useLocal(userId);
    return setMessageFeedback(userId, messageId, conversationId, feedback);
  }
  if (error) throw error;
}

type GeminiRpcResult = {
  ok?: boolean;
  content?: string;
  tokens?: number;
  error?: string;
  totalRequests?: number;
  totalTokens?: number;
  monthlyLimit?: number;
  remaining?: number;
};

async function invokeGeminiViaRpc(opts: {
  message: string;
  history: { role: "user" | "assistant"; content: string }[];
  context: AiContext;
  conversationId: string;
}): Promise<{ content: string; tokens: number }> {
  const { data, error } = await supabase.rpc("gemini_chat", {
    p_message: opts.message,
    p_history: opts.history,
    p_context: opts.context,
    p_conversation_id: opts.conversationId || null,
  });

  if (error) {
    if (isMissingRpcError(error)) throw new Error(AI_DB_SETUP_MESSAGE);
    const msg = error.message ?? "";
    if (msg.toLowerCase().includes("timed out") || msg.includes("5002")) {
      throw new Error(AI_TIMEOUT_MESSAGE);
    }
    throw new Error(msg);
  }

  const result = data as GeminiRpcResult | null;
  if (!result) throw new Error(AI_DB_SETUP_MESSAGE);
  if (result.ok && result.content) {
    return { content: result.content, tokens: result.tokens ?? 0 };
  }
  if (result.error) {
    const err = result.error;
    if (err.toLowerCase().includes("timed out") || err.includes("5002")) {
      throw new Error(AI_TIMEOUT_MESSAGE);
    }
    throw new Error(err);
  }
  throw new Error(AI_DB_SETUP_MESSAGE);
}

async function invokeGemini(opts: {
  message: string;
  history: { role: "user" | "assistant"; content: string }[];
  context: AiContext;
  conversationId: string;
}): Promise<{ content: string; tokens: number }> {
  return invokeGeminiViaRpc({
    ...opts,
    history: opts.history.slice(-20),
  });
}

export async function sendChatToGemini(opts: {
  conversationId: string;
  message: string;
  history: { role: "user" | "assistant"; content: string }[];
  context: AiContext;
}): Promise<{ content: string; tokens: number }> {
  return invokeGemini({
    conversationId: opts.conversationId,
    message: opts.message,
    history: opts.history,
    context: opts.context,
  });
}

export async function fetchUsageStats(): Promise<AiUsageStats> {
  const defaults: AiUsageStats = {
    totalRequests: 0,
    totalTokens: 0,
    monthlyLimit: 1000,
    remaining: 1000,
  };

  try {
    const { data, error } = await supabase.rpc("gemini_chat_usage_stats");
    if (error) return defaults;
    const result = data as GeminiRpcResult;
    if (result?.ok === false) return defaults;
    return {
      totalRequests: result.totalRequests ?? 0,
      totalTokens: result.totalTokens ?? 0,
      monthlyLimit: result.monthlyLimit ?? 1000,
      remaining: result.remaining ?? 1000,
    };
  } catch {
    return defaults;
  }
}

export function isUsingLocalAiStore(): boolean {
  return aiDbReady === false;
}

export async function isGeminiConfigured(): Promise<boolean | null> {
  const { data, error } = await supabase.rpc("get_platform_ai_status");
  if (error) {
    if (isMissingRpcError(error)) return null;
    return null;
  }
  const result = data as { configured?: boolean } | null;
  return !!result?.configured;
}

export function deriveTitleFromMessage(message: string): string {
  const line = message.trim().split("\n")[0] ?? "New chat";
  return line.length > 48 ? `${line.slice(0, 45)}…` : line;
}

export function exportTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
