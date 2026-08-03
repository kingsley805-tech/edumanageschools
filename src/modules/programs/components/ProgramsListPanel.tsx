import { useMemo, useState } from "react";
import { Archive, Eye, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
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
import { archiveProgram, deleteProgram, saveProgram } from "@/modules/programs/lib/api";
import type { AcademicProgram, ProgramStatus } from "@/modules/programs/lib/types";
import { toast } from "sonner";

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
      status: row.status,
    });
    setOpen(true);
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
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Archive failed");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Permanently delete this program?")) return;
    try {
      await deleteProgram(id);
      toast.success("Deleted");
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const exportCsv = () => {
    downloadCsv(
      "academic-programs.csv",
      ["Name", "Code", "Department", "Faculty", "Level", "Credits", "Duration", "Coordinator", "Status"],
      filtered.map((p) => [
        p.name,
        p.code,
        p.department,
        p.faculty,
        p.level,
        p.credits,
        p.duration_years,
        p.coordinator_name,
        p.status,
      ]),
    );
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Academic programs</CardTitle>
            <CardDescription>Program tracks, departments, credits, and coordinators</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            {access.canExport ? (
              <Button type="button" variant="outline" size="sm" onClick={exportCsv}>
                Export CSV
              </Button>
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
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
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
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Program</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Level</TableHead>
                    <TableHead>Credits</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <div className="font-medium">{row.name}</div>
                        <div className="text-xs text-muted-foreground">{row.code}</div>
                      </TableCell>
                      <TableCell>
                        <div>{row.department ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">{row.faculty ?? ""}</div>
                      </TableCell>
                      <TableCell>{row.level ?? "—"}</TableCell>
                      <TableCell>{row.credits ?? "—"}</TableCell>
                      <TableCell>
                        {row.status === "active" ? (
                          <Badge variant="success">Active</Badge>
                        ) : (
                          <Badge variant="secondary">{row.status}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button type="button" size="icon" variant="ghost" onClick={() => setViewing(row)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          {access.canEdit ? (
                            <Button type="button" size="icon" variant="ghost" onClick={() => openEdit(row)}>
                              <Pencil className="h-4 w-4" />
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
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as ProgramStatus }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
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
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="button" onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{viewing?.name}</DialogTitle>
          </DialogHeader>
          {viewing ? (
            <div className="space-y-2 text-sm">
              <p><span className="text-muted-foreground">Code: </span>{viewing.code}</p>
              <p><span className="text-muted-foreground">Department: </span>{viewing.department ?? "—"}</p>
              <p><span className="text-muted-foreground">Faculty: </span>{viewing.faculty ?? "—"}</p>
              <p><span className="text-muted-foreground">Coordinator: </span>{viewing.coordinator_name ?? "—"}</p>
              <p><span className="text-muted-foreground">Subjects: </span>{(viewing.subjects ?? []).join(", ") || "—"}</p>
              {viewing.description ? <p>{viewing.description}</p> : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
