import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSchoolInfo } from "@/hooks/useSchoolInfo";
import { WaecSchemaSetupCard } from "@/modules/waec/components/WaecSchemaSetupCard";
import { WaecAiGeneratorPanel } from "@/modules/waec/components/WaecAiGeneratorPanel";
import { WaecApprovalQueue } from "@/modules/waec/components/WaecApprovalQueue";
import {
  countWaecDrafts,
  deleteWaecQuestion,
  fetchAllWaecQuestionsAdmin,
  fetchWaecSubjects,
  saveWaecQuestion,
} from "@/modules/waec/lib/api";
import { checkWaecSchema, waecSchemaReady, type WaecSchemaStatus } from "@/modules/waec/lib/schema";
import type { WaecQuestion, WaecSubject } from "@/modules/waec/lib/types";
import { WAEC_LEVEL_LABELS, WAEC_PAPER_LABELS } from "@/modules/waec/lib/types";
import { ExportMenu } from "@/modules/lib/ExportMenu";
import { toast } from "sonner";

const emptyForm = {
  subject_id: "",
  paper_type: "paper_1",
  topic: "",
  difficulty: "medium",
  question_text: "",
  option_a: "",
  option_b: "",
  option_c: "",
  option_d: "",
  correct_answer: "A",
  explanation: "",
};

