import { useMemo, useState } from "react";
import { Loader2, Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type {
  WaecDifficulty,
  WaecPaperType,
  WaecQuestionType,
  WaecSubject,
} from "@/modules/waec/lib/types";
import { WAEC_LEVEL_LABELS } from "@/modules/waec/lib/types";

export type WaecGenerateExamParams = {
  subject: WaecSubject;
  topic?: string;
  difficulty: WaecDifficulty | "mixed";
  questionType: WaecQuestionType;
  paperType: WaecPaperType;
  count: number;
  mode: "practice" | "exam";
  durationMinutes?: number;
};

type Props = {
  subjects: WaecSubject[];
  generating: boolean;
  progress?: { done: number; total: number } | null;
  onGenerate: (params: WaecGenerateExamParams) => void;
};

const DIFFICULTY_OPTIONS: { value: WaecDifficulty | "mixed"; label: string }[] = [
  { value: "mixed", label: "Mixed" },
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
  { value: "advanced", label: "Advanced" },
];

export function WaecAiExamGenerator({ subjects, generating, progress, onGenerate }: Props) {
  const [subjectId, setSubjectId] = useState("");
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState<WaecDifficulty | "mixed">("mixed");
  const [questionType, setQuestionType] = useState<WaecQuestionType>("objective");
  const [count, setCount] = useState("10");
  const [mode, setMode] = useState<"practice" | "exam">("practice");
  const [duration, setDuration] = useState("30");

  const subject = useMemo(() => subjects.find((s) => s.id === subjectId), [subjects, subjectId]);

  const submit = () => {
    if (!subject) return;
    onGenerate({
      subject,
      topic: topic.trim() || undefined,
      difficulty,
      questionType,
      paperType: questionType === "structured" ? "paper_2" : "paper_1",
      count: Math.min(Math.max(Number(count) || 10, 1), 40),
      mode,
      durationMinutes: mode === "exam" ? Number(duration) || 30 : undefined,
    });
  };

  const pct = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Wand2 className="h-5 w-5 text-primary" />
          Generate My Own Exam with AI
        </CardTitle>
        <CardDescription>
          The AI builds a brand-new BECE/WASSCE-style question set just for you — a fresh, unique
          exam every time. Pick your subject and options, then start solving instantly.
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

          <div className="space-y-1.5 sm:col-span-2">
            <Label>Topic (optional)</Label>
            <Input placeholder="e.g. Photosynthesis, Algebra…" value={topic} onChange={(e) => setTopic(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Question type</Label>
            <Select value={questionType} onValueChange={(v) => setQuestionType(v as WaecQuestionType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="objective">Objective (MCQ)</SelectItem>
                <SelectItem value="structured">Structured / theory</SelectItem>
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
            <Label>Number of questions</Label>
            <Input type="number" min={1} max={40} value={count} onChange={(e) => setCount(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Mode</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as "practice" | "exam")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="practice">Practice (no timer)</SelectItem>
                <SelectItem value="exam">Timed mock exam</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {mode === "exam" ? (
            <div className="space-y-1.5">
              <Label>Duration (minutes)</Label>
              <Input type="number" min={5} max={180} value={duration} onChange={(e) => setDuration(e.target.value)} />
            </div>
          ) : null}
        </div>

        {generating && progress ? (
          <div className="space-y-2 rounded-lg border bg-muted/40 p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Generating your questions…</span>
              <span className="text-muted-foreground">{progress.done}/{progress.total}</span>
            </div>
            <Progress value={pct} />
          </div>
        ) : null}

        <Button onClick={submit} disabled={generating || !subjectId} className="w-full gap-2">
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {generating ? "Generating your exam…" : "Generate & Start"}
        </Button>
        <p className="text-xs text-muted-foreground">
          Uses AI — generation may take a few seconds. Larger sets take longer.
        </p>
      </CardContent>
    </Card>
  );
}
