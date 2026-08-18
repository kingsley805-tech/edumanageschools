import { useCallback, useEffect, useMemo, useState } from "react";
import { Archive, Eye, HeartPulse, Pencil, Plus, RefreshCw, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { OperationsSchemaSetupCard } from "@/modules/lib/OperationsSchemaSetupCard";
import { ModuleAccessDenied } from "@/modules/lib/ModuleAccessDenied";
import { useModuleAccess } from "@/modules/lib/useModuleAccess";
import { useSchoolInfo } from "@/hooks/useSchoolInfo";
import { useAuth } from "@/contexts/AuthContext";
import { ExportMenu } from "@/modules/lib/ExportMenu";
import { isMissingTableError } from "@/modules/lib/missingSchema";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type StudentOption = {
  id: string;
  name: string;
  admission: string;
  class_name: string;
  gender: string;
};

type HealthRow = {
  id: string;
  student_id: string;
  blood_group: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_relationship: string | null;
  medical_conditions: string | null;
  allergies: string | null;
  current_medication: string | null;
  disabilities: string | null;
  doctor_name: string | null;
  hospital: string | null;
  insurance: string | null;
  vaccination_history: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  vision: string | null;
  hearing: string | null;
  medical_notes: string | null;
  documents_url: string | null;
  health_clearance: boolean;
  critical_alert: boolean;
  health_status: string;
  is_archived: boolean;
  student_name?: string;
  admission_number?: string;
  class_name?: string;
  gender?: string;
};

const emptyForm = {
  class_name: "",
  student_id: "",
  blood_group: "",
  emergency_contact_name: "",
  emergency_contact_phone: "",
  emergency_relationship: "",
  medical_conditions: "",
  allergies: "",
  current_medication: "",
  disabilities: "",
  doctor_name: "",
  hospital: "",
  insurance: "",
  vaccination_history: "",
  height_cm: "",
  weight_kg: "",
  vision: "",
  hearing: "",
  medical_notes: "",
  documents_url: "",
  health_clearance: true,
  critical_alert: false,
  health_status: "clear",
};

function statusBadge(status: string) {
  if (status === "clear" || status === "cleared_for_sports") {
    return <Badge variant="success">{status.replace(/_/g, " ")}</Badge>;
  }
  if (status === "critical") return <Badge variant="destructive">critical</Badge>;
  if (status === "monitor" || status === "restricted") {
    return <Badge variant="warning">{status}</Badge>;
  }
  return <Badge variant="secondary">{status}</Badge>;
}

export default function StudentHealthPage() {
  const { user } = useAuth();
  const { currentSchool } = useSchoolInfo();
  const schoolId = currentSchool?.id ?? null;
  const access = useModuleAccess("student_health");

  const [rows, setRows] = useState<HealthRow[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [schemaMissing, setSchemaMissing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [genderFilter, setGenderFilter] = useState("all");
  const [showArchived, setShowArchived] = useState(false);
  const [open, setOpen] = useState(false);
  const [viewProfile, setViewProfile] = useState<HealthRow | null>(null);
  const [editing, setEditing] = useState<HealthRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [studentPickerSearch, setStudentPickerSearch] = useState("");

  const selectedStudent = useMemo(
    () => students.find((s) => s.id === form.student_id) ?? null,
    [students, form.student_id],
  );

  const classes = useMemo(
    () => [...new Set(students.map((s) => s.class_name).filter(Boolean))].sort(),
    [students],
  );

  const genders = useMemo(
    () => [...new Set(students.map((s) => s.gender).filter(Boolean))].sort(),
    [students],
  );

  const pickerStudents = useMemo(() => {
    const q = studentPickerSearch.trim().toLowerCase();
    return students.filter((s) => {
      if (form.class_name && s.class_name !== form.class_name) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.admission.toLowerCase().includes(q) ||
        s.class_name.toLowerCase().includes(q) ||
        s.gender.toLowerCase().includes(q)
      );
    });
  }, [students, studentPickerSearch, form.class_name]);

  const load = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const [healthRes, studentsRes] = await Promise.all([
        supabase
          .from("student_health_profiles")
          .select(
            "*, students(full_name, admission_number, gender, classes(name))",
          )
          .eq("school_id", schoolId)
          .order("updated_at", { ascending: false }),
        supabase
          .from("students")
          .select("id, full_name, admission_number, gender, classes(name)")
          .eq("school_id", schoolId)
          .order("full_name"),
      ]);

      if (healthRes.error) {
        if (isMissingTableError(healthRes.error)) {
          setSchemaMissing(true);
          setRows([]);
          return;
        }
        throw healthRes.error;
      }
      if (studentsRes.error) throw studentsRes.error;

      setSchemaMissing(false);
      setStudents(
        (studentsRes.data ?? []).map((s) => ({
          id: s.id,
          name: s.full_name ?? "Student",
          admission: s.admission_number ?? "",
          class_name: (s.classes as { name?: string } | null)?.name ?? "",
          gender: s.gender ?? "",
        })),
      );

      setRows(
        (healthRes.data ?? []).map((r) => {
          const st = r.students as {
            full_name?: string;
            admission_number?: string;
            gender?: string;
            classes?: { name?: string } | null;
          } | null;
          return {
            ...(r as HealthRow),
            student_name: st?.full_name ?? "Student",
            admission_number: st?.admission_number ?? "",
            class_name: st?.classes?.name ?? "",
            gender: st?.gender ?? "",
          };
        }),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load health profiles");
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (!showArchived && r.is_archived) return false;
      if (showArchived && !r.is_archived) return false;
      if (classFilter !== "all" && (r.class_name ?? "") !== classFilter) return false;
      if (genderFilter !== "all" && (r.gender ?? "").toLowerCase() !== genderFilter.toLowerCase()) {
        return false;
      }
      if (!q) return true;
      return (
        (r.student_name ?? "").toLowerCase().includes(q) ||
        (r.admission_number ?? "").toLowerCase().includes(q) ||
        (r.class_name ?? "").toLowerCase().includes(q) ||
        (r.gender ?? "").toLowerCase().includes(q) ||
        (r.blood_group ?? "").toLowerCase().includes(q) ||
        (r.allergies ?? "").toLowerCase().includes(q) ||
        (r.health_status ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, search, showArchived, classFilter, genderFilter]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setStudentPickerSearch("");
    setOpen(true);
  };

  const openEdit = (row: HealthRow) => {
    setEditing(row);
    setForm({
      class_name: row.class_name ?? "",
      student_id: row.student_id,
      blood_group: row.blood_group ?? "",
      emergency_contact_name: row.emergency_contact_name ?? "",
      emergency_contact_phone: row.emergency_contact_phone ?? "",
      emergency_relationship: row.emergency_relationship ?? "",
      medical_conditions: row.medical_conditions ?? "",
      allergies: row.allergies ?? "",
      current_medication: row.current_medication ?? "",
      disabilities: row.disabilities ?? "",
      doctor_name: row.doctor_name ?? "",
      hospital: row.hospital ?? "",
      insurance: row.insurance ?? "",
      vaccination_history: row.vaccination_history ?? "",
      height_cm: row.height_cm != null ? String(row.height_cm) : "",
      weight_kg: row.weight_kg != null ? String(row.weight_kg) : "",
      vision: row.vision ?? "",
      hearing: row.hearing ?? "",
      medical_notes: row.medical_notes ?? "",
      documents_url: row.documents_url ?? "",
      health_clearance: row.health_clearance,
      critical_alert: row.critical_alert,
      health_status: row.health_status || "clear",
    });
    setStudentPickerSearch("");
    setOpen(true);
  };

  const handleSave = async () => {
    if (!schoolId) return;
    if (!form.student_id) {
      toast.error("Select a student");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        school_id: schoolId,
        student_id: form.student_id,
        blood_group: form.blood_group || null,
        emergency_contact_name: form.emergency_contact_name || null,
        emergency_contact_phone: form.emergency_contact_phone || null,
        emergency_relationship: form.emergency_relationship || null,
        medical_conditions: form.medical_conditions || null,
        allergies: form.allergies || null,
        current_medication: form.current_medication || null,
        disabilities: form.disabilities || null,
        doctor_name: form.doctor_name || null,
        hospital: form.hospital || null,
        insurance: form.insurance || null,
        vaccination_history: form.vaccination_history || null,
        height_cm: form.height_cm ? Number(form.height_cm) : null,
        weight_kg: form.weight_kg ? Number(form.weight_kg) : null,
        vision: form.vision || null,
        hearing: form.hearing || null,
        medical_notes: form.medical_notes || null,
        documents_url: form.documents_url || null,
        health_clearance: form.health_clearance,
        critical_alert: form.critical_alert,
        health_status: form.health_status,
        updated_at: new Date().toISOString(),
        updated_by: user?.id ?? null,
      };

      if (editing?.id) {
        const { error } = await supabase
          .from("student_health_profiles")
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
        toast.success("Health profile updated");
      } else {
        const { error } = await supabase.from("student_health_profiles").insert({
          ...payload,
          created_by: user?.id ?? null,
        });
        if (error) throw error;
        toast.success("Health profile created");
      }
      setOpen(false);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (row: HealthRow, archived: boolean) => {
    try {
      const { error } = await supabase
        .from("student_health_profiles")
        .update({
          is_archived: archived,
          updated_at: new Date().toISOString(),
          updated_by: user?.id ?? null,
        })
        .eq("id", row.id);
      if (error) throw error;
      toast.success(archived ? "Archived" : "Restored");
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Archive failed");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Permanently delete this health profile?")) return;
    try {
      const { error } = await supabase.from("student_health_profiles").delete().eq("id", id);
      if (error) throw error;
      toast.success("Deleted");
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const exportHeaders = [
    "Name",
    "Admission",
    "Class",
    "Gender",
    "Blood group",
    "Status",
    "Allergies",
    "Emergency contact",
    "Phone",
    "Critical alert",
  ];
  const exportRows = filtered.map((r) => [
    r.student_name,
    r.admission_number,
    r.class_name,
    r.gender,
    r.blood_group,
    r.health_status,
    r.allergies,
    r.emergency_contact_name,
    r.emergency_contact_phone,
    r.critical_alert ? "Yes" : "No",
  ]);

  if (!access.canView) return <ModuleAccessDenied label="Student Health" />;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2 text-primary">
            <HeartPulse className="h-5 w-5" />
            <span className="text-xs font-semibold uppercase tracking-wider">Health</span>
          </div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Student health</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Health profiles, emergencies, allergies, clearance, and critical alerts.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`mr-1.5 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {schemaMissing ? (
        <OperationsSchemaSetupCard moduleLabel="Student Health" quickScript="apply-wave-b-f-modules.sql" />
      ) : (
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Health profiles</CardTitle>
              <CardDescription>{filtered.length} record(s)</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              {access.canExport ? (
                <ExportMenu
                  filename="student-health"
                  title="Student Health"
                  headers={exportHeaders}
                  rows={exportRows}
                />
              ) : null}
              {access.canCreate ? (
                <Button type="button" size="sm" onClick={openCreate}>
                  <Plus className="mr-1.5 h-4 w-4" />
                  New student health
                </Button>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-4">
              <Input
                placeholder="Search name, admission, class, gender…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <Select value={classFilter} onValueChange={setClassFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Class" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All classes</SelectItem>
                  {classes.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={genderFilter} onValueChange={setGenderFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All genders</SelectItem>
                  {genders.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g}
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

            {filtered.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">No health profiles found.</div>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Admission</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead>Gender</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>
                          <div className="font-medium">{row.student_name}</div>
                          {row.critical_alert ? (
                            <span className="text-xs text-destructive">Critical alert</span>
                          ) : null}
                        </TableCell>
                        <TableCell>{row.admission_number || "—"}</TableCell>
                        <TableCell>{row.class_name || "—"}</TableCell>
                        <TableCell className="capitalize">{row.gender || "—"}</TableCell>
                        <TableCell>{statusBadge(row.health_status)}</TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button type="button" size="icon" variant="ghost" onClick={() => setViewProfile(row)} title="View health profile">
                              <Eye className="h-4 w-4" />
                            </Button>
                            {access.canEdit ? (
                              <Button type="button" size="icon" variant="ghost" onClick={() => openEdit(row)} title="Edit">
                                <Pencil className="h-4 w-4" />
                              </Button>
                            ) : null}
                            {access.canEdit ? (
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                onClick={() => handleArchive(row, !row.is_archived)}
                                title={row.is_archived ? "Restore" : "Archive"}
                              >
                                {row.is_archived ? <RotateCcw className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                              </Button>
                            ) : null}
                            {access.canDelete ? (
                              <Button type="button" size="icon" variant="ghost" onClick={() => handleDelete(row.id)} title="Delete">
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
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit student health" : "New student health"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-md border border-border bg-muted/30 p-3 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Student
              </p>
              <div className="space-y-1">
                <Label>Class *</Label>
                <Select
                  value={form.class_name || undefined}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, class_name: v, student_id: "" }))
                  }
                  disabled={Boolean(editing)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select class first" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Search student</Label>
                <Input
                  placeholder="Filter by name or admission number…"
                  value={studentPickerSearch}
                  onChange={(e) => setStudentPickerSearch(e.target.value)}
                  disabled={Boolean(editing) || !form.class_name}
                />
              </div>
              <div className="space-y-1">
                <Label>Select student *</Label>
                <Select
                  value={form.student_id || undefined}
                  onValueChange={(v) => setForm((f) => ({ ...f, student_id: v }))}
                  disabled={Boolean(editing) || !form.class_name}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        form.class_name
                          ? `Choose student (${pickerStudents.length})`
                          : "Select class first"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {pickerStudents.length === 0 ? (
                      <div className="px-2 py-3 text-sm text-muted-foreground">
                        {form.class_name ? "No students match." : "Select a class first."}
                      </div>
                    ) : (
                      pickerStudents.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name} · {s.admission || "—"} · {s.gender || "—"}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {selectedStudent ? (
                <div className="grid gap-2 sm:grid-cols-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Name: </span>
                    <span className="font-medium">{selectedStudent.name}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Admission: </span>
                    <span className="font-medium">{selectedStudent.admission || "—"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Class: </span>
                    <span className="font-medium">{selectedStudent.class_name || "—"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Gender: </span>
                    <span className="font-medium capitalize">{selectedStudent.gender || "—"}</span>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Blood group</Label>
                <Select
                  value={form.blood_group || "none"}
                  onValueChange={(v) => setForm((f) => ({ ...f, blood_group: v === "none" ? "" : v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not set</SelectItem>
                    {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((bg) => (
                      <SelectItem key={bg} value={bg}>
                        {bg}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Health status</Label>
                <Select
                  value={form.health_status}
                  onValueChange={(v) => setForm((f) => ({ ...f, health_status: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="clear">Clear</SelectItem>
                    <SelectItem value="monitor">Monitor</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="cleared_for_sports">Cleared for sports</SelectItem>
                    <SelectItem value="restricted">Restricted</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Emergency contact</Label>
                <Input
                  value={form.emergency_contact_name}
                  onChange={(e) => setForm((f) => ({ ...f, emergency_contact_name: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Emergency phone</Label>
                <Input
                  value={form.emergency_contact_phone}
                  onChange={(e) => setForm((f) => ({ ...f, emergency_contact_phone: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Relationship</Label>
                <Input
                  value={form.emergency_relationship}
                  onChange={(e) => setForm((f) => ({ ...f, emergency_relationship: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Doctor</Label>
                <Input
                  value={form.doctor_name}
                  onChange={(e) => setForm((f) => ({ ...f, doctor_name: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Hospital</Label>
                <Input
                  value={form.hospital}
                  onChange={(e) => setForm((f) => ({ ...f, hospital: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Insurance</Label>
                <Input
                  value={form.insurance}
                  onChange={(e) => setForm((f) => ({ ...f, insurance: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Height (cm)</Label>
                <Input
                  type="number"
                  value={form.height_cm}
                  onChange={(e) => setForm((f) => ({ ...f, height_cm: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Weight (kg)</Label>
                <Input
                  type="number"
                  value={form.weight_kg}
                  onChange={(e) => setForm((f) => ({ ...f, weight_kg: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Vision</Label>
                <Input
                  value={form.vision}
                  onChange={(e) => setForm((f) => ({ ...f, vision: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Hearing</Label>
                <Input
                  value={form.hearing}
                  onChange={(e) => setForm((f) => ({ ...f, hearing: e.target.value }))}
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>Allergies</Label>
                <Textarea
                  rows={2}
                  value={form.allergies}
                  onChange={(e) => setForm((f) => ({ ...f, allergies: e.target.value }))}
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>Medical conditions</Label>
                <Textarea
                  rows={2}
                  value={form.medical_conditions}
                  onChange={(e) => setForm((f) => ({ ...f, medical_conditions: e.target.value }))}
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>Current medication</Label>
                <Textarea
                  rows={2}
                  value={form.current_medication}
                  onChange={(e) => setForm((f) => ({ ...f, current_medication: e.target.value }))}
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>Vaccination history</Label>
                <Textarea
                  rows={2}
                  value={form.vaccination_history}
                  onChange={(e) => setForm((f) => ({ ...f, vaccination_history: e.target.value }))}
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>Medical notes</Label>
                <Textarea
                  rows={2}
                  value={form.medical_notes}
                  onChange={(e) => setForm((f) => ({ ...f, medical_notes: e.target.value }))}
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>Documents URL</Label>
                <Input
                  value={form.documents_url}
                  onChange={(e) => setForm((f) => ({ ...f, documents_url: e.target.value }))}
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.health_clearance}
                  onChange={(e) => setForm((f) => ({ ...f, health_clearance: e.target.checked }))}
                />
                Health clearance
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.critical_alert}
                  onChange={(e) => setForm((f) => ({ ...f, critical_alert: e.target.checked }))}
                />
                Critical alert
              </label>
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

      {/* Health Profile Detail Dialog */}
      <Dialog open={!!viewProfile} onOpenChange={(v) => !v && setViewProfile(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-2 pr-6">
              <span>{viewProfile?.student_name} — Health Record</span>
              <div className="flex gap-1.5">
                {viewProfile?.critical_alert ? (
                  <Badge variant="destructive">Critical Alert</Badge>
                ) : null}
                {viewProfile?.health_status ? statusBadge(viewProfile.health_status) : null}
              </div>
            </DialogTitle>
          </DialogHeader>
          {viewProfile ? (
            <div className="space-y-4 py-2">
              <div className="rounded-lg border bg-muted/20 p-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Student Information
                </p>
                <dl className="grid gap-2 text-sm sm:grid-cols-4">
                  <div>
                    <dt className="text-xs text-muted-foreground">Admission #</dt>
                    <dd className="font-medium">{viewProfile.admission_number || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Class</dt>
                    <dd className="font-medium">{viewProfile.class_name || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Gender</dt>
                    <dd className="font-medium capitalize">{viewProfile.gender || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Blood Group</dt>
                    <dd className="font-semibold text-primary">{viewProfile.blood_group || "Not recorded"}</dd>
                  </div>
                </dl>
              </div>

              <div className="rounded-lg border bg-muted/20 p-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Emergency & Provider Contacts
                </p>
                <dl className="grid gap-2 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="text-xs text-muted-foreground">Emergency Contact</dt>
                    <dd className="font-medium">{viewProfile.emergency_contact_name || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Emergency Phone</dt>
                    <dd className="font-medium">{viewProfile.emergency_contact_phone || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Relationship</dt>
                    <dd className="font-medium">{viewProfile.emergency_relationship || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Doctor Name</dt>
                    <dd className="font-medium">{viewProfile.doctor_name || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Hospital / Clinic</dt>
                    <dd className="font-medium">{viewProfile.hospital || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Insurance</dt>
                    <dd className="font-medium">{viewProfile.insurance || "—"}</dd>
                  </div>
                </dl>
              </div>

              <div className="rounded-lg border bg-muted/20 p-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Physical & Medical Details
                </p>
                <dl className="grid gap-2 text-sm sm:grid-cols-4">
                  <div>
                    <dt className="text-xs text-muted-foreground">Height</dt>
                    <dd className="font-medium">{viewProfile.height_cm ? `${viewProfile.height_cm} cm` : "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Weight</dt>
                    <dd className="font-medium">{viewProfile.weight_kg ? `${viewProfile.weight_kg} kg` : "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Vision</dt>
                    <dd className="font-medium">{viewProfile.vision || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Hearing</dt>
                    <dd className="font-medium">{viewProfile.hearing || "—"}</dd>
                  </div>
                </dl>
              </div>

              {viewProfile.allergies || viewProfile.medical_conditions || viewProfile.current_medication || viewProfile.medical_notes ? (
                <div className="space-y-2.5">
                  {viewProfile.allergies ? (
                    <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2.5">
                      <dt className="text-xs font-semibold text-amber-500">Allergies</dt>
                      <dd className="text-sm mt-0.5">{viewProfile.allergies}</dd>
                    </div>
                  ) : null}
                  {viewProfile.medical_conditions ? (
                    <div className="rounded-md border bg-muted/20 p-2.5">
                      <dt className="text-xs font-semibold text-muted-foreground">Medical Conditions</dt>
                      <dd className="text-sm mt-0.5">{viewProfile.medical_conditions}</dd>
                    </div>
                  ) : null}
                  {viewProfile.current_medication ? (
                    <div className="rounded-md border bg-muted/20 p-2.5">
                      <dt className="text-xs font-semibold text-muted-foreground">Current Medication</dt>
                      <dd className="text-sm mt-0.5">{viewProfile.current_medication}</dd>
                    </div>
                  ) : null}
                  {viewProfile.medical_notes ? (
                    <div className="rounded-md border bg-muted/20 p-2.5">
                      <dt className="text-xs font-semibold text-muted-foreground">Doctor / Nurse Notes</dt>
                      <dd className="text-sm mt-0.5">{viewProfile.medical_notes}</dd>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button type="button" variant="outline" onClick={() => setViewProfile(null)}>
                  Close
                </Button>
                {access.canEdit ? (
                  <Button
                    type="button"
                    onClick={() => {
                      const p = viewProfile;
                      setViewProfile(null);
                      openEdit(p);
                    }}
                  >
                    Edit Record
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
