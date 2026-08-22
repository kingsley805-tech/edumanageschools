import { useCallback, useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useSchoolInfo } from "@/hooks/useSchoolInfo";
import { supabase } from "@/integrations/supabase/client";
import { fetchStudentsWithLinkedProfiles, formatStudentDisplayName } from "@/billing/lib/studentDisplayName";
import { sendWeeklyAttentionWhatsApp } from "@/lib/whatsapp";
import { Loader2, MessageCircle, Plus, RefreshCw, Send } from "lucide-react";

type Role = "admin" | "teacher";

type AttentionRow = {
  id: string;
  student_id: string;
  class_id: string | null;
  week_start: string;
  week_end: string;
  attention_summary: string;
  academic_notes: string | null;
  behavioural_notes: string | null;
  recommendations: string | null;
  status: string;
  sent_via_whatsapp_at: string | null;
  students?: { first_name?: string; last_name?: string; student_id?: string; full_name?: string } | null;
  classes?: { name?: string; stream?: string | null } | null;
};

function startOfWeek(d = new Date()): string {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  return monday.toISOString().slice(0, 10);
}

function endOfWeek(weekStart: string): string {
  const d = new Date(`${weekStart}T12:00:00`);
  d.setDate(d.getDate() + 4);
  return d.toISOString().slice(0, 10);
}

function weekLabel(start: string, end: string): string {
  const fmt = (s: string) =>
    new Date(`${s}T12:00:00`).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  return `${fmt(start)} – ${fmt(end)}`;
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    draft: "bg-muted text-muted-foreground",
    submitted: "bg-blue-500/10 text-blue-700 border-blue-500/30",
    sent: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
    failed: "bg-rose-500/10 text-rose-700 border-rose-500/30",
  };
  return (
    <Badge variant="outline" className={`capitalize text-xs ${map[status] ?? ""}`}>
      {status}
    </Badge>
  );
}

