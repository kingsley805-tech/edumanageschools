import { useCallback, useEffect, useState } from "react";
import { Check, CheckCheck, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  approveWaecDraftsForSubject,
  fetchWaecQuestionsByStatus,
  setWaecQuestionStatus,
} from "@/modules/waec/lib/api";
import type { WaecQuestion, WaecSubject } from "@/modules/waec/lib/types";
import { WAEC_LEVEL_LABELS } from "@/modules/waec/lib/types";
import { toast } from "sonner";

type Props = {
  subjects: WaecSubject[];
  onChange: () => void;
};

export function WaecApprovalQueue({ subjects, onChange }: Props) {
  const [filterSubject, setFilterSubject] = useState("");
  const [drafts, setDrafts] = useState<WaecQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchWaecQuestionsByStatus("draft", {
        subjectId: filterSubject || undefined,
      });
      setDrafts(rows);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load drafts");
    } finally {
      setLoading(false);
    }
  }, [filterSubject]);

  useEffect(() => {
    void load();
  }, [load]);

  const review = async (id: string, status: "approved" | "rejected") => {
    setBusyId(id);
    try {
      await setWaecQuestionStatus(id, status);
      setDrafts((prev) => prev.filter((q) => q.id !== id));
      onChange();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusyId(null);
    }
  };

  const approveAll = async () => {
    if (!filterSubject) {
      toast.error("Choose a subject to bulk-approve.");
      return;
    }
    try {
      const n = await approveWaecDraftsForSubject(filterSubject);
      toast.success(`Approved ${n} question(s).`);
      void load();
      onChange();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bulk approve failed");
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle className="text-base">Approval Queue</CardTitle>
          <CardDescription>{drafts.length} draft(s) awaiting review</CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={filterSubject || "all"} onValueChange={(v) => setFilterSubject(v === "all" ? "" : v)}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Subject" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All subjects</SelectItem>
              {subjects.map((s) => (
                <SelectItem key={s.id} value={s.id}>{WAEC_LEVEL_LABELS[s.level]} — {s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => void approveAll()} disabled={!filterSubject || drafts.length === 0}>
            <CheckCheck className="h-4 w-4" />
            Approve all
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {drafts.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No drafts to review. Generate questions in the AI Generator tab.
          </p>
        ) : (
          drafts.map((q) => (
            <div key={q.id} className="rounded-lg border p-3 text-sm">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{q.subject_name}</Badge>
                {q.topic ? <Badge variant="outline">{q.topic}</Badge> : null}
                <Badge variant="outline" className="capitalize">{q.difficulty}</Badge>
                <Badge variant="outline" className="capitalize">{q.question_type ?? "objective"}</Badge>
                <Badge variant="outline">{q.marks} mark{q.marks === 1 ? "" : "s"}</Badge>
                {q.estimated_time_seconds ? (
                  <Badge variant="outline">{q.estimated_time_seconds}s</Badge>
                ) : null}
              </div>

              <p className="font-medium">{q.question_text}</p>

              {q.options?.length ? (
                <ul className="mt-2 space-y-1">
                  {q.options.map((o) => (
                    <li
                      key={o.id}
                      className={
                        o.id === q.correct_answer
                          ? "font-semibold text-emerald-600"
                          : "text-muted-foreground"
                      }
                    >
                      {o.id}. {o.text}
                      {o.id === q.correct_answer ? " ✓" : ""}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="mt-2 space-y-1">
                  <p><span className="font-medium">Answer:</span> {q.correct_answer}</p>
                  {q.marking_scheme ? (
                    <p className="text-xs text-muted-foreground"><span className="font-medium">Marking:</span> {q.marking_scheme}</p>
                  ) : null}
                </div>
              )}

              {q.explanation ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  <span className="font-medium">Explanation:</span> {q.explanation}
                </p>
              ) : null}

              <div className="mt-3 flex gap-2">
                <Button size="sm" className="gap-1.5" onClick={() => void review(q.id, "approved")} disabled={busyId === q.id}>
                  <Check className="h-4 w-4" />
                  Approve
                </Button>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => void review(q.id, "rejected")} disabled={busyId === q.id}>
                  <X className="h-4 w-4" />
                  Reject
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
