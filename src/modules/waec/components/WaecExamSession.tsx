import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Clock, Flag, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { saveWaecAnswer } from "@/modules/waec/lib/api";
import type { WaecPracticeSession, WaecQuestion } from "@/modules/waec/lib/types";
import { WAEC_LEVEL_LABELS, WAEC_PAPER_LABELS } from "@/modules/waec/lib/types";

type Props = {
  session: WaecPracticeSession;
  questions: WaecQuestion[];
  subjectName: string;
  answers: Record<string, string>;
  onAnswer: (questionId: string, answer: string) => void;
  onSubmit: () => void;
  submitting?: boolean;
};

function formatTime(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function WaecExamSession({
  session,
  questions,
  subjectName,
  answers,
  onAnswer,
  onSubmit,
  submitting,
}: Props) {
  const [current, setCurrent] = useState(0);
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});
  const [timeLeft, setTimeLeft] = useState<number | null>(
    session.mode === "exam" && session.duration_minutes ? session.duration_minutes * 60 : null,
  );
  const submittedRef = useRef(false);

  const q = questions[current];
  const answeredCount = Object.keys(answers).filter((k) => answers[k]).length;
  const progress = questions.length > 0 ? (answeredCount / questions.length) * 100 : 0;

  const handleSubmit = useCallback(() => {
    if (submittedRef.current || submitting) return;
    if (!confirm("Submit your examination? You cannot change answers after submission.")) return;
    submittedRef.current = true;
    onSubmit();
  }, [onSubmit, submitting]);

  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0) return;
    const t = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(t);
          if (!submittedRef.current) {
            submittedRef.current = true;
            onSubmit();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [timeLeft, onSubmit]);

  const selectAnswer = async (answer: string) => {
    if (!q) return;
    onAnswer(q.id, answer);
    try {
      await saveWaecAnswer(session.id, q.id, answer);
    } catch {
      // parent handles errors
    }
  };

  if (!q) return null;

  return (
    <div className="space-y-4">
      <Card className="border-primary/20">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 pb-2">
          <div>
            <CardTitle className="text-base">
              {WAEC_LEVEL_LABELS[session.level]} — {subjectName}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {WAEC_PAPER_LABELS[session.paper_type]}
              {" · "}
              {session.mode === "exam" ? "Mock Examination" : "Practice"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {timeLeft !== null ? (
              <Badge variant={timeLeft < 300 ? "destructive" : "secondary"} className="gap-1 text-sm">
                <Clock className="h-3.5 w-3.5" />
                {formatTime(timeLeft)}
              </Badge>
            ) : null}
            <Badge variant="outline">
              {answeredCount}/{questions.length} answered
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <Progress value={progress} className="h-2" />
          <div className="flex flex-wrap gap-1.5 pt-2">
            {questions.map((item, i) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setCurrent(i)}
                className={`flex h-8 w-8 items-center justify-center rounded-md text-xs font-medium transition-colors ${
                  i === current
                    ? "bg-primary text-primary-foreground"
                    : answers[item.id]
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                      : flagged[item.id]
                        ? "bg-amber-500/15 text-amber-700"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <CardTitle className="text-base font-medium">
            Question {current + 1} of {questions.length}
            {q.topic ? <span className="ml-2 text-xs font-normal text-muted-foreground">({q.topic})</span> : null}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1"
            onClick={() => setFlagged((f) => ({ ...f, [q.id]: !f[q.id] }))}
          >
            <Flag className={`h-4 w-4 ${flagged[q.id] ? "fill-amber-500 text-amber-500" : ""}`} />
            Flag
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm leading-relaxed md:text-base">{q.question_text}</p>
          {q.options && q.options.length > 0 ? (
            <RadioGroup value={answers[q.id] ?? ""} onValueChange={selectAnswer}>
              {q.options.map((opt) => (
                <div key={opt.id} className="flex items-center space-x-3 rounded-lg border p-3 hover:bg-muted/50">
                  <RadioGroupItem value={opt.id} id={`opt-${opt.id}`} />
                  <Label htmlFor={`opt-${opt.id}`} className="flex-1 cursor-pointer font-normal">
                    <span className="mr-2 font-semibold">{opt.id}.</span>
                    {opt.text}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          ) : (
            <p className="text-sm text-muted-foreground">Theory questions — marking via AI coming soon.</p>
          )}
        </CardContent>
        <CardFooter className="flex flex-wrap justify-between gap-2">
          <Button variant="outline" disabled={current === 0} onClick={() => setCurrent((c) => c - 1)} className="gap-1">
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <div className="flex gap-2">
            {current < questions.length - 1 ? (
              <Button onClick={() => setCurrent((c) => c + 1)} className="gap-1">
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={submitting} className="gap-1">
                <Send className="h-4 w-4" />
                {submitting ? "Submitting…" : "Submit"}
              </Button>
            )}
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
