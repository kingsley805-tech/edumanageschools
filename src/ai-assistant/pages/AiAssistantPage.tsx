import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { Menu, PanelRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { usePermissions } from "@/hooks/usePermissions";
import DashboardLayout from "@/components/DashboardLayout";
import { toast } from "sonner";
import { AiConversationSidebar } from "../components/AiConversationSidebar";
import { AiChatInput } from "../components/AiChatInput";
import { AiMessageBubble } from "../components/AiMessageBubble";
import { AiWelcomeScreen } from "../components/AiWelcomeScreen";
import { AiContextPanel } from "../components/AiContextPanel";
import { AiBrandIcon } from "../components/AiBrandIcon";
import { AiGeminiSetupCard } from "../components/AiGeminiSetupCard";
import { AiGeminiPendingNotice } from "../components/AiGeminiPendingNotice";
import { AI_ASSISTANT_TAGLINE, AI_ASSISTANT_TITLE } from "../lib/branding";
import {
  createConversation,
  deleteConversation,
  deriveTitleFromMessage,
  fetchMessages,
  fetchSchoolIdForUser,
  fetchUsageStats,
  isGeminiConfigured,
  isUsingLocalAiStore,
  listConversations,
  renameConversation,
  saveMessage,
  sendChatToGemini,
  setMessageFeedback,
  toggleFavorite,
  AI_SETUP_HINT,
} from "../lib/api";
import { buildContextFromLocation, loadReferrerContext } from "../lib/context";
import type { AiConversation, AiMessage, AiContext, AiUsageStats } from "../lib/types";

function roleForLayout(role: string | undefined): "admin" | "teacher" | "parent" | "student" | "accountant" | "auditor" {
  if (role === "super_admin") return "admin";
  if (role === "accountant") return "accountant";
  if (role === "auditor") return "auditor";
  if (role === "teacher") return "teacher";
  if (role === "parent") return "parent";
  if (role === "student") return "student";
  return "admin";
}

/** Simulated streaming by revealing tokens in chunks */
async function streamReveal(
  fullText: string,
  onChunk: (partial: string) => void,
  signal?: AbortSignal,
) {
  const words = fullText.split(/(\s+)/);
  let acc = "";
  for (const w of words) {
    if (signal?.aborted) break;
    acc += w;
    onChunk(acc);
    await new Promise((r) => setTimeout(r, 12));
  }
}

export default function AiAssistantPage() {
  const { user } = useAuth();
  const { role: portalRole, hasPortalRole } = useUserRole();
  const { isSuperAdmin } = usePermissions();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const role = portalRole ?? "admin";
  const layoutRole = roleForLayout(role);
  const userName =
    (user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? "there";
  const canConfigurePlatformAi = isSuperAdmin || hasPortalRole("super_admin");

  const [context] = useState<AiContext>(() => {
    const referrer = loadReferrerContext();
    const fromLoc = buildContextFromLocation(location.pathname, role, userName);
    return referrer ?? fromLoc;
  });

  const [conversations, setConversations] = useState<AiConversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(searchParams.get("c"));
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [input, setInput] = useState(searchParams.get("q") ?? "");
  const [loading, setLoading] = useState(false);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [usage, setUsage] = useState<AiUsageStats | null>(null);
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [needsGeminiSetup, setNeedsGeminiSetup] = useState(false);
  const [showKeyManager, setShowKeyManager] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const localHintShown = useRef(false);

  const refreshConversations = useCallback(async () => {
    if (!user?.id) return;
    try {
      const list = await listConversations(user.id);
      setConversations(list);
      if (isUsingLocalAiStore() && !localHintShown.current) {
        localHintShown.current = true;
        toast.message("Using local chat history", { description: AI_SETUP_HINT });
      }
    } catch {
      /* ignore */
    }
  }, [user?.id]);

  const loadUsage = useCallback(async () => {
    try {
      const stats = await fetchUsageStats();
      setUsage(stats);
    } catch {
      /* edge fn may not be deployed */
    }
  }, []);

  useEffect(() => {
    void isGeminiConfigured().then((configured) => {
      if (configured === false) setNeedsGeminiSetup(true);
      if (configured === true) setNeedsGeminiSetup(false);
    });
  }, []);

  useEffect(() => {
    void refreshConversations();
    void loadUsage();
  }, [refreshConversations, loadUsage]);

  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return;
    }
    void fetchMessages(user.id, activeId)
      .then(setMessages)
      .catch(() => setMessages([]));
  }, [activeId, user?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingId]);

  useEffect(() => {
    const q = searchParams.get("q");
    if (q) setInput(q);
  }, [searchParams]);

  const ensureConversation = async (): Promise<string> => {
    if (activeId) return activeId;
    if (!user?.id) throw new Error("Not signed in");
    const schoolId = await fetchSchoolIdForUser(user.id);
    if (!schoolId) throw new Error("School not found");
    const conv = await createConversation({
      schoolId,
      userId: user.id,
      context,
    });
    setActiveId(conv.id);
    setSearchParams({ c: conv.id });
    await refreshConversations();
    return conv.id;
  };

  const sendMessage = async (textOverride?: string) => {
    const text = (textOverride ?? input).trim();
    if (!text || loading || !user?.id) return;

    setInput("");
    setLoading(true);
    abortRef.current = new AbortController();

    try {
      const convId = await ensureConversation();

      const userMsg = await saveMessage(user.id, convId, "user", text);
      setMessages((m) => [...m, userMsg]);

      if (messages.length === 0) {
        const title = deriveTitleFromMessage(text);
        await renameConversation(user.id, convId, title);
        void refreshConversations();
      }

      const history = [...messages, userMsg]
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

      const { content, tokens } = await sendChatToGemini({
        conversationId: convId,
        message: text,
        history: history.slice(0, -1),
        context,
      });

      const tempId = `stream-${Date.now()}`;
      const placeholder: AiMessage = {
        id: tempId,
        conversation_id: convId,
        role: "assistant",
        content: "",
        tokens: 0,
        feedback: null,
        created_at: new Date().toISOString(),
      };
      setMessages((m) => [...m, placeholder]);
      setStreamingId(tempId);

      await streamReveal(
        content,
        (partial) => {
          setMessages((m) => m.map((msg) => (msg.id === tempId ? { ...msg, content: partial } : msg)));
        },
        abortRef.current.signal,
      );

      const assistantMsg = await saveMessage(user.id, convId, "assistant", content, tokens);
      setMessages((m) => m.map((msg) => (msg.id === tempId ? assistantMsg : msg)));
      setStreamingId(null);
      void loadUsage();
      void refreshConversations();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to send message";
      toast.error(msg);
      setStreamingId(null);
      setNeedsGeminiSetup(msg.includes("GEMINI_API_KEY") || msg.includes("Platform AI"));
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  };

  const handleRegenerate = async () => {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser) return;
    setMessages((m) => {
      const lastAssistantIdx = m.map((x) => x.role).lastIndexOf("assistant");
      if (lastAssistantIdx === -1) return m;
      return m.slice(0, lastAssistantIdx);
    });
    await sendMessage(lastUser.content);
  };

  const handleNewChat = () => {
    setActiveId(null);
    setMessages([]);
    setInput("");
    setSearchParams({});
    setLeftOpen(false);
  };

  const handleSelectConversation = (id: string) => {
    setActiveId(id);
    setSearchParams({ c: id });
    setLeftOpen(false);
  };

  const chatArea = (
    <div className="flex min-h-0 flex-1 flex-col">
      <ScrollArea className="flex-1">
        {canConfigurePlatformAi && (needsGeminiSetup || showKeyManager) ? (
          <AiGeminiSetupCard
            onConfigured={() => {
              setNeedsGeminiSetup(false);
              setShowKeyManager(false);
            }}
          />
        ) : null}
        {!canConfigurePlatformAi && needsGeminiSetup ? <AiGeminiPendingNotice /> : null}
        {messages.length === 0 && !loading ? (
          <AiWelcomeScreen
            userName={userName}
            role={role}
            onSelectPrompt={(p) => {
              setInput(p);
              void sendMessage(p);
            }}
          />
        ) : (
          <div className="pb-4">
            {messages.map((m) => (
              <AiMessageBubble
                key={m.id}
                message={m}
                isStreaming={m.id === streamingId}
                onRegenerate={
                  m.role === "assistant" && m.id === messages[messages.length - 1]?.id
                    ? handleRegenerate
                    : undefined
                }
                onFeedback={
                  m.role === "assistant" && !m.id.startsWith("stream-") && user?.id && activeId
                    ? (fb) => void setMessageFeedback(user.id, m.id, activeId, fb)
                    : undefined
                }
              />
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </ScrollArea>
      <AiChatInput
        value={input}
        onChange={setInput}
        onSend={() => void sendMessage()}
        loading={loading}
        disabled={!user}
        onStop={() => abortRef.current?.abort()}
      />
    </div>
  );

  return (
    <DashboardLayout role={layoutRole}>
      <div className="-mx-3 -mt-3 flex min-h-[calc(100vh-8rem)] flex-col overflow-hidden rounded-xl border bg-card shadow-sm md:-mx-0 md:mt-0 md:min-h-[calc(100vh-10rem)]">
        <header className="flex shrink-0 items-center justify-between border-b px-3 py-2 md:px-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setLeftOpen(true)}>
              <Menu className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <AiBrandIcon size="sm" rounded="lg" />
              <div>
                <p className="text-sm font-semibold leading-none">{AI_ASSISTANT_TITLE}</p>
                <p className="text-[11px] text-muted-foreground">{AI_ASSISTANT_TAGLINE}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canConfigurePlatformAi && !needsGeminiSetup ? (
              <Button
                variant="outline"
                size="sm"
                className="hidden h-8 text-xs sm:inline-flex"
                onClick={() => setShowKeyManager((v) => !v)}
              >
                {showKeyManager ? "Hide API key" : "Platform API key"}
              </Button>
            ) : null}
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setRightOpen(true)}>
              <PanelRight className="h-5 w-5" />
            </Button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          <AiConversationSidebar
            className="hidden md:flex"
            conversations={conversations}
            activeId={activeId}
            onSelect={handleSelectConversation}
            onNew={handleNewChat}
            onDelete={async (id) => {
              if (!user?.id) return;
              await deleteConversation(user.id, id);
              if (activeId === id) handleNewChat();
              void refreshConversations();
            }}
            onRename={async (id, title) => {
              if (!user?.id) return;
              await renameConversation(user.id, id, title);
              void refreshConversations();
            }}
            onToggleFavorite={async (id, fav) => {
              if (!user?.id) return;
              await toggleFavorite(user.id, id, fav);
              void refreshConversations();
            }}
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
          />

          <main className="min-w-0 flex-1">{chatArea}</main>

          <AiContextPanel
            className="hidden w-72 shrink-0 border-l lg:block xl:w-80"
            context={context}
            usage={usage}
            onActionClick={(action) => {
              setInput(action);
              void sendMessage(action);
            }}
          />
        </div>
      </div>

      <Sheet open={leftOpen} onOpenChange={setLeftOpen}>
        <SheetContent side="left" className="w-[min(100vw,20rem)] p-0">
          <AiConversationSidebar
            conversations={conversations}
            activeId={activeId}
            onSelect={handleSelectConversation}
            onNew={handleNewChat}
            onDelete={async (id) => {
              if (!user?.id) return;
              await deleteConversation(user.id, id);
              if (activeId === id) handleNewChat();
              void refreshConversations();
            }}
            onRename={async (id, title) => {
              if (!user?.id) return;
              await renameConversation(user.id, id, title);
              void refreshConversations();
            }}
            onToggleFavorite={async (id, fav) => {
              if (!user?.id) return;
              await toggleFavorite(user.id, id, fav);
              void refreshConversations();
            }}
          />
        </SheetContent>
      </Sheet>

      <Sheet open={rightOpen} onOpenChange={setRightOpen}>
        <SheetContent side="right" className="w-[min(100vw,20rem)] p-0">
          <AiContextPanel
            context={context}
            usage={usage}
            onActionClick={(action) => {
              setInput(action);
              setRightOpen(false);
              void sendMessage(action);
            }}
          />
        </SheetContent>
      </Sheet>
    </DashboardLayout>
  );
}
