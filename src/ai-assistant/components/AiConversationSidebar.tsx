import { useMemo, useState } from "react";
import {
  MessageSquarePlus,
  Search,
  Star,
  Trash2,
  Pencil,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { AiConversation } from "../lib/types";
import { formatDistanceToNow } from "date-fns";

type Props = {
  conversations: AiConversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onToggleFavorite: (id: string, favorite: boolean) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  className?: string;
};

export function AiConversationSidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
  onRename,
  onToggleFavorite,
  collapsed,
  onToggleCollapse,
  className,
}: Props) {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"all" | "favorites">("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  const filtered = useMemo(() => {
    let list = conversations;
    if (tab === "favorites") list = list.filter((c) => c.is_favorite);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((c) => c.title.toLowerCase().includes(q));
    }
    return list;
  }, [conversations, search, tab]);

  if (collapsed) {
    return (
      <div className={cn("flex flex-col items-center border-r bg-muted/20 p-2", className)}>
        <Button variant="ghost" size="icon" onClick={onToggleCollapse} title="Show sidebar">
          <PanelLeft className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="mt-2" onClick={onNew} title="New chat">
          <MessageSquarePlus className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <aside
      className={cn(
        "flex w-full flex-col border-r bg-muted/20 md:w-72 lg:w-80",
        className,
      )}
    >
      <div className="flex items-center gap-2 border-b p-3">
        <Button className="flex-1 justify-start gap-2" variant="outline" onClick={onNew}>
          <MessageSquarePlus className="h-4 w-4" />
          New chat
        </Button>
        {onToggleCollapse && (
          <Button variant="ghost" size="icon" className="shrink-0 md:hidden" onClick={onToggleCollapse}>
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="space-y-2 border-b p-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations"
            className="pl-9"
          />
        </div>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant={tab === "all" ? "secondary" : "ghost"}
            className="flex-1"
            onClick={() => setTab("all")}
          >
            All
          </Button>
          <Button
            size="sm"
            variant={tab === "favorites" ? "secondary" : "ghost"}
            className="flex-1 gap-1"
            onClick={() => setTab("favorites")}
          >
            <Star className="h-3.5 w-3.5" />
            Favorites
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-0.5 p-2">
          {filtered.length === 0 && (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">No conversations yet</p>
          )}
          {filtered.map((c) => (
            <div
              key={c.id}
              className={cn(
                "group flex items-start gap-1 rounded-lg px-2 py-2 hover:bg-muted/60",
                activeId === c.id && "bg-muted",
              )}
            >
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() => onSelect(c.id)}
              >
                {editingId === c.id ? (
                  <Input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onBlur={() => {
                      if (editTitle.trim()) onRename(c.id, editTitle.trim());
                      setEditingId(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        if (editTitle.trim()) onRename(c.id, editTitle.trim());
                        setEditingId(null);
                      }
                    }}
                    autoFocus
                    className="h-7 text-xs"
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <>
                    <p className="truncate text-sm font-medium">{c.title}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(c.updated_at), { addSuffix: true })}
                    </p>
                  </>
                )}
              </button>
              <div className="flex shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => onToggleFavorite(c.id, !c.is_favorite)}
                >
                  <Star
                    className={cn("h-3.5 w-3.5", c.is_favorite && "fill-amber-400 text-amber-400")}
                  />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => {
                    setEditingId(c.id);
                    setEditTitle(c.title);
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive"
                  onClick={() => onDelete(c.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </aside>
  );
}
