export type AiMessageRole = "user" | "assistant" | "system";

export type AiConversation = {
  id: string;
  school_id: string;
  user_id: string;
  title: string;
  module_context: string | null;
  page_path: string | null;
  created_at: string;
  updated_at: string;
  is_favorite?: boolean;
};

export type AiMessage = {
  id: string;
  conversation_id: string;
  role: AiMessageRole;
  content: string;
  tokens: number;
  feedback: "like" | "dislike" | null;
  created_at: string;
};

export type AiContext = {
  module?: string;
  moduleLabel?: string;
  pagePath?: string;
  userRole?: string;
  userName?: string;
  schoolName?: string;
};

export type AiUsageStats = {
  totalRequests: number;
  totalTokens: number;
  monthlyLimit: number;
  remaining: number;
};

export type PromptTemplate = {
  id: string;
  category: string;
  title: string;
  prompt: string;
  is_system: boolean;
};
