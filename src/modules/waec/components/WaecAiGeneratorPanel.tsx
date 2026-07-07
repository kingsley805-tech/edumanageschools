import { useMemo, useState } from "react";
import { Sparkles, Loader2, Library } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  countWaecSubjectQuestions,
  generateWaecQuestions,
  generateWaecSubjectBank,
  WAEC_BANK_TARGET,
} from "@/modules/waec/lib/api";
import type { WaecBankProgress } from "@/modules/waec/lib/api";
import type { WaecDifficulty, WaecQuestionType, WaecSubject } from "@/modules/waec/lib/types";
import { WAEC_LEVEL_LABELS } from "@/modules/waec/lib/types";
import { toast } from "sonner";

const BATCH_SIZE = 15;

type Props = {
  subjects: WaecSubject[];
  schoolId: string | null;
  onGenerated: () => void;
};

const DIFFICULTY_OPTIONS: { value: WaecDifficulty | "mixed"; label: string }[] = [
  { value: "mixed", label: "Mixed (30/40/20/10)" },
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
  { value: "advanced", label: "Advanced" },
];

const TYPE_OPTIONS: { value: WaecQuestionType; label: string }[] = [
  { value: "objective", label: "Objective (MCQ)" },
  { value: "structured", label: "Structured / theory" },
  { value: "mock", label: "Mock exam (mixed)" },
];

