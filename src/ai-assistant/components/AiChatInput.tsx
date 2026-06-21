import { useRef, useState, useCallback } from "react";
import { Mic, MicOff, Paperclip, Send, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { AI_ASSISTANT_SHORT } from "../lib/branding";
import { toast } from "sonner";

type Props = {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  disabled?: boolean;
  loading?: boolean;
  onStop?: () => void;
  placeholder?: string;
};

export function AiChatInput({
  value,
  onChange,
  onSend,
  disabled,
  loading,
  onStop,
  placeholder = `Ask ${AI_ASSISTANT_SHORT} anything…`,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && !loading && value.trim()) onSend();
    }
  };

  const toggleVoice = useCallback(() => {
    const win = window as Window & {
      SpeechRecognition?: new () => {
        continuous: boolean;
        interimResults: boolean;
        lang: string;
        start: () => void;
        stop: () => void;
        onresult: ((event: { results: Iterable<{ 0: { transcript: string } }> }) => void) | null;
        onerror: (() => void) | null;
        onend: (() => void) | null;
      };
      webkitSpeechRecognition?: new () => {
        continuous: boolean;
        interimResults: boolean;
        lang: string;
        start: () => void;
        stop: () => void;
        onresult: ((event: { results: Iterable<{ 0: { transcript: string } }> }) => void) | null;
        onerror: (() => void) | null;
        onend: (() => void) | null;
      };
    };

    const SpeechRecognition = win.SpeechRecognition ?? win.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      toast.error("Speech recognition is not supported in this browser.");
      return;
    }

    if (listening && recognitionRef.current) {
      recognitionRef.current.stop();
      setListening(false);
      return;
    }

    const rec = new SpeechRecognition();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = "en-US";
    recognitionRef.current = rec;

    rec.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((r) => r[0].transcript)
        .join("");
      onChange(transcript);
    };
    rec.onerror = () => {
      setListening(false);
      toast.error("Could not capture speech.");
    };
    rec.onend = () => setListening(false);

    rec.start();
    setListening(true);
  }, [listening, onChange]);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["txt", "csv", "md"].includes(ext ?? "")) {
      toast.message("File attached as reference", {
        description: "For PDF/DOCX/XLSX, paste key content or use TXT/CSV for now.",
      });
    }

    try {
      const text = await file.text();
      const excerpt = text.slice(0, 8000);
      onChange(
        value
          ? `${value}\n\n--- Attached: ${file.name} ---\n${excerpt}`
          : `Please analyze this file (${file.name}):\n\n${excerpt}`,
      );
      toast.success(`Attached ${file.name}`);
    } catch {
      toast.error("Could not read file.");
    }
  };

  return (
    <div className="border-t bg-background/95 p-3 backdrop-blur md:p-4">
      <div
        className={cn(
          "mx-auto flex max-w-3xl flex-col gap-2 rounded-2xl border bg-card p-2 shadow-sm",
          "focus-within:ring-2 focus-within:ring-primary/20",
        )}
      >
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="min-h-[44px] max-h-40 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
        />
        <div className="flex items-center justify-between gap-2 px-1 pb-1">
          <div className="flex items-center gap-1">
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              accept=".txt,.csv,.md,.pdf,.doc,.docx,.xls,.xlsx"
              onChange={onFile}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={() => fileRef.current?.click()}
              disabled={disabled}
              title="Attach file"
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant={listening ? "secondary" : "ghost"}
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={toggleVoice}
              disabled={disabled}
              title="Voice input"
            >
              {listening ? <MicOff className="h-4 w-4 text-red-500" /> : <Mic className="h-4 w-4" />}
            </Button>
          </div>
          {loading ? (
            <Button size="sm" variant="secondary" className="gap-1.5" onClick={onStop}>
              <Square className="h-3.5 w-3.5 fill-current" />
              Stop
            </Button>
          ) : (
            <Button
              size="sm"
              className="gap-1.5"
              onClick={onSend}
              disabled={disabled || !value.trim()}
            >
              <Send className="h-3.5 w-3.5" />
              Send
            </Button>
          )}
        </div>
      </div>
      <p className="mx-auto mt-2 max-w-3xl text-center text-[11px] text-muted-foreground">
        {AI_ASSISTANT_SHORT} can make mistakes. Verify important information.
      </p>
    </div>
  );
}
