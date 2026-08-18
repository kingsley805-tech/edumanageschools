import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  deleteKnowledgeArticle,
  saveKnowledgeArticle,
  toggleKnowledgePublished,
} from "@/modules/ai-receptionist/lib/api";
import {
  KNOWLEDGE_CATEGORY_LABELS,
  SUPPORTED_LANGUAGES,
  type AiKnowledgeArticle,
  type KnowledgeCategory,
} from "@/modules/ai-receptionist/lib/types";

type Props = {
  articles: AiKnowledgeArticle[];
  schoolId: string | null;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  onRefresh: () => void;
};

type FormState = {
  category: KnowledgeCategory;
  title: string;
  content: string;
  keywords: string;
  language: string;
  is_published: boolean;
};

const EMPTY_FORM: FormState = {
  category: "general",
  title: "",
  content: "",
  keywords: "",
  language: "en",
  is_published: true,
};

export function AiReceptionistKnowledgePanel({
  articles,
  schoolId,
  canCreate,
  canEdit,
  canDelete,
  onRefresh,
}: Props) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return articles.filter((a) => {
      if (categoryFilter !== "all" && a.category !== categoryFilter) return false;
      if (!term) return true;
      return (
        a.title.toLowerCase().includes(term) ||
        a.content.toLowerCase().includes(term) ||
        a.keywords.some((k) => k.toLowerCase().includes(term))
      );
    });
  }, [articles, search, categoryFilter]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (article: AiKnowledgeArticle) => {
    setEditingId(article.id);
    setForm({
      category: article.category,
      title: article.title,
      content: article.content,
      keywords: article.keywords.join(", "),
      language: article.language,
      is_published: article.is_published,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!schoolId) return;
    if (!form.title.trim() || !form.content.trim()) {
      toast.error("Title and answer are required");
      return;
    }
    setSaving(true);
    try {
      await saveKnowledgeArticle(
        schoolId,
        {
          category: form.category,
          title: form.title,
          content: form.content,
          keywords: form.keywords
            .split(",")
            .map((k) => k.trim())
            .filter(Boolean),
          language: form.language,
          is_published: form.is_published,
        },
        editingId ?? undefined,
      );
      toast.success(editingId ? "Article updated" : "Article added");
      setDialogOpen(false);
      onRefresh();
    } catch (e) {
      toast.error((e as Error).message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (article: AiKnowledgeArticle) => {
    try {
      await deleteKnowledgeArticle(article.id);
      toast.success("Article removed");
      onRefresh();
    } catch (e) {
      toast.error((e as Error).message ?? "Delete failed");
    }
  };

  const handleTogglePublished = async (article: AiKnowledgeArticle) => {
    try {
      await toggleKnowledgePublished(article.id, !article.is_published);
      onRefresh();
    } catch (e) {
      toast.error((e as Error).message ?? "Update failed");
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-base">School knowledge base</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Answers the assistant uses on calls. Published articles are read by the AI.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search articles…"
              className="w-full pl-8 sm:w-56"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {Object.entries(KNOWLEDGE_CATEGORY_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {canCreate ? (
            <Button size="sm" onClick={openCreate} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Add article
            </Button>
          ) : null}
        </div>
      </CardHeader>

      <CardContent>
        {filtered.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No knowledge articles yet. Add admissions, fees, and calendar answers so the assistant can
            respond accurately.
          </p>
        ) : (
          <div className="space-y-3">
            {filtered.map((article) => (
              <div key={article.id} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{article.title}</p>
                      <Badge variant="outline">
                        {KNOWLEDGE_CATEGORY_LABELS[article.category] ?? article.category}
                      </Badge>
                      {!article.is_published ? <Badge variant="secondary">Draft</Badge> : null}
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {article.content}
                    </p>
                    {article.keywords.length ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Keywords: {article.keywords.join(", ")}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {canEdit ? (
                      <Switch
                        checked={article.is_published}
                        onCheckedChange={() => void handleTogglePublished(article)}
                        aria-label="Published"
                      />
                    ) : null}
                    {canEdit ? (
                      <Button variant="ghost" size="icon" onClick={() => openEdit(article)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    ) : null}
                    {canDelete ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => void handleDelete(article)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit article" : "Add knowledge article"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) => setForm((f) => ({ ...f, category: v as KnowledgeCategory }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(KNOWLEDGE_CATEGORY_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Language</Label>
                <Select
                  value={form.language}
                  onValueChange={(v) => setForm((f) => ({ ...f, language: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPORTED_LANGUAGES.map((lang) => (
                      <SelectItem key={lang.code} value={lang.code}>
                        {lang.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Question / topic</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. What are the admission requirements?"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Answer the assistant should give</Label>
              <Textarea
                value={form.content}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                rows={6}
                placeholder="Write the answer exactly as you want it spoken to callers."
              />
            </div>

            <div className="space-y-1.5">
              <Label>Keywords (comma separated)</Label>
              <Input
                value={form.keywords}
                onChange={(e) => setForm((f) => ({ ...f, keywords: e.target.value }))}
                placeholder="admission, enrol, apply"
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={form.is_published}
                onCheckedChange={(v) => setForm((f) => ({ ...f, is_published: v }))}
                id="kb-published"
              />
              <Label htmlFor="kb-published">Published (available to the assistant)</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleSave()} disabled={saving}>
              {saving ? "Saving…" : "Save article"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