export function WaecAiGeneratorPanel({ subjects, schoolId, onGenerated }: Props) {
  const [subjectId, setSubjectId] = useState("");
  const [topic, setTopic] = useState("");
  const [subTopic, setSubTopic] = useState("");
  const [difficulty, setDifficulty] = useState<WaecDifficulty | "mixed">("mixed");
  const [questionType, setQuestionType] = useState<WaecQuestionType>("objective");
  const [total, setTotal] = useState("500");
  const [autoApprove, setAutoApprove] = useState(true);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<WaecBankProgress | null>(null);
  const [subjectCounts, setSubjectCounts] = useState<Record<string, number>>({});

  const subject = useMemo(() => subjects.find((s) => s.id === subjectId), [subjects, subjectId]);

  const loadSubjectCount = async (id: string) => {
    try {
      const n = await countWaecSubjectQuestions(id);
      setSubjectCounts((c) => ({ ...c, [id]: n }));
    } catch {
      /* ignore */
    }
  };

  const handleGenerateBatch = async () => {
    if (!subject) {
      toast.error("Select a subject first.");
      return;
    }
    const target = Math.min(Math.max(Number(total) || BATCH_SIZE, 1), 500);
    setRunning(true);
    setProgress({ subjectName: subject.name, phase: questionType, done: 0, total: target, inserted: 0, skipped: 0 });

    let inserted = 0;
    let skipped = 0;
    const batches = Math.ceil(target / BATCH_SIZE);
    try {
      for (let i = 0; i < batches; i++) {
        const count = Math.min(BATCH_SIZE, target - i * BATCH_SIZE);
        const res = await generateWaecQuestions({
          subjectId: subject.id,
          subjectName: subject.name,
          level: subject.level,
          topic: topic.trim() || undefined,
          subTopic: subTopic.trim() || undefined,
          difficulty,
          questionType,
          count,
          schoolId,
          autoApprove,
        });
        inserted += res.inserted ?? 0;
        skipped += res.skipped ?? 0;
        setProgress({
          subjectName: subject.name,
          phase: questionType,
          done: Math.min((i + 1) * BATCH_SIZE, target),
          total: target,
          inserted,
          skipped,
        });
      }
      if (inserted > 0) {
        toast.success(
          autoApprove
            ? `${inserted} question(s) live for students${skipped ? ` (${skipped} duplicates skipped)` : ""}.`
            : `${inserted} draft(s) created — approve in the queue.`,
        );
        void loadSubjectCount(subject.id);
        onGenerated();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setRunning(false);
    }
  };

  const handleGenerateFullBank = async (targetSubject?: WaecSubject) => {
    const sub = targetSubject ?? subject;
    if (!sub) {
      toast.error("Select a subject first.");
      return;
    }
    setRunning(true);
    try {
      const existing = await countWaecSubjectQuestions(sub.id);
      if (existing >= WAEC_BANK_TARGET) {
        toast.info(`${sub.name} already has ${existing} questions.`);
        return;
      }
      const res = await generateWaecSubjectBank(sub, {
        schoolId: null,
        autoApprove,
        existingCount: existing,
        onProgress: setProgress,
      });
      toast.success(
        `${sub.name}: ${res.inserted} added (${existing + res.inserted}/${WAEC_BANK_TARGET} total)${res.skipped ? `, ${res.skipped} duplicates skipped` : ""}.`,
      );
      void loadSubjectCount(sub.id);
      onGenerated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bank generation failed");
    } finally {
      setRunning(false);
      setProgress(null);
    }
  };

  const handleGenerateAllSubjects = async () => {
    if (!confirm(`Generate up to ${WAEC_BANK_TARGET} questions for every subject? This uses significant AI quota and may take a long time.`)) {
      return;
    }
    setRunning(true);
    let totalInserted = 0;
    try {
      for (const sub of subjects) {
        const existing = await countWaecSubjectQuestions(sub.id);
        if (existing >= WAEC_BANK_TARGET) continue;
        const res = await generateWaecSubjectBank(sub, {
          schoolId: null,
          autoApprove,
          existingCount: existing,
          onProgress: setProgress,
        });
        totalInserted += res.inserted;
        setSubjectCounts((c) => ({ ...c, [sub.id]: existing + res.inserted }));
      }
      toast.success(`All subjects processed. ${totalInserted} new question(s) added.`);
      onGenerated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bulk generation failed");
    } finally {
      setRunning(false);
      setProgress(null);
    }
  };

  const pct = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
  const currentCount = subjectId ? subjectCounts[subjectId] : undefined;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Library className="h-5 w-5 text-primary" />
            Full Subject Bank — {WAEC_BANK_TARGET} Questions
          </CardTitle>
          <CardDescription>
            Builds a complete BECE/WASSCE-style bank per subject: 300 objective, 150 structured, 50 mock.
            Questions are original, curriculum-aligned, and not tied to any exam year.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch id="auto-approve" checked={autoApprove} onCheckedChange={setAutoApprove} />
              <Label htmlFor="auto-approve">Publish immediately for students</Label>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Subject</Label>
              <Select
                value={subjectId || "none"}
                onValueChange={(v) => {
                  const id = v === "none" ? "" : v;
                  setSubjectId(id);
                  if (id) void loadSubjectCount(id);
                }}
              >
                <SelectTrigger><SelectValue placeholder="Choose a subject" /></SelectTrigger>
                <SelectContent>
                  {subjects.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {WAEC_LEVEL_LABELS[s.level]} — {s.name}
                      {subjectCounts[s.id] != null ? ` (${subjectCounts[s.id]}/${WAEC_BANK_TARGET})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {subject && currentCount != null ? (
                <p className="text-xs text-muted-foreground">
                  {currentCount} of {WAEC_BANK_TARGET} questions ready for students
                </p>
              ) : null}
            </div>
          </div>

          {progress ? (
            <div className="space-y-2 rounded-lg border bg-muted/40 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="font-medium">
                  {running ? "Generating" : "Done"} — {progress.subjectName} ({progress.phase})
                </span>
                <span className="text-muted-foreground">
                  {progress.done}/{progress.total} · {progress.inserted} added
                  {progress.skipped ? ` · ${progress.skipped} dupes` : ""}
                </span>
              </div>
              <Progress value={pct} />
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void handleGenerateFullBank()} disabled={running || !subjectId} className="gap-2">
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Library className="h-4 w-4" />}
              Generate 500 for subject
            </Button>
            <Button
              variant="outline"
              onClick={() => void handleGenerateAllSubjects()}
              disabled={running || subjects.length === 0}
              className="gap-2"
            >
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Generate all subjects
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-5 w-5 text-primary" />
            Custom Batch
          </CardTitle>
          <CardDescription>Generate a smaller custom set with specific topic, type, or difficulty.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Topic (optional)</Label>
              <Input placeholder="e.g. Algebra" value={topic} onChange={(e) => setTopic(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Sub-topic (optional)</Label>
              <Input placeholder="e.g. Linear equations" value={subTopic} onChange={(e) => setSubTopic(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Question type</Label>
              <Select value={questionType} onValueChange={(v) => setQuestionType(v as WaecQuestionType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Difficulty</Label>
              <Select value={difficulty} onValueChange={(v) => setDifficulty(v as WaecDifficulty | "mixed")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DIFFICULTY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Count</Label>
              <Input type="number" min={1} max={500} value={total} onChange={(e) => setTotal(e.target.value)} />
            </div>
          </div>

          <Button variant="outline" onClick={() => void handleGenerateBatch()} disabled={running || !subjectId} className="gap-2">
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Generate batch
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
