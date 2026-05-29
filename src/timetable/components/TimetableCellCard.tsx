import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ScheduleEntry } from "@/timetable/lib/types";
import { subjectColorStyle } from "@/timetable/lib/subjectColors";
import { readSubjectName } from "@/timetable/lib/subjectLabel";
import { formatTimeRange } from "@/timetable/lib/timeUtils";
import { AlertCircle, Plus } from "lucide-react";

export function TimetableCellCard({
  entry,
  hasConflict,
  editable,
  onClick,
  onDragStart,
  onDragOver,
  onDrop,
}: {
  entry?: ScheduleEntry | null;
  hasConflict?: boolean;
  editable?: boolean;
  onClick?: () => void;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
}) {
  if (!entry) {
    return (
      <button
        type="button"
        onClick={onClick}
        onDragOver={onDragOver}
        onDrop={onDrop}
        className={cn(
          "flex min-h-[88px] w-full items-center justify-center rounded-xl border border-dashed border-border/80",
          "bg-muted/20 text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/5",
          editable && "cursor-pointer",
        )}
      >
        {editable ? <Plus className="h-5 w-5" /> : <span className="text-xs">—</span>}
      </button>
    );
  }

  const style = subjectColorStyle(entry.subject_id);

  return (
    <div
      role="button"
      tabIndex={0}
      draggable={editable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onClick={onClick}
      onKeyDown={(e) => e.key === "Enter" && onClick?.()}
      className={cn(
        "relative min-h-[88px] rounded-xl border p-2.5 text-left transition-shadow hover:shadow-md",
        editable && "cursor-grab active:cursor-grabbing",
      )}
      style={style}
    >
      {hasConflict ? (
        <Badge variant="destructive" className="absolute -right-1 -top-1 h-5 px-1.5 text-[10px] gap-0.5">
          <AlertCircle className="h-3 w-3" />
          Conflict
        </Badge>
      ) : null}
      <p className="text-[10px] font-medium opacity-80 line-clamp-1">
        {formatTimeRange(entry.start_time, entry.end_time)}
      </p>
      <p className="text-[11px] font-bold uppercase tracking-wide opacity-90 line-clamp-1 mt-0.5">
        {readSubjectName(entry.subjects)}
      </p>
      <p className="text-xs font-medium mt-0.5 line-clamp-1">{entry.teachers?.profiles?.full_name ?? "—"}</p>
      {entry.room ? <p className="text-[10px] opacity-80 mt-1">{entry.room}</p> : null}
    </div>
  );
}
