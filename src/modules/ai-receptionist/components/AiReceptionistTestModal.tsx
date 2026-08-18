import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Bot, User, Send, Sparkles, Volume2, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { AiVoiceAgent } from "@/modules/ai-receptionist/lib/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schoolId: string | null;
  agent: AiVoiceAgent | null;
};

type MessageTurn = {
  speaker: "ai" | "caller";
  text: string;
  time: string;
};

export function AiReceptionistTestModal({ open, onOpenChange, schoolId, agent }: Props) {
  const [messages, setMessages] = useState<MessageTurn[]>([
    {
      speaker: "ai",
      text: agent?.greeting || "Good morning! Thank you for calling our school. How may I assist you today?",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || !schoolId || loading) return;

    const userTurn: MessageTurn = {
      speaker: "caller",
      text,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userTurn]);
    setInput("");
    setLoading(true);

    try {
      // Invoke ai-receptionist edge function turn
      const { data, error } = await supabase.functions.invoke("ai-receptionist", {
        body: {
          schoolId,
          utterance: text,
          event: "caller_spoke",
        },
      });

      if (error) throw error;

      const aiReply = data?.reply || "I understand. Let me check that for you.";
      setMessages((prev) => [
        ...prev,
        {
          speaker: "ai",
          text: aiReply,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          speaker: "ai",
          text: "I am having trouble accessing that information right now. Let me connect you with a school representative.",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setMessages([
      {
        speaker: "ai",
        text: agent?.greeting || "Good morning! Thank you for calling our school. How may I assist you today?",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
  };

  const quickPrompts = [
    "What are the school fees for primary school?",
    "I'd like to report an absence for my child.",
    "When does the new term start?",
    "Can I speak to a teacher?",
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col p-6">
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Volume2 className="h-4 w-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold">Test Voice Assistant</DialogTitle>
                <DialogDescription className="text-xs">
                  Simulate live conversations with {agent?.name || "Emma"}
                </DialogDescription>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={handleReset} className="h-7 text-xs gap-1">
              <RotateCcw className="h-3 w-3" />
              Reset
            </Button>
          </div>
        </DialogHeader>

        <div className="flex flex-col flex-1 min-h-0 space-y-3">
          <ScrollArea className="h-72 rounded-lg border bg-muted/20 p-3">
            <div className="space-y-3">
              {messages.map((m, idx) => {
                const isAi = m.speaker === "ai";
                return (
                  <div key={idx} className={`flex gap-2.5 text-xs ${isAi ? "justify-start" : "justify-end"}`}>
                    {isAi ? (
                      <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                        <Bot className="h-3.5 w-3.5" />
                      </div>
                    ) : null}
                    <div
                      className={`rounded-xl px-3 py-2 max-w-[85%] ${
                        isAi
                          ? "bg-card border text-card-foreground shadow-xs"
                          : "bg-primary text-primary-foreground"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-4 mb-0.5 text-[10px] opacity-75">
                        <span>{isAi ? agent?.name || "AI Assistant" : "You (Caller)"}</span>
                        <span>{m.time}</span>
                      </div>
                      <p className="text-xs leading-relaxed">{m.text}</p>
                    </div>
                    {!isAi ? (
                      <div className="h-6 w-6 rounded-full bg-muted text-muted-foreground flex items-center justify-center shrink-0 mt-0.5">
                        <User className="h-3.5 w-3.5" />
                      </div>
                    ) : null}
                  </div>
                );
              })}
              {loading ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground italic pl-8">
                  <Sparkles className="h-3.5 w-3.5 animate-spin text-primary" />
                  <span>{agent?.name || "Assistant"} is speaking…</span>
                </div>
              ) : null}
            </div>
          </ScrollArea>

          {/* Quick prompts */}
          <div className="flex flex-wrap gap-1.5">
            {quickPrompts.map((q) => (
              <Badge
                key={q}
                variant="outline"
                className="cursor-pointer text-[11px] hover:bg-muted/80 transition-colors"
                onClick={() => void handleSend(q)}
              >
                {q}
              </Badge>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSend();
            }}
            className="flex gap-2"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type what the caller would say…"
              className="text-xs h-9"
              disabled={loading}
            />
            <Button type="submit" size="sm" disabled={!input.trim() || loading} className="h-9 px-3">
              <Send className="h-3.5 w-3.5" />
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
