import { supabase } from "@/integrations/supabase/client";
import { invokeEdgeFunction } from "@/lib/invokeEdgeFunction";
import type { AiContext, AiConversation, AiMessage, AiUsageStats } from "./types";

export const AI_SETUP_SQL_URL =
  "https://supabase.com/dashboard/project/xbhhpjtwawfawifhpxbe/sql/new";

export async function fetchSchoolIdForUser(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("profiles")
    .select("school_id")
    .eq("id", userId)
    .maybeSingle();
  return data?.school_id ?? null;
}

export async function listConversations(): Promise<AiConversation[]> {
  const { data: convs, error } = await supabase
    .from("ai_conversations")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(100);

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

  if (error) throw error;
  return data as AiConversation;
}

export async function renameConversation(id: string, title: string) {
  const { error } = await supabase
    .from("ai_conversations")
    .update({ title, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteConversation(id: string) {
  const { error } = await supabase.from("ai_conversations").delete().eq("id", id);
  if (error) throw error;
}

export async function toggleFavorite(conversationId: string, userId: string, favorite: boolean) {
  if (favorite) {
    const { error } = await supabase
      .from("ai_favorites")
      .upsert({ user_id: userId, conversation_id: conversationId });
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("ai_favorites")
      .delete()
      .eq("user_id", userId)
      .eq("conversation_id", conversationId);
    if (error) throw error;
  }
}

export async function fetchMessages(conversationId: string): Promise<AiMessage[]> {
  const { data, error } = await supabase
    .from("ai_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as AiMessage[];
}

export async function saveMessage(
  conversationId: string,
  role: "user" | "assistant",
  content: string,
  tokens = 0,
): Promise<AiMessage> {
  const { data, error } = await supabase
    .from("ai_messages")
    .insert({ conversation_id: conversationId, role, content, tokens })
    .select()
    .single();

  if (error) throw error;

  await supabase
    .from("ai_conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId);

  return data as AiMessage;
}

export async function setMessageFeedback(messageId: string, feedback: "like" | "dislike" | null) {
  const { error } = await supabase.from("ai_messages").update({ feedback }).eq("id", messageId);
  if (error) throw error;
}

export async function sendChatToGemini(opts: {
  conversationId: string;
  message: string;
  history: { role: "user" | "assistant"; content: string }[];
  context: AiContext;
}): Promise<{ content: string; tokens: number }> {
  return invokeEdgeFunction<{ content: string; tokens: number }>("gemini-chat", {
    action: "chat",
    conversationId: opts.conversationId,
    message: opts.message,
    history: opts.history,
    context: opts.context,
  });
}

export async function fetchUsageStats(): Promise<AiUsageStats> {
  return invokeEdgeFunction<AiUsageStats>("gemini-chat", { action: "usage_stats" });
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
