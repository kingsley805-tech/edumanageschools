import { useEffect, useState } from "react";
import { fetchLessonNoteHistory } from "@/lesson-notes/lib/api";
import { LessonNoteStatusBadge } from "@/lesson-notes/components/LessonNoteStatusBadge";
import type { LessonNoteStatus } from "@/lesson-notes/lib/types";
import { Loader2 } from "lucide-react";

export function LessonNoteHistoryPanel({ noteId }: { noteId: string }) {
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<
    { id: string; from_status: string | null; to_status: string; actor_name: string | null; comment: string | null; created_at: string }[]
  >([]);
  const [comments, setComments] = useState<
    { id: string; author_name: string | null; author_role: string | null; body: string; created_at: string }[]
  >([]);
  const [versions, setVersions] = useState<
    { id: string; version_number: number; submitted_at: string }[]
  >([]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const h = await fetchLessonNoteHistory(noteId);
        setLogs(h.logs as typeof logs);
        setComments(h.comments as typeof comments);
        setVersions(h.versions as typeof versions);
      } finally {
        setLoading(false);
      }
    })();
  }, [noteId]);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-sm font-semibold mb-3">Status timeline</h4>
        {logs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity yet.</p>
        ) : (
          <ul className="space-y-3 border-l-2 border-border pl-4">
            {logs.map((log) => (
              <li key={log.id} className="relative">
                <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-primary" />
                <div className="flex flex-wrap items-center gap-2">
                  {log.from_status ? (
                    <LessonNoteStatusBadge status={log.from_status as LessonNoteStatus} />
                  ) : null}
                  <span className="text-muted-foreground text-xs">→</span>
                  <LessonNoteStatusBadge status={log.to_status as LessonNoteStatus} />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {log.actor_name ?? "System"} · {new Date(log.created_at).toLocaleString()}
                </p>
                {log.comment ? <p className="text-sm mt-1">{log.comment}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      {versions.length > 0 ? (
        <div>
          <h4 className="text-sm font-semibold mb-2">Submitted versions</h4>
          <ul className="text-sm space-y-1 text-muted-foreground">
            {versions.map((v) => (
              <li key={v.id}>
                Version {v.version_number} · {new Date(v.submitted_at).toLocaleString()}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {comments.length > 0 ? (
        <div>
          <h4 className="text-sm font-semibold mb-2">Admin comments</h4>
          <ul className="space-y-3">
            {comments.map((c) => (
              <li key={c.id} className="rounded-lg border bg-muted/30 p-3 text-sm">
                <p className="font-medium text-xs text-muted-foreground mb-1">
                  {c.author_name ?? "Reviewer"} ({c.author_role}) · {new Date(c.created_at).toLocaleString()}
                </p>
                <p className="whitespace-pre-wrap">{c.body}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
