import { useMemo, useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { generateWaecQuestions } from "@/modules/waec/lib/api";
import type { WaecDifficulty, WaecQuestionType, WaecSubject } from "@/modules/waec/lib/types";
import { WAEC_LEVEL_LABELS } from "@/modules/waec/lib/types";
import { toast } from "sonner";

const BATCH_SIZE = 15;

type Props = {
  subjects: WaecSubject[];
  schoolId: string | null;
  onGenerated: () => void;
};

type Progressive = { inserted: number; skipped: number; done: number; total: number };

const DIFFICULTY_OPTIONS: { value: WaecDifficulty | "mixed"; label: string }[] = [
  { value: "mixed", label: "Mixed (recommended)" },
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
  { value: "advanced", label: "Advanced" },
];

const TYPE_OPTIONS: { value: WaecQuestionType; label: string }[] = [
  { value: "objective", label: "Objective (MCQ, 4 options)" },
  { value: "structured", label: "Structured / theory (short answer)" },
  { value: "mock", label: "Mock exam (mixed)" },
];

export function WaecAiGeneratorPanel({ subjects, schoolId, onGenerated }: Props) {
  const [subjectId, setSubjectId] = useState("");
  const [topic, setTopic] = useState("");
  const [subTopic, setSubTopic] = useState("");
  const [difficulty, setDifficulty] = useState<WaecDifficulty | "mixed">("mixed");
  const [questionType, setQuestionType] = useState<WaecQuestionType>("objective");
  const [total, setTotal] = useState("30");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<Progressive | null>(null);

  const subject = useMemo(() => subjects.find((s) => s.id === subjectId), [subjects, subjectId]);

  const handleGenerate = async () => {
    if (!subject) {
      toast.error("Select a subject first.");
      return;
    }
    const target = Math.min(Math.max(Number(total) || BATCH_SIZE, 1), 500);
    const batches = Math.ceil(target / BATCH_SIZE);
    setRunning(true);
    setProgress({ inserted: 0, skipped: 0, done: 0, total: target });

    let inserted = 0;
    let skipped = 0;
    try {
      for (let i = 0; i < batches; i++) {
        const remaining = target - i * BATCH_SIZE;
        const count = Math.min(BATCH_SIZE, remaining);
        try {
          const res = await generateWaecQuestions({
            subjectId: subject.id,
            subjectName: subject.name,
            level: subject.level,
            topic: topic.trim() || undefined,
            subTopic: subTopic.trim() || undefined,
            difficulty,
            questionType,
            count,
            year: Number(year) || new Date().getFullYear(),
            schoolId,
          });
          inserted += res.inserted ?? 0;
          skipped += res.skipped ?? 0;
        } catch (err) {
          // Surface the first batch failure but keep partial progress visible.
          toast.error(err instanceof Error ? err.message : "Generation failed");
          break;
        }
        setProgress({ inserted, skipped, done: Math.min((i + 1) * BATCH_SIZE, target), total: target });
      }

      if (inserted > 0) {
        toast.success(`Generated ${inserted} question(s)${skipped ? ` (${skipped} duplicates skipped)` : ""}. Review them in the Approval Queue.`);
        onGenerated();
      } else if (skipped > 0) {
        toast.info("All generated questions were duplicates. Try a different topic or difficulty.");
      }
    } finally {
      setRunning(false);
    }
  };

  const pct = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-5 w-5 text-primary" />
          AI Question Generator
        </CardTitle>
        <CardDescription>
          Generate original, curriculum-aligned WAEC-style questions. New questions land in the
          Approval Queue as drafts — students only see them after you approve.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Subject</Label>
            <Select value={subjectId || "none"} onValueChange={(v) => setSubjectId(v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Choose a subject" /></SelectTrigger>
              <SelectContent>
                {subjects.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {WAEC_LEVEL_LABELS[s.level]} — {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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
            <Label>How many to generate</Label>
            <Input type="number" min={1} max={500} value={total} onChange={(e) => setTotal(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Year label</Label>
            <Input type="number" value={year} onChange={(e) => setYear(e.target.value)} />
          </div>
        </div>

        {progress ? (
          <div className="space-y-2 rounded-lg border bg-muted/40 p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">
                {running ? "Generating…" : "Done"} {progress.done}/{progress.total}
              </span>
              <span className="text-muted-foreground">
                {progress.inserted} added{progress.skipped ? ` · ${progress.skipped} duplicates` : ""}
              </span>
            </div>
            <Progress value={pct} />
          </div>
        ) : null}

        <Button onClick={() => void handleGenerate()} disabled={running || !subjectId} className="gap-2">
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {running ? "Generating…" : "Generate questions"}
        </Button>
        <p className="text-xs text-muted-foreground">
          Generated in batches of {BATCH_SIZE}. Large batches use more AI quota. Questions are
          de-duplicated automatically against the existing bank.
        </p>
      </CardContent>
    </Card>
  );
}
