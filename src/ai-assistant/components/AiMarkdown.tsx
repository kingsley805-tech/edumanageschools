import { useMemo } from "react";
import { cn } from "@/lib/utils";

function renderInline(text: string) {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={i}
          className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
}

export function AiMarkdown({ content, className }: { content: string; className?: string }) {
  const blocks = useMemo(() => {
    const lines = content.split("\n");
    const result: { type: "p" | "ul" | "ol" | "code" | "h"; text: string; items?: string[] }[] = [];
    let codeBuf: string[] = [];
    let inCode = false;
    let listBuf: string[] = [];
    let listType: "ul" | "ol" | null = null;

    const flushList = () => {
      if (listBuf.length && listType) {
        result.push({ type: listType, text: "", items: [...listBuf] });
        listBuf = [];
        listType = null;
      }
    };

    for (const line of lines) {
      if (line.trim().startsWith("```")) {
        flushList();
        if (inCode) {
          result.push({ type: "code", text: codeBuf.join("\n") });
          codeBuf = [];
          inCode = false;
        } else {
          inCode = true;
        }
        continue;
      }
      if (inCode) {
        codeBuf.push(line);
        continue;
      }
      if (/^#{1,3}\s/.test(line)) {
        flushList();
        result.push({ type: "h", text: line.replace(/^#{1,3}\s/, "") });
        continue;
      }
      if (/^[-*]\s/.test(line)) {
        if (listType !== "ul") {
          flushList();
          listType = "ul";
        }
        listBuf.push(line.replace(/^[-*]\s/, ""));
        continue;
      }
      if (/^\d+\.\s/.test(line)) {
        if (listType !== "ol") {
          flushList();
          listType = "ol";
        }
        listBuf.push(line.replace(/^\d+\.\s/, ""));
        continue;
      }
      flushList();
      if (line.trim()) result.push({ type: "p", text: line });
    }
    flushList();
    if (inCode && codeBuf.length) result.push({ type: "code", text: codeBuf.join("\n") });
    return result;
  }, [content]);

  return (
    <div className={cn("prose prose-sm dark:prose-invert max-w-none space-y-2", className)}>
      {blocks.map((b, i) => {
        if (b.type === "h") {
          return (
            <p key={i} className="text-base font-semibold text-foreground">
              {renderInline(b.text)}
            </p>
          );
        }
        if (b.type === "code") {
          return (
            <pre
              key={i}
              className="overflow-x-auto rounded-lg bg-muted/80 p-3 font-mono text-xs leading-relaxed"
            >
              {b.text}
            </pre>
          );
        }
        if (b.type === "ul" && b.items) {
          return (
            <ul key={i} className="list-disc space-y-1 pl-5 text-sm">
              {b.items.map((item, j) => (
                <li key={j}>{renderInline(item)}</li>
              ))}
            </ul>
          );
        }
        if (b.type === "ol" && b.items) {
          return (
            <ol key={i} className="list-decimal space-y-1 pl-5 text-sm">
              {b.items.map((item, j) => (
                <li key={j}>{renderInline(item)}</li>
              ))}
            </ol>
          );
        }
        return (
          <p key={i} className="text-sm leading-relaxed text-foreground/90">
            {renderInline(b.text)}
          </p>
        );
      })}
    </div>
  );
}
