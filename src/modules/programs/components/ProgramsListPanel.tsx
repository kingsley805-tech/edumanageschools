import { useMemo, useState } from "react";
import { Archive, BookMarked, Eye, EyeOff, ImagePlus, Pencil, Plus, Power, RotateCcw, Trash2, UserPlus, Video, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ExportMenu } from "@/modules/lib/ExportMenu";
import { archiveProgram, deleteProgram, saveProgram, setProgramEnabled } from "@/modules/programs/lib/api";
import { uploadProgramMedia, isVideoUrl } from "@/modules/programs/lib/uploadProgramMedia";
import { ProgramEnrollmentPanel } from "@/modules/programs/components/ProgramEnrollmentPanel";
import type { AcademicProgram, ProgramStatus } from "@/modules/programs/lib/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Access = {
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canExport: boolean;
};

type Props = {
  programs: AcademicProgram[];
  access: Access;
  schoolId: string | null;
  userId: string | null;
  onRefresh: () => void;
};

const emptyForm = {
  name: "",
  code: "",
  department: "",
  faculty: "",
  description: "",
  duration_years: "",
  credits: "",
  level: "",
  semester_structure: "",
  coordinator_name: "",
  subjects: "",
  image_url: "",
  video_url: "",
  gallery_urls: [] as string[],
  status: "active" as ProgramStatus,
};

