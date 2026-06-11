// @ts-nocheck
import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, BookOpen, CalendarDays, ClipboardList, FileText, MessageCircle, Users } from "lucide-react";
import { Link } from "react-router-dom";

type ClassRow = { id: string; name: string; level: string | null };
type OverviewRow = {
  student_id: string;
  full_name: string;
  admission_no: string | null;
  attendance_percent: number;
  present_days: number;
  total_days: number;
  average_score: number;
  failing_subjects: number;
  alert_low_attendance: boolean;
  alert_low_performance: boolean;
};
type Recommendation = {
  id: string;
  student_id: string;
  recommendation_type: string;
  suggestions: string;
  threshold_alert: boolean;
  created_at: string;
};
type ReportCard = {
  id: string;
  student_id: string;
  student_name: string | null;
  status: string;
  term_label: string | null;
  academic_year: string | null;
  submitted_at: string | null;
  approved_at: string | null;
};

const TeacherMyClass = () => {
  const { toast } = useToast();
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [classId, setClassId] = useState<string>("");
  const [overview, setOverview] = useState<OverviewRow[]>([]);
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [cards, setCards] = useState<ReportCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [recDialog, setRecDialog] = useState<{ open: boolean; student?: OverviewRow }>({ open: false });
  const [recForm, setRecForm] = useState({
    recommendation_type: "general",
    strengths: "",
    weaknesses: "",
    suggestions: "",
    threshold_alert: false,
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data: t } = await supabase.from("teachers").select("id").eq("user_id", u.user.id).maybeSingle();
      if (!t?.id) return;
      const { data: cls } = await supabase
        .from("classes")
        .select("id, name, level")
        .eq("class_teacher_id", t.id)
        .order("name");
      setClasses(cls ?? []);
      if (cls?.length) setClassId(cls[0].id);
    })();
  }, []);

  useEffect(() => {
    if (!classId) return;
    loadAll(classId);
  }, [classId]);

  const loadAll = async (cid: string) => {
    setLoading(true);
    const [{ data: ov, error: ovErr }, { data: cardsData }] = await Promise.all([
      supabase.rpc("class_teacher_student_overview", { p_class_id: cid }),
      supabase
        .from("term_report_cards")
        .select("id, student_id, student_name, status, term_label, academic_year, submitted_at, approved_at")
        .eq("class_id", cid)
        .order("updated_at", { ascending: false }),
    ]);
    if (ovErr) toast({ title: "Could not load class overview", description: ovErr.message, variant: "destructive" });
    setOverview((ov ?? []) as OverviewRow[]);
    setCards((cardsData ?? []) as ReportCard[]);

    const studentIds = (ov ?? []).map((r: OverviewRow) => r.student_id);
    if (studentIds.length) {
      const { data: rcs } = await supabase
        .from("academic_recommendations")
        .select("id, student_id, recommendation_type, suggestions, threshold_alert, created_at")
        .in("student_id", studentIds)
        .order("created_at", { ascending: false });
      setRecs((rcs ?? []) as Recommendation[]);
    } else {
      setRecs([]);
    }
    setLoading(false);
  };

  const stats = useMemo(() => {
    const total = overview.length;
    const avgAtt = total ? Math.round(overview.reduce((s, r) => s + Number(r.attendance_percent || 0), 0) / total) : 0;
    const avgScore = total ? Math.round(overview.reduce((s, r) => s + Number(r.average_score || 0), 0) / total) : 0;
    const alerts = overview.filter((r) => r.alert_low_attendance || r.alert_low_performance).length;
    return { total, avgAtt, avgScore, alerts };
  }, [overview]);

  const openRecommend = (student: OverviewRow) => {
    setRecForm({
      recommendation_type: student.alert_low_performance ? "performance" : student.alert_low_attendance ? "attendance" : "general",
      strengths: "",
      weaknesses: "",
      suggestions: "",
      threshold_alert: student.alert_low_attendance || student.alert_low_performance,
    });
    setRecDialog({ open: true, student });
  };

  const submitRecommendation = async () => {
    if (!recDialog.student) return;
    if (!recForm.suggestions.trim()) {
      toast({ title: "Add a suggestion before sending", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.rpc("create_academic_recommendation", {
      p_student_id: recDialog.student.student_id,
      p_recommendation_type: recForm.recommendation_type,
      p_suggestions: recForm.suggestions,
      p_strengths: recForm.strengths || null,
      p_weaknesses: recForm.weaknesses || null,
      p_threshold_alert: recForm.threshold_alert,
      p_term_id: null,
    });
    setSubmitting(false);
    if (error) {
      toast({ title: "Could not send recommendation", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Recommendation sent", description: "Parents and the student have been notified." });
    setRecDialog({ open: false });
    loadAll(classId);
  };

  const submitReportCard = async (id: string) => {
    const { error } = await supabase
      .from("term_report_cards")
      .update({ status: "submitted", submitted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast({ title: "Could not submit", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Submitted for approval" });
    loadAll(classId);
  };

  if (!classes.length) {
    return (
      <DashboardLayout role="teacher">
        <Card>
          <CardHeader>
            <CardTitle>My Class</CardTitle>
            <CardDescription>You are not currently assigned as a class teacher.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Ask your school administrator to assign you to a class from <strong>Classes → Assign Class Teacher</strong>.
            </p>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  const currentClass = classes.find((c) => c.id === classId);

  return (
    <DashboardLayout role="teacher">
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">My Class</h2>
            <p className="text-muted-foreground">Manage your assigned class — attendance, report cards, performance and parent communication.</p>
          </div>
          {classes.length > 1 ? (
            <Select value={classId} onValueChange={setClassId}>
              <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          ) : null}
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <StatCard icon={Users} label="Students" value={stats.total.toString()} />
          <StatCard icon={ClipboardList} label="Avg attendance" value={`${stats.avgAtt}%`} />
          <StatCard icon={BookOpen} label="Avg score" value={`${stats.avgScore}`} />
          <StatCard icon={AlertTriangle} label="Students flagged" value={stats.alerts.toString()} highlight={stats.alerts > 0} />
        </div>

        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="attendance">Attendance</TabsTrigger>
            <TabsTrigger value="reports">Report cards</TabsTrigger>
            <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>{currentClass?.name}</CardTitle>
                <CardDescription>Per-student performance & attendance. Click "Recommend" to send a suggestion to parents.</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead>Admission #</TableHead>
                        <TableHead>Attendance</TableHead>
                        <TableHead>Avg score</TableHead>
                        <TableHead>Failing</TableHead>
                        <TableHead>Alerts</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {overview.map((r) => (
                        <TableRow key={r.student_id}>
                          <TableCell className="font-medium">{r.full_name}</TableCell>
                          <TableCell>{r.admission_no ?? "—"}</TableCell>
                          <TableCell>{r.attendance_percent}% <span className="text-xs text-muted-foreground">({r.present_days}/{r.total_days})</span></TableCell>
                          <TableCell>{r.average_score}</TableCell>
                          <TableCell>{r.failing_subjects}</TableCell>
                          <TableCell className="space-x-1">
                            {r.alert_low_attendance && <Badge variant="destructive">Low attendance</Badge>}
                            {r.alert_low_performance && <Badge variant="destructive">Poor performance</Badge>}
                            {!r.alert_low_attendance && !r.alert_low_performance && <Badge variant="secondary">On track</Badge>}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="outline" onClick={() => openRecommend(r)}>
                              <MessageCircle className="h-3 w-3 mr-1" /> Recommend
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {!overview.length && (
                        <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No students enrolled yet.</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="attendance" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Attendance management</CardTitle>
                <CardDescription>Use the class register to mark daily attendance.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3">
                <Button asChild><Link to="/teacher/register">Open class registers</Link></Button>
                <Button asChild variant="outline"><Link to="/teacher/attendance">Attendance history</Link></Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reports" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Report cards</CardTitle>
                <CardDescription>Review and submit student report cards for administrator approval.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Term</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cards.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>{c.student_name ?? "—"}</TableCell>
                        <TableCell>{c.term_label ?? "—"} {c.academic_year ?? ""}</TableCell>
                        <TableCell><Badge variant={c.status === "approved" ? "default" : c.status === "submitted" ? "secondary" : "outline"}>{c.status}</Badge></TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button asChild size="sm" variant="ghost"><Link to={`/teacher/report-cards/view?id=${c.id}`}><FileText className="h-3 w-3 mr-1" />View</Link></Button>
                          {(c.status === "draft" || c.status === "rejected") && (
                            <Button size="sm" onClick={() => submitReportCard(c.id)}>Submit for approval</Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {!cards.length && (
                      <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No report cards yet for this class.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="recommendations" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Recommendations sent</CardTitle>
                <CardDescription>History of academic suggestions sent to parents and students.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Student</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Message</TableHead>
                      <TableHead>Alert</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recs.map((r) => {
                      const s = overview.find((o) => o.student_id === r.student_id);
                      return (
                        <TableRow key={r.id}>
                          <TableCell>{new Date(r.created_at).toLocaleDateString()}</TableCell>
                          <TableCell>{s?.full_name ?? r.student_id.slice(0, 8)}</TableCell>
                          <TableCell><Badge variant="outline">{r.recommendation_type}</Badge></TableCell>
                          <TableCell className="max-w-md truncate">{r.suggestions}</TableCell>
                          <TableCell>{r.threshold_alert ? <Badge variant="destructive">Yes</Badge> : <Badge variant="secondary">No</Badge>}</TableCell>
                        </TableRow>
                      );
                    })}
                    {!recs.length && (
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No recommendations sent yet.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={recDialog.open} onOpenChange={(o) => setRecDialog({ open: o, student: o ? recDialog.student : undefined })}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Send recommendation</DialogTitle>
            <DialogDescription>For {recDialog.student?.full_name}. Parents will receive an in-app notification.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={recForm.recommendation_type} onValueChange={(v) => setRecForm({ ...recForm, recommendation_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="performance">Academic performance</SelectItem>
                  <SelectItem value="attendance">Attendance</SelectItem>
                  <SelectItem value="behaviour">Behaviour</SelectItem>
                  <SelectItem value="study_plan">Study plan</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Strengths (optional)</Label>
              <Textarea value={recForm.strengths} onChange={(e) => setRecForm({ ...recForm, strengths: e.target.value })} rows={2} maxLength={500} />
            </div>
            <div className="space-y-2">
              <Label>Areas to improve (optional)</Label>
              <Textarea value={recForm.weaknesses} onChange={(e) => setRecForm({ ...recForm, weaknesses: e.target.value })} rows={2} maxLength={500} />
            </div>
            <div className="space-y-2">
              <Label>Suggestion / study plan *</Label>
              <Textarea
                value={recForm.suggestions}
                onChange={(e) => setRecForm({ ...recForm, suggestions: e.target.value })}
                rows={4}
                maxLength={1000}
                placeholder="Recommend extra reading, study tips, assignments, or interventions…"
              />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">Mark as performance alert</p>
                <p className="text-xs text-muted-foreground">Highlights this as a priority notification for parents.</p>
              </div>
              <Switch checked={recForm.threshold_alert} onCheckedChange={(v) => setRecForm({ ...recForm, threshold_alert: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecDialog({ open: false })}>Cancel</Button>
            <Button onClick={submitRecommendation} disabled={submitting}>{submitting ? "Sending…" : "Send recommendation"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

const StatCard = ({ icon: Icon, label, value, highlight }: { icon: any; label: string; value: string; highlight?: boolean }) => (
  <Card className={highlight ? "border-destructive/50" : ""}>
    <CardContent className="p-4 flex items-center gap-3">
      <div className={`rounded-md p-2 ${highlight ? "bg-destructive/10 text-destructive" : "bg-muted"}`}><Icon className="h-5 w-5" /></div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold">{value}</p>
      </div>
    </CardContent>
  </Card>
);

export default TeacherMyClass;
