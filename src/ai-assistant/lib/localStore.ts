import type { AiConversation, AiMessage } from "./types";

const PREFIX = "eduManageAi:";

function key(userId: string, suffix: string) {
  return `${PREFIX}${userId}:${suffix}`;
}

function readJson<T>(k: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(k);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(k: string, value: unknown) {
  localStorage.setItem(k, JSON.stringify(value));
}

export function listLocalConversations(userId: string): AiConversation[] {
  return readJson<AiConversation[]>(key(userId, "conversations"), []).sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  );
}

export function saveLocalConversations(userId: string, convs: AiConversation[]) {
  writeJson(key(userId, "conversations"), convs);
}

export function listLocalFavorites(userId: string): Set<string> {
  return new Set(readJson<string[]>(key(userId, "favorites"), []));
}

export function saveLocalFavorites(userId: string, ids: string[]) {
  writeJson(key(userId, "favorites"), ids);
}

export function getLocalMessages(userId: string, conversationId: string): AiMessage[] {
  return readJson<AiMessage[]>(key(userId, `messages:${conversationId}`), []);
}

export function saveLocalMessages(userId: string, conversationId: string, messages: AiMessage[]) {
  writeJson(key(userId, `messages:${conversationId}`), messages);
}

export function newLocalId(): string {
  return crypto.randomUUID();
}
