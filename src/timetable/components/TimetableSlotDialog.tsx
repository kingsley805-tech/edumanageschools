import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ClassSubjectOption, ScheduleEntry, TimetablePeriod } from "@/timetable/lib/types";
import { WEEKDAYS } from "@/timetable/lib/types";

export function TimetableSlotDialog({
  open,
  onOpenChange,
  entry,
  dayOfWeek,
  period,
  className,
  classSubjects,
  teachers,
  onSave,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  entry?: ScheduleEntry | null;
  dayOfWeek: number;
  period?: TimetablePeriod | null;
  className: string;
  classSubjects: ClassSubjectOption[];
  teachers: { id: string; profiles?: { full_name: string } | null }[];
  onSave: (data: { subject_id: string; teacher_id: string; room?: string }) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const [subjectId, setSubjectId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [room, setRoom] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSubjectId(entry?.subject_id ?? "");
    setTeacherId(entry?.teacher_id ?? "");
    setRoom(entry?.room ?? "");
    setFormError(null);
  }, [open, entry]);

  const subjectOptions = useMemo(() => {
    const byId = new Map<string, ClassSubjectOption>();
    for (const s of classSubjects) byId.set(s.subjectId, s);
    if (entry?.subject_id && !byId.has(entry.subject_id)) {
      byId.set(entry.subject_id, {
        subjectId: entry.subject_id,
        subjectName: entry.subjects?.name ?? "Subject",
        teacherId: entry.teacher_id,
        teacherName: entry.teachers?.profiles?.full_name ?? null,
      });
    }
    return [...byId.values()].sort((a, b) => a.subjectName.localeCompare(b.subjectName));
  }, [classSubjects, entry]);

  const handleSubjectChange = (value: string) => {
    setSubjectId(value);
    setFormError(null);
    const match = subjectOptions.find((s) => s.subjectId === value);
    if (match?.teacherId) setTeacherId(match.teacherId);
  };

  const handleSave = async () => {
    if (!subjectId) {
      setFormError("Please select a subject.");
      return;
    }
    if (!teacherId) {
      setFormError("Please select a teacher.");
      return;
    }
    setSaving(true);
    try {
      await onSave({ subject_id: subjectId, teacher_id: teacherId, room: room.trim() || undefined });
      onOpenChange(false);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Could not save period");
    } finally {
      setSaving(false);
    }
  };

  const dayLabel = WEEKDAYS.find((d) => d.value === dayOfWeek)?.label ?? "Day";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{entry ? "Edit" : "Add"} period</DialogTitle>
          <DialogDescription>
            {className} · {dayLabel}
            {period
              ? ` · ${period.name} (${period.start_time.slice(0, 5)} – ${period.end_time.slice(0, 5)})`
              : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Subject</Label>
            {subjectOptions.length === 0 ? (
              <p className="text-sm text-muted-foreground rounded-md border border-dashed p-3">
                No subjects linked to this class. Assign subjects under Admin → Teachers or Subjects,
                then try again.
              </p>
            ) : (
              <Select value={subjectId || undefined} onValueChange={handleSubjectChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select subject" />
                </SelectTrigger>
                <SelectContent>
                  {subjectOptions.map((s) => (
                    <SelectItem key={s.subjectId} value={s.subjectId}>
                      {s.subjectName}
                      {s.teacherName ? ` · ${s.teacherName}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <Label>Teacher</Label>
            {teachers.length === 0 ? (
              <p className="text-sm text-muted-foreground rounded-md border border-dashed p-3">
                No teachers found for this school.
              </p>
            ) : (
              <Select value={teacherId || undefined} onValueChange={(v) => { setTeacherId(v); setFormError(null); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select teacher" />
                </SelectTrigger>
                <SelectContent>
                  {teachers.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.profiles?.full_name ?? "Teacher"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <Label>Room (optional)</Label>
            <Input
              placeholder="e.g. Room 4B"
              value={room}
              onChange={(e) => setRoom(e.target.value)}
            />
          </div>

          {formError ? <p className="text-sm text-destructive">{formError}</p> : null}

          <div className="flex justify-between gap-2 pt-2">
            {entry && onDelete ? (
              <Button type="button" variant="destructive" onClick={() => void onDelete()} disabled={saving}>
                Remove
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving || subjectOptions.length === 0 || teachers.length === 0}
              >
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
