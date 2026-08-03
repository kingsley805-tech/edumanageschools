import { useMemo, useState } from "react";
import {
  Archive,
  Check,
  Eye,
  Globe,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { downloadCsv } from "@/modules/lib/exportCsv";
import {
  addAchievementNote,
  archiveAchievement,
  deleteAchievement,
  fetchAchievementNotes,
  saveAchievement,
  saveAchievementCategory,
  setAchievementPublished,
  setAchievementStatus,
} from "@/modules/achievements/lib/api";
import {
  ACHIEVEMENT_TYPE_LABELS,
  type Achievement,
  type AchievementCategory,
  type AchievementNote,
  type AchievementStatus,
  type AchievementType,
  type StudentOption,
} from "@/modules/achievements/lib/types";
import { toast } from "sonner";

type Access = {
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canExport: boolean;
  canManage: boolean;
};

type Props = {
  achievements: Achievement[];
  categories: AchievementCategory[];
  students: StudentOption[];
  access: Access;
  schoolId: string | null;
  userId: string | null;
  onRefresh: () => void;
};

const emptyForm = {
  student_id: "",
  category_id: "",
  title: "",
  achievement_type: "award" as AchievementType,
  description: "",
  awarded_by: "",
  awarded_on: new Date().toISOString().slice(0, 10),
  academic_year: "",
  term_label: "",
  level: "",
  venue: "",
  image_url: "",
  document_url: "",
  recommendation_letter: "",
  notes: "",
  status: "pending" as AchievementStatus,
  is_published: false,
};

function statusBadge(status: AchievementStatus) {
  if (status === "approved" || status === "active") return <Badge variant="success">{status}</Badge>;
  if (status === "pending") return <Badge variant="warning">pending</Badge>;
  if (status === "rejected") return <Badge variant="destructive">rejected</Badge>;
  return <Badge variant="secondary">{status}</Badge>;
}

export function AchievementsListPanel({
  achievements,
  categories,
  students,
  access,
  schoolId,
  userId,
  onRefresh,
}: Props) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showArchived, setShowArchived] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Achievement | null>(null);
  const [viewing, setViewing] = useState<Achievement | null>(null);
  const [notes, setNotes] = useState<AchievementNote[]>([]);
  const [noteText, setNoteText] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return achievements.filter((a) => {
      if (!showArchived && a.is_archived) return false;
      if (showArchived && !a.is_archived) return false;
      if (typeFilter !== "all" && a.achievement_type !== typeFilter) return false;
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (!q) return true;
      return (
        a.title.toLowerCase().includes(q) ||
        (a.student_name ?? "").toLowerCase().includes(q) ||
        (a.admission_number ?? "").toLowerCase().includes(q) ||
        (a.category_name ?? "").toLowerCase().includes(q)
      );
    });
  }, [achievements, search, typeFilter, statusFilter, showArchived]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (row: Achievement) => {
    setEditing(row);
    setForm({
      student_id: row.student_id,
      category_id: row.category_id ?? "",
      title: row.title,
      achievement_type: row.achievement_type,
      description: row.description ?? "",
      awarded_by: row.awarded_by ?? "",
      awarded_on: row.awarded_on?.slice(0, 10) ?? emptyForm.awarded_on,
      academic_year: row.academic_year ?? "",
      term_label: row.term_label ?? "",
      level: row.level ?? "",
      venue: row.venue ?? "",
      image_url: row.image_url ?? "",
      document_url: row.document_url ?? "",
      recommendation_letter: row.recommendation_letter ?? "",
      notes: row.notes ?? "",
      status: row.status,
      is_published: row.is_published,
    });
    setOpen(true);
  };

  const openView = async (row: Achievement) => {
    setViewing(row);
    try {
      setNotes(await fetchAchievementNotes(row.id));
    } catch {
      setNotes([]);
    }
  };

  const handleSave = async () => {
    if (!schoolId) return;
    if (!form.title.trim() || !form.student_id) {
      toast.error("Title and student are required.");
      return;
    }
    setSaving(true);
    try {
      await saveAchievement(
        schoolId,
        {
          ...form,
          category_id: form.category_id || null,
          description: form.description || null,
          awarded_by: form.awarded_by || null,
          academic_year: form.academic_year || null,
          term_label: form.term_label || null,
          level: form.level || null,
          venue: form.venue || null,
          image_url: form.image_url || null,
          document_url: form.document_url || null,
          recommendation_letter: form.recommendation_letter || null,
          notes: form.notes || null,
        },
        editing?.id,
        userId,
      );
      toast.success(editing ? "Achievement updated" : "Achievement created");
      setOpen(false);
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleAddCategory = async () => {
    if (!schoolId || !categoryName.trim()) return;
    try {
      await saveAchievementCategory(schoolId, { name: categoryName });
      toast.success("Category added");
      setCategoryName("");
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add category");
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await setAchievementStatus(id, "approved", userId);
      toast.success("Achievement approved");
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Approve failed");
    }
  };

  const handleReject = async (id: string) => {
    const reason = window.prompt("Rejection reason (optional)") ?? "";
    try {
      await setAchievementStatus(id, "rejected", userId, reason);
      toast.success("Achievement rejected");
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Reject failed");
    }
  };

  const togglePublish = async (row: Achievement) => {
    try {
      await setAchievementPublished(row.id, !row.is_published, userId);
      toast.success(row.is_published ? "Unpublished" : "Published");
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  };

  const handleArchive = async (row: Achievement, archived: boolean) => {
    try {
      await archiveAchievement(row.id, archived, userId);
      toast.success(archived ? "Archived" : "Restored");
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Archive failed");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Permanently delete this achievement?")) return;
    try {
      await deleteAchievement(id);
      toast.success("Deleted");
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const handleAddNote = async () => {
    if (!schoolId || !viewing || !noteText.trim()) return;
    try {
      await addAchievementNote(schoolId, viewing.id, noteText, userId);
      setNoteText("");
      setNotes(await fetchAchievementNotes(viewing.id));
      toast.success("Note added");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add note");
    }
  };

  const exportCsv = () => {
    downloadCsv(
      "achievements.csv",
      [
        "Title",
        "Student",
        "Admission",
        "Class",
        "Type",
        "Category",
        "Status",
        "Published",
        "Awarded On",
        "Year",
        "Term",
      ],
      filtered.map((a) => [
        a.title,
        a.student_name,
        a.admission_number,
        a.class_name,
        a.achievement_type,
        a.category_name,
        a.status,
        a.is_published ? "Yes" : "No",
        a.awarded_on,
        a.academic_year,
        a.term_label,
      ]),
    );
  };

  const bulkArchive = async () => {
    if (selected.size === 0) return;
    try {
      await Promise.all([...selected].map((id) => archiveAchievement(id, true, userId)));
      toast.success(`Archived ${selected.size} items`);
      setSelected(new Set());
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bulk archive failed");
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Achievements</CardTitle>
            <CardDescription>Awards, honors, certificates, competitions, and recognition</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            {access.canExport ? (
              <Button type="button" variant="outline" size="sm" onClick={exportCsv}>
                Export CSV
              </Button>
            ) : null}
            {access.canEdit && selected.size > 0 ? (
              <Button type="button" variant="outline" size="sm" onClick={bulkArchive}>
                Archive selected ({selected.size})
              </Button>
            ) : null}
            {access.canCreate ? (
              <Button type="button" size="sm" onClick={openCreate}>
                <Plus className="mr-1.5 h-4 w-4" />
                Add achievement
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <Input
              placeholder="Search student, title, category…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {Object.entries(ACHIEVEMENT_TYPE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {["pending", "approved", "rejected", "active", "inactive", "archived"].map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant={showArchived ? "secondary" : "outline"}
              onClick={() => setShowArchived((v) => !v)}
            >
              {showArchived ? "Showing archived" : "Show archived"}
            </Button>
          </div>

          {access.canManage ? (
            <div className="flex flex-wrap items-end gap-2 rounded-md border border-border bg-muted/30 p-3">
              <div className="min-w-[200px] flex-1 space-y-1">
                <Label>Quick-add category</Label>
                <Input
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  placeholder="e.g. Sports, STEM, Arts"
                />
              </div>
              <Button type="button" variant="outline" onClick={handleAddCategory}>
                Add category
              </Button>
            </div>
          ) : null}

          {filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No achievements match your filters.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10" />
                    <TableHead>Achievement</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selected.has(row.id)}
                          onChange={() => toggleSelect(row.id)}
                          aria-label={`Select ${row.title}`}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-foreground">{row.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {row.category_name ?? "Uncategorized"}
                          {row.is_published ? " · Published" : ""}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="cell-stack">
                          <span className="cell-primary">{row.student_name}</span>
                          <span className="cell-secondary">
                            {row.admission_number} · {row.class_name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{ACHIEVEMENT_TYPE_LABELS[row.achievement_type]}</TableCell>
                      <TableCell>{statusBadge(row.status)}</TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {row.awarded_on}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button type="button" size="icon" variant="ghost" onClick={() => openView(row)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          {access.canEdit ? (
                            <Button type="button" size="icon" variant="ghost" onClick={() => openEdit(row)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          ) : null}
                          {access.canManage && row.status === "pending" ? (
                            <>
                              <Button type="button" size="icon" variant="ghost" onClick={() => handleApprove(row.id)}>
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button type="button" size="icon" variant="ghost" onClick={() => handleReject(row.id)}>
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          ) : null}
                          {access.canEdit ? (
                            <Button type="button" size="icon" variant="ghost" onClick={() => togglePublish(row)}>
                              <Globe className="h-4 w-4" />
                            </Button>
                          ) : null}
                          {access.canEdit ? (
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              onClick={() => handleArchive(row, !row.is_archived)}
                            >
                              {row.is_archived ? <RotateCcw className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                            </Button>
                          ) : null}
                          {access.canDelete ? (
                            <Button type="button" size="icon" variant="ghost" onClick={() => handleDelete(row.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit achievement" : "New achievement"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <Label>Student *</Label>
              <Select
                value={form.student_id}
                onValueChange={(v) => setForm((f) => ({ ...f, student_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select student" />
                </SelectTrigger>
                <SelectContent>
                  {students.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} ({s.admission}) — {s.class_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Title *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Type</Label>
              <Select
                value={form.achievement_type}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, achievement_type: v as AchievementType }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ACHIEVEMENT_TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Category</Label>
              <Select
                value={form.category_id || "none"}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, category_id: v === "none" ? "" : v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Awarded on</Label>
              <Input
                type="date"
                value={form.awarded_on}
                onChange={(e) => setForm((f) => ({ ...f, awarded_on: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Awarded by</Label>
              <Input
                value={form.awarded_by}
                onChange={(e) => setForm((f) => ({ ...f, awarded_by: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Academic year</Label>
              <Input
                value={form.academic_year}
                onChange={(e) => setForm((f) => ({ ...f, academic_year: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Term</Label>
              <Input
                value={form.term_label}
                onChange={(e) => setForm((f) => ({ ...f, term_label: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Level</Label>
              <Input
                value={form.level}
                onChange={(e) => setForm((f) => ({ ...f, level: e.target.value }))}
                placeholder="School / District / National"
              />
            </div>
            <div className="space-y-1">
              <Label>Venue</Label>
              <Input
                value={form.venue}
                onChange={(e) => setForm((f) => ({ ...f, venue: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Image URL</Label>
              <Input
                value={form.image_url}
                onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Document URL</Label>
              <Input
                value={form.document_url}
                onChange={(e) => setForm((f) => ({ ...f, document_url: e.target.value }))}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={3}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Recommendation letter</Label>
              <Textarea
                value={form.recommendation_letter}
                onChange={(e) =>
                  setForm((f) => ({ ...f, recommendation_letter: e.target.value }))
                }
                rows={3}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewing?.title}</DialogTitle>
          </DialogHeader>
          {viewing ? (
            <div className="space-y-3 text-sm">
              <p>
                <span className="text-muted-foreground">Student: </span>
                {viewing.student_name} ({viewing.admission_number})
              </p>
              <p>
                <span className="text-muted-foreground">Type: </span>
                {ACHIEVEMENT_TYPE_LABELS[viewing.achievement_type]}
              </p>
              <p>
                <span className="text-muted-foreground">Status: </span>
                {viewing.status}
                {viewing.is_published ? " · Published" : ""}
              </p>
              {viewing.description ? <p>{viewing.description}</p> : null}
              {viewing.document_url ? (
                <a
                  className="text-primary underline"
                  href={viewing.document_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Supporting document
                </a>
              ) : null}
              <div className="border-t pt-3">
                <p className="mb-2 font-medium">Activity notes</p>
                <div className="mb-2 flex gap-2">
                  <Input
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Add a note…"
                  />
                  <Button type="button" onClick={handleAddNote}>
                    Add
                  </Button>
                </div>
                <ul className="space-y-2">
                  {notes.map((n) => (
                    <li key={n.id} className="rounded-md border bg-muted/30 p-2">
                      <p>{n.note}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {n.author_name} · {new Date(n.created_at).toLocaleString()}
                      </p>
                    </li>
                  ))}
                  {notes.length === 0 ? (
                    <li className="text-muted-foreground">No notes yet.</li>
                  ) : null}
                </ul>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
