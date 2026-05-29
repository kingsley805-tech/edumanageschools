import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { STATUS_BADGE_CLASS, STATUS_LABELS, type LessonNoteStatus } from "@/lesson-notes/lib/types";

export function LessonNoteStatusBadge({ status }: { status: LessonNoteStatus | string }) {
  const s = status as LessonNoteStatus;
  const label = STATUS_LABELS[s] ?? status;
  const cls = STATUS_BADGE_CLASS[s] ?? STATUS_BADGE_CLASS.draft;
  return (
    <Badge variant="outline" className={cn("text-xs font-medium capitalize", cls)}>
      {label}
    </Badge>
  );
}
