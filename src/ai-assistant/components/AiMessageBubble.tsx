import { useState } from "react";
import {
  Copy,
  Download,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { AiMessage } from "../lib/types";
import { exportTextFile } from "../lib/api";
import { AiMarkdown } from "./AiMarkdown";
import { AiBrandIcon } from "./AiBrandIcon";
import { AI_ASSISTANT_SHORT } from "../lib/branding";

type Props = {
  message: AiMessage;
  onRegenerate?: () => void;
  onFeedback?: (feedback: "like" | "dislike" | null) => void;
  isStreaming?: boolean;
};

export function AiMessageBubble({ message, onRegenerate, onFeedback, isStreaming }: Props) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";

  const copy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={cn(
        "group flex gap-3 px-4 py-5 md:px-6",
        isUser ? "bg-transparent" : "bg-muted/30",
      )}
    >
      <div
        className={cn(
          "flex shrink-0",
          isUser ? "h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary" : "",
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <AiBrandIcon size="sm" rounded="full" />}
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <p className="text-xs font-medium text-muted-foreground">
          {isUser ? "You" : AI_ASSISTANT_SHORT}
        </p>
        {isUser ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
        ) : (
          <AiMarkdown content={message.content} />
        )}
        {isStreaming && (
          <span className="inline-flex gap-1 text-muted-foreground">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:0ms]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:150ms]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:300ms]" />
          </span>
        )}
        {!isUser && !isStreaming && (
          <div className="flex flex-wrap items-center gap-1 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
            <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={copy}>
              <Copy className="h-3.5 w-3.5" />
              {copied ? "Copied" : "Copy"}
            </Button>
            {onRegenerate && (
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={onRegenerate}>
                <RefreshCw className="h-3.5 w-3.5" />
                Regenerate
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() => exportTextFile(`ai-response-${message.id.slice(0, 8)}.txt`, message.content)}
            >
              <Download className="h-3.5 w-3.5" />
              Export
            </Button>
            {onFeedback && (
              <>
                <Button
                  variant={message.feedback === "like" ? "secondary" : "ghost"}
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onFeedback(message.feedback === "like" ? null : "like")}
                >
                  <ThumbsUp className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant={message.feedback === "dislike" ? "secondary" : "ghost"}
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onFeedback(message.feedback === "dislike" ? null : "dislike")}
                >
                  <ThumbsDown className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
