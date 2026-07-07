import { CheckCircle, XCircle, MinusCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { WaecPracticeSession, WaecSessionAnswer } from "@/modules/waec/lib/types";
import { WAEC_GRADE_INFO } from "@/modules/waec/lib/types";

type Props = {
  session: WaecPracticeSession;
  answers: WaecSessionAnswer[];
  onDone: () => void;
  onAiHelp?: (questionText: string) => void;
};

export function WaecResultReview({ session, answers, onDone, onAiHelp }: Props) {
  const gradeInfo = session.grade ? WAEC_GRADE_INFO[session.grade] : null;

  return (
    <div className="space-y-6">
      <Card className="border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 to-transparent">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Examination Complete</CardTitle>
          <CardDescription>{session.subject_name}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4 pb-8">
          <div className="text-center">
            <p className="text-5xl font-bold tabular-nums">{session.percentage}%</p>
            {session.grade ? (
              <p className={`mt-1 text-2xl font-semibold ${gradeInfo?.color ?? ""}`}>
                Grade {session.grade}
                {gradeInfo ? ` — ${gradeInfo.label}` : ""}
              </p>
            ) : null}
          </div>
          <div className="grid grid-cols-3 gap-4 text-center text-sm">
            <div className="rounded-lg border bg-card p-3">
              <p className="text-2xl font-bold text-emerald-600">{session.correct_count}</p>
              <p className="text-muted-foreground">Correct</p>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <p className="text-2xl font-bold text-red-600">{session.wrong_count}</p>
              <p className="text-muted-foreground">Wrong</p>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <p className="text-2xl font-bold text-amber-600">{session.unanswered_count}</p>
              <p className="text-muted-foreground">Skipped</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Score: {session.score}/{session.max_score} marks
          </p>
          <Button onClick={onDone}>Back to Practice Hub</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Answer Review</CardTitle>
          <CardDescription>Review each question with explanations</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {answers.map((a, i) => {
            const q = a.question;
            if (!q) return null;
            const status =
              a.selected_answer == null || a.selected_answer === ""
                ? "unanswered"
                : a.is_correct
                  ? "correct"
                  : "wrong";

            return (
              <div key={a.id} className="rounded-lg border p-4 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-medium text-sm">
                    Q{i + 1}. {q.question_text}
                  </p>
                  {status === "correct" ? (
                    <Badge className="bg-emerald-600/90 gap-1"><CheckCircle className="h-3 w-3" />Correct</Badge>
                  ) : status === "wrong" ? (
                    <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Wrong</Badge>
                  ) : (
                    <Badge variant="secondary" className="gap-1"><MinusCircle className="h-3 w-3" />Skipped</Badge>
                  )}
                </div>
                {q.options ? (
                  <div className="grid gap-1 text-sm">
                    {q.options.map((opt) => (
                      <p
                        key={opt.id}
                        className={
                          opt.id === q.correct_answer
                            ? "font-medium text-emerald-700 dark:text-emerald-400"
                            : opt.id === a.selected_answer
                              ? "font-medium text-red-600"
                              : "text-muted-foreground"
                        }
                      >
                        {opt.id}. {opt.text}
                        {opt.id === a.selected_answer && opt.id !== q.correct_answer ? " (your answer)" : ""}
                        {opt.id === q.correct_answer ? " ✓" : ""}
                      </p>
                    ))}
                  </div>
                ) : null}
                {q.explanation ? (
                  <div className="rounded-md bg-muted/50 p-3 text-sm">
                    <p className="font-medium text-foreground">Explanation</p>
                    <p className="text-muted-foreground mt-1">{q.explanation}</p>
                  </div>
                ) : null}
                {onAiHelp ? (
                  <Button variant="outline" size="sm" onClick={() => onAiHelp(q.question_text)}>
                    Ask AI Tutor
                  </Button>
                ) : null}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