export default function WeeklyAttentionPage({ role }: { role: Role }) {
  const { user } = useAuth();
  const { currentSchool } = useSchoolInfo();
  const schoolId = currentSchool?.id ?? null;

  const [classes, setClasses] = useState<{ id: string; name: string; stream: string | null }[]>([]);
  const [students, setStudents] = useState<
    { id: string; name: string; student_id: string; class_id: string | null }[]
  >([]);
  const [rows, setRows] = useState<AttentionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [classFilter, setClassFilter] = useState("all");
  const [weekStart, setWeekStart] = useState(startOfWeek());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const [formStudentId, setFormStudentId] = useState("");
  const [formClassId, setFormClassId] = useState("");
  const [formSummary, setFormSummary] = useState("");
  const [formAcademic, setFormAcademic] = useState("");
  const [formBehaviour, setFormBehaviour] = useState("");
  const [formRecommendations, setFormRecommendations] = useState("");

  const loadMeta = useCallback(async () => {
    if (!schoolId || !user) return;
    const [studentRows, classesResult] = await Promise.all([
      fetchStudentsWithLinkedProfiles(schoolId),
      supabase
        .from("classes")
        .select("id, name, stream, level")
        .eq("school_id", schoolId)
        .neq("is_active", false)
        .order("level", { ascending: true })
        .order("name", { ascending: true }),
    ]);
    if (classesResult.error) throw classesResult.error;
    setClasses(
      (classesResult.data || []).map((c) => ({
        id: c.id,
        name: c.name,
        stream: c.stream,
      })),
    );
    setStudents(
      studentRows
        .filter((s) => s.is_active !== false)
        .map((s) => ({
          id: s.id as string,
          student_id: s.student_id as string,
          class_id: (s.class_id as string | null) ?? null,
          name: formatStudentDisplayName(
            {
              first_name: s.first_name as string,
              last_name: s.last_name as string,
              student_id: s.student_id as string,
            },
            s.linkedProfile ?? null,
          ),
        })),
    );
  }, [schoolId, user]);

  const loadRows = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      let q = supabase
        .from("weekly_attention_reports")
        .select(
          "id, student_id, class_id, week_start, week_end, attention_summary, academic_notes, behavioural_notes, recommendations, status, sent_via_whatsapp_at, students(first_name, last_name, student_id, full_name), classes(name, stream)",
        )
        .eq("school_id", schoolId)
        .eq("week_start", weekStart)
        .order("created_at", { ascending: false });

      if (classFilter !== "all") q = q.eq("class_id", classFilter);

      const { data, error } = await q;
      if (error) {
        if (/does not exist|schema cache/i.test(error.message)) {
          setRows([]);
          toast.error("Weekly attention table is missing. Apply the latest database migration.");
          return;
        }
        throw error;
      }
      setRows((data as AttentionRow[]) || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load reports");
    } finally {
      setLoading(false);
    }
  }, [schoolId, weekStart, classFilter]);

  useEffect(() => {
    void loadMeta().catch((err) =>
      toast.error(err instanceof Error ? err.message : "Failed to load students"),
    );
  }, [loadMeta]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const filteredStudents = useMemo(() => {
    if (!formClassId) return students;
    return students.filter((s) => s.class_id === formClassId);
  }, [students, formClassId]);

  const resetForm = () => {
    setFormStudentId("");
    setFormClassId(classFilter !== "all" ? classFilter : "");
    setFormSummary("");
    setFormAcademic("");
    setFormBehaviour("");
    setFormRecommendations("");
  };

  const handleSave = async (andSend: boolean) => {
    if (!schoolId || !user || !formStudentId || !formSummary.trim()) {
      toast.error("Student and attention summary are required");
      return;
    }
    setSaving(true);
    try {
      const student = students.find((s) => s.id === formStudentId);
      const classId = formClassId || student?.class_id || null;
      const payload = {
        school_id: schoolId,
        student_id: formStudentId,
        class_id: classId,
        teacher_id: user.id,
        week_start: weekStart,
        week_end: endOfWeek(weekStart),
        attention_summary: formSummary.trim(),
        academic_notes: formAcademic.trim() || null,
        behavioural_notes: formBehaviour.trim() || null,
        recommendations: formRecommendations.trim() || null,
        status: andSend ? "submitted" : "draft",
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("weekly_attention_reports")
        .upsert(payload, { onConflict: "school_id,student_id,week_start" })
        .select("id")
        .single();

      if (error) throw error;

      if (andSend && data?.id) {
        const result = await sendWeeklyAttentionWhatsApp({
          schoolId,
          studentId: formStudentId,
          studentName: student?.name || "Student",
          className: classes.find((c) => c.id === classId)?.name,
          teacherName: user.user_metadata?.full_name || user.email || "Teacher",
          weekLabel: weekLabel(weekStart, endOfWeek(weekStart)),
          attentionSummary: formSummary.trim(),
          academicNotes: formAcademic.trim() || null,
          behaviouralNotes: formBehaviour.trim() || null,
          recommendations: formRecommendations.trim() || null,
          reportId: data.id,
          createdBy: user.id,
          force: true,
        });

        if (result.errors.length && result.queued === 0) {
          await supabase
            .from("weekly_attention_reports")
            .update({ status: "failed", updated_at: new Date().toISOString() })
            .eq("id", data.id);
          toast.error(result.errors[0]);
        } else {
          await supabase
            .from("weekly_attention_reports")
            .update({
              status: "sent",
              sent_via_whatsapp_at: new Date().toISOString(),
              sent_by: user.id,
              whatsapp_delivery_id: result.deliveryIds[0] ?? null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", data.id);
          toast.success(
            result.queued > 0
              ? `Saved and sent to ${result.queued} parent contact(s)`
              : "Saved (WhatsApp skipped — check settings)",
          );
        }
      } else {
        toast.success("Weekly attention saved");
      }

      setDialogOpen(false);
      resetForm();
      await loadRows();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleSendExisting = async (row: AttentionRow) => {
    if (!schoolId || !user) return;
    setSendingId(row.id);
    try {
      const name =
        row.students?.full_name ||
        [row.students?.first_name, row.students?.last_name].filter(Boolean).join(" ") ||
        "Student";
      const className = row.classes?.name
        ? `${row.classes.name}${row.classes.stream ? ` (${row.classes.stream})` : ""}`
        : null;

      const result = await sendWeeklyAttentionWhatsApp({
        schoolId,
        studentId: row.student_id,
        studentName: name,
        className,
        teacherName: user.user_metadata?.full_name || user.email || "Teacher",
        weekLabel: weekLabel(row.week_start, row.week_end),
        attentionSummary: row.attention_summary,
        academicNotes: row.academic_notes,
        behaviouralNotes: row.behavioural_notes,
        recommendations: row.recommendations,
        reportId: row.id,
        createdBy: user.id,
        force: true,
      });

      if (result.errors.length && result.queued === 0) {
        await supabase
          .from("weekly_attention_reports")
          .update({ status: "failed", updated_at: new Date().toISOString() })
          .eq("id", row.id);
        toast.error(result.errors[0]);
      } else {
        await supabase
          .from("weekly_attention_reports")
          .update({
            status: "sent",
            sent_via_whatsapp_at: new Date().toISOString(),
            sent_by: user.id,
            whatsapp_delivery_id: result.deliveryIds[0] ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id);
        toast.success(`Sent to ${result.queued} parent contact(s)`);
      }
      await loadRows();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Send failed");
    } finally {
      setSendingId(null);
    }
  };

  return (
    <DashboardLayout role={role}>
      <div className="flex flex-wrap items-center lg:items-end justify-between gap-5 pb-7.5">
        <div className="flex min-w-0 flex-col justify-center gap-2">
          <h1 className="text-xl font-medium leading-none text-mono">Weekly Student Attention</h1>
          <p className="text-sm text-secondary-foreground">
            Record weekly observations and send them to linked parent WhatsApp contacts
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button variant="outline" size="sm" onClick={() => void loadRows()}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
          <Button
            onClick={() => {
              resetForm();
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1" />
            New report
          </Button>
        </div>
      </div>

      <Card className="mb-6">
        <CardContent className="flex flex-wrap gap-3 pt-6">
          <div className="space-y-1">
            <Label className="text-xs">Week starting (Monday)</Label>
            <Input
              type="date"
              value={weekStart}
              onChange={(e) => setWeekStart(e.target.value)}
              className="w-[180px]"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Class</Label>
            <Select value={classFilter} onValueChange={setClassFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All classes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All classes</SelectItem>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                    {c.stream ? ` (${c.stream})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end text-sm text-muted-foreground pb-2">
            {weekLabel(weekStart, endOfWeek(weekStart))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reports this week</CardTitle>
          <CardDescription>
            Parents receive a professionally formatted WhatsApp message with the linked contact number — no manual phone
            entry required.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-10 text-center">
              No weekly attention reports for this week yet.
            </p>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Summary</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => {
                    const name =
                      row.students?.full_name ||
                      [row.students?.first_name, row.students?.last_name].filter(Boolean).join(" ") ||
                      "Student";
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium text-sm">{name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {row.classes?.name || "—"}
                        </TableCell>
                        <TableCell className="text-sm max-w-[280px] truncate">
                          {row.attention_summary}
                        </TableCell>
                        <TableCell>{statusBadge(row.status)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={sendingId === row.id}
                            onClick={() => void handleSendExisting(row)}
                          >
                            {sendingId === row.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <>
                                <MessageCircle className="h-3.5 w-3.5 mr-1" />
                                {row.status === "sent" ? "Resend" : "Send WhatsApp"}
                              </>
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Weekly attention report</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Class</Label>
              <Select value={formClassId} onValueChange={setFormClassId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select class..." />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                      {c.stream ? ` (${c.stream})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Student</Label>
              <Select value={formStudentId} onValueChange={setFormStudentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select student..." />
                </SelectTrigger>
                <SelectContent>
                  {filteredStudents.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} ({s.student_id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Attention / observation *</Label>
              <Textarea
                rows={3}
                value={formSummary}
                onChange={(e) => setFormSummary(e.target.value)}
                placeholder="How did the student engage this week?"
              />
            </div>
            <div className="space-y-2">
              <Label>Academic notes</Label>
              <Textarea rows={2} value={formAcademic} onChange={(e) => setFormAcademic(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Behavioural notes</Label>
              <Textarea rows={2} value={formBehaviour} onChange={(e) => setFormBehaviour(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Recommendations</Label>
              <Textarea
                rows={2}
                value={formRecommendations}
                onChange={(e) => setFormRecommendations(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="secondary" disabled={saving} onClick={() => void handleSave(false)}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save draft"}
            </Button>
            <Button disabled={saving} onClick={() => void handleSave(true)}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
              Save & send WhatsApp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