export default function WaecAdminPage() {
  const { currentSchool } = useSchoolInfo();
  const schoolId = currentSchool?.id ?? null;
  const [schemaStatus, setSchemaStatus] = useState<WaecSchemaStatus | null>(null);
  const [subjects, setSubjects] = useState<WaecSubject[]>([]);
  const [questions, setQuestions] = useState<WaecQuestion[]>([]);
  const [search, setSearch] = useState("");
  const [filterSubject, setFilterSubject] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [draftCount, setDraftCount] = useState(0);

  const refreshDraftCount = useCallback(async () => {
    try {
      setDraftCount(await countWaecDrafts());
    } catch {
      /* status column may not be migrated yet */
    }
  }, []);

  const load = useCallback(async () => {
    const status = await checkWaecSchema();
    setSchemaStatus(status);
    if (!status.questions) return;
    const [subs, qs] = await Promise.all([
      fetchWaecSubjects(),
      fetchAllWaecQuestionsAdmin({ subjectId: filterSubject || undefined, search: search || undefined }),
    ]);
    setSubjects(subs);
    setQuestions(qs);
    void refreshDraftCount();
  }, [filterSubject, search, refreshDraftCount]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = async () => {
    if (!form.subject_id || !form.question_text.trim()) {
      toast.error("Subject and question text are required.");
      return;
    }
    setSaving(true);
    try {
      const options = [
        { id: "A", text: form.option_a },
        { id: "B", text: form.option_b },
        { id: "C", text: form.option_c },
        { id: "D", text: form.option_d },
      ].filter((o) => o.text.trim());
      await saveWaecQuestion(
        {
          subject_id: form.subject_id,
          paper_type: form.paper_type as WaecQuestion["paper_type"],
          topic: form.topic || null,
          difficulty: form.difficulty as WaecQuestion["difficulty"],
          question_text: form.question_text,
          options: options.length > 0 ? options : null,
          correct_answer: form.correct_answer,
          explanation: form.explanation || null,
        },
        schoolId,
      );
      toast.success("Question added");
      setOpen(false);
      setForm(emptyForm);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this question?")) return;
    try {
      await deleteWaecQuestion(id);
      toast.success("Deleted");
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const schemaReady = schemaStatus ? waecSchemaReady(schemaStatus) : false;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">WAEC Question Bank</h1>
          <p className="text-sm text-muted-foreground">Manage BECE (JHS) & WASSCE (SHS) questions, marking schemes & explanations</p>
        </div>

        {schemaStatus && !schemaReady ? (
          <WaecSchemaSetupCard status={schemaStatus} onRecheck={() => void load()} />
        ) : null}

        <Tabs defaultValue="questions">
          <TabsList className="flex-wrap">
            <TabsTrigger value="questions">Questions</TabsTrigger>
            <TabsTrigger value="generate">AI Generator</TabsTrigger>
            <TabsTrigger value="approval">
              Approval Queue{draftCount ? ` (${draftCount})` : ""}
            </TabsTrigger>
            <TabsTrigger value="subjects">Subjects ({subjects.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="generate" className="space-y-4">
            <WaecAiGeneratorPanel
              subjects={subjects}
              schoolId={schoolId}
              onGenerated={() => {
                void refreshDraftCount();
              }}
            />
          </TabsContent>

          <TabsContent value="approval" className="space-y-4">
            <WaecApprovalQueue
              subjects={subjects}
              onChange={() => {
                void refreshDraftCount();
                void load();
              }}
            />
          </TabsContent>

          <TabsContent value="questions" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
                <CardTitle className="text-base">{questions.length} question(s)</CardTitle>
                <div className="flex flex-wrap gap-2">
                  <Input placeholder="Search…" className="w-[180px]" value={search} onChange={(e) => setSearch(e.target.value)} />
                  <Select value={filterSubject || "all"} onValueChange={(v) => setFilterSubject(v === "all" ? "" : v)}>
                    <SelectTrigger className="w-[180px]"><SelectValue placeholder="Subject" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All subjects</SelectItem>
                      {subjects.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <ExportMenu
                    filename="waec-questions"
                    title="WAEC Questions"
                    headers={["Subject", "Paper", "Topic", "Question", "Answer"]}
                    rows={questions.map((q) => [q.subject_name, q.paper_type, q.topic, q.question_text, q.correct_answer])}
                  />
                  <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" />Add question</Button>
                    </DialogTrigger>
                    <DialogContent className="max-h-[90vh] overflow-y-auto max-w-lg">
                      <DialogHeader><DialogTitle>Add WAEC question</DialogTitle></DialogHeader>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5 sm:col-span-2">
                          <Label>Subject</Label>
                          <Select value={form.subject_id || "none"} onValueChange={(v) => setForm({ ...form, subject_id: v === "none" ? "" : v })}>
                            <SelectTrigger><SelectValue placeholder="Subject" /></SelectTrigger>
                            <SelectContent>
                              {subjects.map((s) => (
                                <SelectItem key={s.id} value={s.id}>{WAEC_LEVEL_LABELS[s.level]} — {s.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label>Paper</Label>
                          <Select value={form.paper_type} onValueChange={(v) => setForm({ ...form, paper_type: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {Object.entries(WAEC_PAPER_LABELS).map(([k, v]) => (
                                <SelectItem key={k} value={k}>{v}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5 sm:col-span-2">
                          <Label>Question</Label>
                          <Textarea value={form.question_text} onChange={(e) => setForm({ ...form, question_text: e.target.value })} rows={3} />
                        </div>
                        {(["a", "b", "c", "d"] as const).map((l) => (
                          <div key={l} className="space-y-1.5">
                            <Label>Option {l.toUpperCase()}</Label>
                            <Input value={form[`option_${l}`]} onChange={(e) => setForm({ ...form, [`option_${l}`]: e.target.value })} />
                          </div>
                        ))}
                        <div className="space-y-1.5">
                          <Label>Correct answer</Label>
                          <Select value={form.correct_answer} onValueChange={(v) => setForm({ ...form, correct_answer: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {["A", "B", "C", "D"].map((o) => (
                                <SelectItem key={o} value={o}>{o}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label>Topic</Label>
                          <Input value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} />
                        </div>
                        <div className="space-y-1.5 sm:col-span-2">
                          <Label>Explanation</Label>
                          <Textarea value={form.explanation} onChange={(e) => setForm({ ...form, explanation: e.target.value })} rows={2} />
                        </div>
                      </div>
                      <Button onClick={() => void handleSave()} disabled={saving} className="mt-2">
                        {saving ? "Saving…" : "Save question"}
                      </Button>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Subject</TableHead>
                      <TableHead>Question</TableHead>
                      <TableHead>Answer</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {questions.map((q) => (
                      <TableRow key={q.id}>
                        <TableCell className="text-xs">{q.subject_name}</TableCell>
                        <TableCell className="max-w-[300px] truncate">{q.question_text}</TableCell>
                        <TableCell>{q.correct_answer}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => void handleDelete(q.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="subjects">
            <Card>
              <CardContent className="p-4">
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {subjects.map((s) => (
                    <div key={s.id} className="rounded-lg border px-3 py-2 text-sm">
                      <p className="font-medium">{s.name}</p>
                      <p className="text-xs text-muted-foreground">{WAEC_LEVEL_LABELS[s.level]} · {s.category}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