export function ProgramsListPanel({ programs, access, schoolId, userId, onRefresh }: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showArchived, setShowArchived] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AcademicProgram | null>(null);
  const [viewing, setViewing] = useState<AcademicProgram | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<"cover" | "video" | "gallery" | null>(null);
  const [galleryUrlInput, setGalleryUrlInput] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return programs.filter((p) => {
      if (!showArchived && p.is_archived) return false;
      if (showArchived && !p.is_archived) return false;
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        (p.department ?? "").toLowerCase().includes(q) ||
        (p.faculty ?? "").toLowerCase().includes(q)
      );
    });
  }, [programs, search, statusFilter, showArchived]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setGalleryUrlInput("");
    setOpen(true);
  };

  const openEdit = (row: AcademicProgram) => {
    setEditing(row);
    setForm({
      name: row.name,
      code: row.code,
      department: row.department ?? "",
      faculty: row.faculty ?? "",
      description: row.description ?? "",
      duration_years: row.duration_years != null ? String(row.duration_years) : "",
      credits: row.credits != null ? String(row.credits) : "",
      level: row.level ?? "",
      semester_structure: row.semester_structure ?? "",
      coordinator_name: row.coordinator_name ?? "",
      subjects: (row.subjects ?? []).join(", "),
      image_url: row.image_url ?? "",
      video_url: row.video_url ?? "",
      gallery_urls: row.gallery_urls ?? [],
      status: row.status,
    });
    setGalleryUrlInput("");
    setOpen(true);
  };

  const addGalleryUrl = () => {
    const next = galleryUrlInput.trim();
    if (!next) return;
    setForm((f) => ({
      ...f,
      gallery_urls: f.gallery_urls.includes(next) ? f.gallery_urls : [...f.gallery_urls, next],
    }));
    setGalleryUrlInput("");
  };

  const handleMediaUpload = async (file: File, target: "cover" | "video" | "gallery") => {
    if (!schoolId) return;
    setUploading(target);
    try {
      const url = await uploadProgramMedia({
        schoolId,
        file,
        programId: editing?.id,
        kind: target === "video" ? "video" : "image",
      });
      if (target === "cover") {
        setForm((f) => ({ ...f, image_url: url }));
      } else if (target === "video") {
        setForm((f) => ({ ...f, video_url: url }));
      } else {
        setForm((f) => ({ ...f, gallery_urls: [...f.gallery_urls, url] }));
      }
      toast.success(target === "video" ? "Video uploaded" : "Image uploaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(null);
    }
  };

  const handleSave = async () => {
    if (!schoolId) return;
    if (!form.name.trim() || !form.code.trim()) {
      toast.error("Name and code are required.");
      return;
    }
    setSaving(true);
    try {
      await saveProgram(
        schoolId,
        {
          name: form.name,
          code: form.code,
          department: form.department || null,
          faculty: form.faculty || null,
          description: form.description || null,
          duration_years: form.duration_years ? Number(form.duration_years) : null,
          credits: form.credits ? Number(form.credits) : null,
          level: form.level || null,
          semester_structure: form.semester_structure || null,
          coordinator_name: form.coordinator_name || null,
          subjects: form.subjects
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          image_url: form.image_url.trim() || null,
          video_url: form.video_url.trim() || null,
          gallery_urls: form.gallery_urls,
          status: form.status,
        },
        editing?.id,
        userId,
      );
      toast.success(editing ? "Program updated" : "Program created");
      setOpen(false);
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (row: AcademicProgram, archived: boolean) => {
    try {
      await archiveProgram(row.id, archived, userId);
      toast.success(archived ? "Archived" : "Restored");
      setViewing(null);
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Archive failed");
    }
  };

  const handleToggleEnabled = async (row: AcademicProgram) => {
    const enable = row.status !== "active";
    try {
      await setProgramEnabled(row.id, enable, userId);
      toast.success(enable ? "Program enabled on portals" : "Program disabled on portals");
      setViewing((prev) =>
        prev?.id === row.id
          ? { ...prev, status: enable ? "active" : "inactive", is_archived: false }
          : prev,
      );
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update program");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Permanently delete this program?")) return;
    try {
      await deleteProgram(id);
      toast.success("Deleted");
      setViewing(null);
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const exportHeaders = [
    "Name",
    "Code",
    "Department",
    "Faculty",
    "Level",
    "Credits",
    "Duration",
    "Coordinator",
    "Status",
  ];
  const exportRows = filtered.map((p) => [
    p.name,
    p.code,
    p.department,
    p.faculty,
    p.level,
    p.credits,
    p.duration_years,
    p.coordinator_name,
    p.status,
  ]);

  return (
    <div className="space-y-4">
      <Card className="kt-card border border-border/60 shadow-sm dark:border-white/10">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Academic programs</CardTitle>
            <CardDescription>
              Click a program to view details, enroll students, or enroll a class for a teacher.{" "}
              {filtered.length} shown.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            {access.canExport ? (
              <ExportMenu
                filename="academic-programs"
                title="Academic programs"
                headers={exportHeaders}
                rows={exportRows}
              />
            ) : null}
            {access.canCreate ? (
              <Button type="button" size="sm" onClick={openCreate}>
                <Plus className="mr-1.5 h-4 w-4" />
                Add program
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <Input
              placeholder="Search name, code, department…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Enabled</SelectItem>
                <SelectItem value="inactive">Disabled</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
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

          {filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No programs match your filters.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((row) => (
                <Card
                  key={row.id}
                  role="button"
                  tabIndex={0}
                  className={cn(
                    "group cursor-pointer overflow-hidden transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    "kt-card channel-stats-bg border border-border/60 dark:border-white/10",
                    "shadow-sm hover:shadow-md hover:border-primary/40",
                  )}
                  onClick={() => setViewing(row)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setViewing(row);
                    }
                  }}
                >
                  <div className="relative aspect-[16/10] overflow-hidden bg-muted">
                    {row.image_url ? (
                      <img
                        src={row.image_url}
                        alt={row.name}
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-muted-foreground">
                        <BookMarked className="h-10 w-10 opacity-40" />
                      </div>
                    )}
                    <div className="absolute left-2 top-2 flex flex-wrap gap-1">
                      {row.status === "active" ? (
                        <Badge variant="success" className="bg-background/95">
                          Enabled
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-background/95">
                          {row.status === "inactive" ? "Disabled" : row.status}
                        </Badge>
                      )}
                    </div>
                    {access.canEdit && !row.is_archived ? (
                      <Button
                        type="button"
                        size="icon"
                        variant="secondary"
                        className="absolute right-2 top-2 h-8 w-8 bg-background/95 shadow-sm"
                        title={row.status === "active" ? "Disable on portals" : "Enable on portals"}
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleToggleEnabled(row);
                        }}
                      >
                        {row.status === "active" ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Power className="h-4 w-4" />
                        )}
                      </Button>
                    ) : null}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition group-hover:bg-black/25 group-hover:opacity-100">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-background/95 px-3 py-1.5 text-xs font-medium shadow-sm">
                        <Eye className="h-3.5 w-3.5" />
                        View details
                      </span>
                    </div>
                  </div>
                  <CardContent className="space-y-2 p-4">
                    <div>
                      <p className="truncate font-semibold leading-tight group-hover:text-primary">
                        {row.name}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {row.code}
                        {row.department ? ` · ${row.department}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      {row.level ? <span>{row.level}</span> : null}
                      {row.credits != null ? <span>{row.credits} credits</span> : null}
                      {row.duration_years != null ? <span>{row.duration_years} yrs</span> : null}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit program" : "New program"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Name *</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Code *</Label>
              <Input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Department</Label>
              <Input value={form.department} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Faculty</Label>
              <Input value={form.faculty} onChange={(e) => setForm((f) => ({ ...f, faculty: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Level</Label>
              <Input value={form.level} onChange={(e) => setForm((f) => ({ ...f, level: e.target.value }))} placeholder="Certificate / Diploma / Degree" />
            </div>
            <div className="space-y-1">
              <Label>Portal visibility</Label>
              <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as ProgramStatus }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Enabled (show on portals)</SelectItem>
                  <SelectItem value="inactive">Disabled (hide on portals)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Duration (years)</Label>
              <Input type="number" step="0.5" value={form.duration_years} onChange={(e) => setForm((f) => ({ ...f, duration_years: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Credits</Label>
              <Input type="number" value={form.credits} onChange={(e) => setForm((f) => ({ ...f, credits: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Semester structure</Label>
              <Input value={form.semester_structure} onChange={(e) => setForm((f) => ({ ...f, semester_structure: e.target.value }))} placeholder="2 semesters / year" />
            </div>
            <div className="space-y-1">
              <Label>Coordinator</Label>
              <Input value={form.coordinator_name} onChange={(e) => setForm((f) => ({ ...f, coordinator_name: e.target.value }))} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Subjects (comma-separated)</Label>
              <Input value={form.subjects} onChange={(e) => setForm((f) => ({ ...f, subjects: e.target.value }))} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Description</Label>
              <Textarea rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>

            <div className="space-y-2 sm:col-span-2 rounded-lg border p-3">
              <Label className="flex items-center gap-2">
                <ImagePlus className="h-4 w-4" />
                Cover image
              </Label>
              {form.image_url ? (
                <div className="relative aspect-video max-w-xs overflow-hidden rounded-lg border bg-muted">
                  <img src={form.image_url} alt="" className="h-full w-full object-cover" />
                </div>
              ) : null}
              <Input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                disabled={uploading === "cover"}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleMediaUpload(file, "cover");
                  e.target.value = "";
                }}
              />
              <Input
                type="url"
                placeholder="Or paste image URL"
                value={form.image_url}
                onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))}
              />
            </div>

            <div className="space-y-2 sm:col-span-2 rounded-lg border p-3">
              <Label className="flex items-center gap-2">
                <Video className="h-4 w-4" />
                Promo video
              </Label>
              {form.video_url ? (
                <div className="max-w-md overflow-hidden rounded-lg border bg-black">
                  {isVideoUrl(form.video_url) ? (
                    <video src={form.video_url} controls className="max-h-48 w-full" />
                  ) : (
                    <a href={form.video_url} target="_blank" rel="noreferrer" className="block p-3 text-sm text-primary underline">
                      Open video link
                    </a>
                  )}
                </div>
              ) : null}
              <Input
                type="file"
                accept="video/mp4,video/webm,video/quicktime,video/x-msvideo"
                disabled={uploading === "video"}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleMediaUpload(file, "video");
                  e.target.value = "";
                }}
              />
              <Input
                type="url"
                placeholder="Or paste video URL (YouTube, Vimeo, MP4…)"
                value={form.video_url}
                onChange={(e) => setForm((f) => ({ ...f, video_url: e.target.value }))}
              />
            </div>

            <div className="space-y-2 sm:col-span-2 rounded-lg border p-3">
              <Label>Gallery images</Label>
              {form.gallery_urls.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {form.gallery_urls.map((url) => (
                    <div key={url} className="relative">
                      <img src={url} alt="" className="h-16 w-16 rounded-md border object-cover" />
                      <button
                        type="button"
                        className="absolute -right-1 -top-1 rounded-full bg-destructive p-0.5 text-destructive-foreground"
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            gallery_urls: f.gallery_urls.filter((u) => u !== url),
                          }))
                        }
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
              <Input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                disabled={uploading === "gallery"}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleMediaUpload(file, "gallery");
                  e.target.value = "";
                }}
              />
              <div className="flex gap-2">
                <Input
                  type="url"
                  placeholder="Or paste gallery image URL"
                  value={galleryUrlInput}
                  onChange={(e) => setGalleryUrlInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addGalleryUrl();
                    }
                  }}
                />
                <Button type="button" variant="outline" onClick={addGalleryUrl}>
                  Add URL
                </Button>
              </div>
              {uploading === "gallery" ? (
                <p className="text-xs text-muted-foreground">Uploading gallery image…</p>
              ) : null}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="button" onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Sheet open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <SheetContent className="flex w-full flex-col overflow-y-auto sm:max-w-lg">
          {viewing ? (
            <>
              <SheetHeader>
                <SheetTitle>{viewing.name}</SheetTitle>
                <SheetDescription>
                  {viewing.code}
                  {viewing.department ? ` · ${viewing.department}` : ""}
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-4 py-4 text-sm">
                <div className="overflow-hidden rounded-xl border bg-muted">
                  {viewing.image_url ? (
                    <img
                      src={viewing.image_url}
                      alt={viewing.name}
                      className="aspect-video w-full object-cover"
                    />
                  ) : (
                    <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 text-muted-foreground">
                      <BookMarked className="h-8 w-8 opacity-40" />
                      <span className="text-xs">No cover image</span>
                    </div>
                  )}
                </div>

                {viewing.video_url ? (
                  <div className="overflow-hidden rounded-lg border bg-black">
                    {isVideoUrl(viewing.video_url) ? (
                      <video src={viewing.video_url} controls className="max-h-64 w-full" />
                    ) : (
                      <a
                        href={viewing.video_url}
                        target="_blank"
                        rel="noreferrer"
                        className="block p-3 text-primary underline"
                      >
                        Watch video
                      </a>
                    )}
                  </div>
                ) : null}

                {viewing.gallery_urls?.length ? (
                  <div className="flex flex-wrap gap-2">
                    {viewing.gallery_urls.map((url) => (
                      <img
                        key={url}
                        src={url}
                        alt=""
                        className="h-20 w-20 rounded-md border object-cover"
                      />
                    ))}
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  {viewing.status === "active" ? (
                    <Badge variant="success">Enabled on portals</Badge>
                  ) : (
                    <Badge variant="secondary">
                      {viewing.status === "inactive" ? "Disabled on portals" : viewing.status}
                    </Badge>
                  )}
                  {viewing.level ? <Badge variant="outline">{viewing.level}</Badge> : null}
                </div>

                <dl className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/30 p-3">
                  <div>
                    <dt className="text-xs text-muted-foreground">Faculty</dt>
                    <dd className="font-medium">{viewing.faculty ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Coordinator</dt>
                    <dd className="font-medium">{viewing.coordinator_name ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Credits</dt>
                    <dd className="font-medium">{viewing.credits ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Duration</dt>
                    <dd className="font-medium">
                      {viewing.duration_years != null ? `${viewing.duration_years} years` : "—"}
                    </dd>
                  </div>
                </dl>

                <div>
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Subjects
                  </p>
                  <p>{(viewing.subjects ?? []).join(", ") || "—"}</p>
                </div>

                {viewing.description ? (
                  <div>
                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Description
                    </p>
                    <p className="whitespace-pre-wrap leading-relaxed text-foreground/90">
                      {viewing.description}
                    </p>
                  </div>
                ) : null}

                {schoolId ? (
                  <ProgramEnrollmentPanel
                    schoolId={schoolId}
                    programId={viewing.id}
                    programName={viewing.name}
                    userId={userId}
                    canEdit={access.canEdit || access.canCreate}
                  />
                ) : null}
              </div>

              <SheetFooter className="mt-auto gap-2 border-t pt-4 sm:flex-col">
                {access.canEdit || access.canCreate ? (
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1">
                    <UserPlus className="h-3.5 w-3.5" />
                    Use Enroll student / Enroll class for teacher above to manage assignments.
                  </p>
                ) : null}
                {access.canEdit && !viewing.is_archived ? (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => void handleToggleEnabled(viewing)}
                  >
                    {viewing.status === "active" ? (
                      <>
                        <EyeOff className="mr-2 h-4 w-4" />
                        Disable on portals
                      </>
                    ) : (
                      <>
                        <Power className="mr-2 h-4 w-4" />
                        Enable on portals
                      </>
                    )}
                  </Button>
                ) : null}
                {access.canEdit ? (
                  <Button
                    className="w-full"
                    onClick={() => {
                      openEdit(viewing);
                      setViewing(null);
                    }}
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit program
                  </Button>
                ) : null}
                {access.canEdit ? (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => void handleArchive(viewing, !viewing.is_archived)}
                  >
                    {viewing.is_archived ? (
                      <>
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Restore
                      </>
                    ) : (
                      <>
                        <Archive className="mr-2 h-4 w-4" />
                        Archive
                      </>
                    )}
                  </Button>
                ) : null}
                {access.canDelete ? (
                  <Button
                    variant="outline"
                    className="w-full text-destructive hover:text-destructive"
                    onClick={() => void handleDelete(viewing.id)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                ) : null}
              </SheetFooter>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
