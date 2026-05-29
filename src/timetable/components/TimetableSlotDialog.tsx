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
import { dedupeSubjectOptions, readSubjectName } from "@/timetable/lib/subjectLabel";
import { formatTimeRange, isValidTimeRange, toTimeInputValue } from "@/timetable/lib/timeUtils";

export type TimetableSlotSaveData = {
  subject_id: string;
  teacher_id: string;
  start_time: string;
  end_time: string;
  room?: string;
};

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
  onSave: (data: TimetableSlotSaveData, entryId?: string) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const [subjectId, setSubjectId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("08:40");
  const [room, setRoom] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const periodDefaults = useMemo(() => {
    if (!period || period.period_type !== "period") return null;
    return {
      start: toTimeInputValue(period.start_time),
      end: toTimeInputValue(period.end_time),
      label: period.name,
    };
  }, [period]);

  useEffect(() => {
    if (!open) return;
    setSubjectId(entry?.subject_id ?? "");
    setTeacherId(entry?.teacher_id ?? "");
    setStartTime(toTimeInputValue(entry?.start_time ?? period?.start_time ?? "08:00"));
    setEndTime(toTimeInputValue(entry?.end_time ?? period?.end_time ?? "08:40"));
    setRoom(entry?.room ?? "");
    setFormError(null);
  }, [open, entry, period]);

  const subjectOptions = useMemo(() => {
    const list = [...classSubjects];
    if (entry?.subject_id && !list.some((s) => s.subjectId === entry.subject_id)) {
      list.push({
        subjectId: entry.subject_id,
        subjectName: readSubjectName(entry.subjects),
        teacherId: entry.teacher_id,
        teacherName: entry.teachers?.profiles?.full_name ?? null,
      });
    }
    return dedupeSubjectOptions(list).sort((a, b) => a.subjectName.localeCompare(b.subjectName));
  }, [classSubjects, entry]);

  const selectedSubject = subjectOptions.find((s) => s.subjectId === subjectId);

  const handleSubjectChange = (value: string) => {
    setSubjectId(value);
    setFormError(null);
    const match = subjectOptions.find((s) => s.subjectId === value);
    if (match?.teacherId) setTeacherId(match.teacherId);
  };

  const applyPeriodDefaults = () => {
    if (!periodDefaults) return;
    setStartTime(periodDefaults.start);
    setEndTime(periodDefaults.end);
    setFormError(null);
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
    if (!isValidTimeRange(startTime, endTime)) {
      setFormError("End time must be after start time.");
      return;
    }
    setSaving(true);
    try {
      await onSave(
        {
          subject_id: subjectId,
          teacher_id: teacherId,
          start_time: startTime,
          end_time: endTime,
          room: room.trim() || undefined,
        },
        entry?.id,
      );
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
            {periodDefaults ? ` · ${periodDefaults.label}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label>Time range</Label>
              {periodDefaults ? (
                <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={applyPeriodDefaults}>
                  Use {periodDefaults.label} ({periodDefaults.start}–{periodDefaults.end})
                </Button>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="timetable-start" className="text-xs text-muted-foreground">
                  Start
                </Label>
                <Input
                  id="timetable-start"
                  type="time"
                  value={startTime}
                  onChange={(e) => {
                    setStartTime(e.target.value);
                    setFormError(null);
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="timetable-end" className="text-xs text-muted-foreground">
                  End
                </Label>
                <Input
                  id="timetable-end"
                  type="time"
                  value={endTime}
                  onChange={(e) => {
                    setEndTime(e.target.value);
                    setFormError(null);
                  }}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{formatTimeRange(startTime, endTime)}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="timetable-subject">Subject</Label>
            {subjectOptions.length === 0 ? (
              <p className="text-sm text-muted-foreground rounded-md border border-dashed p-3">
                No subjects linked to this class. Assign subjects under Admin → Teachers or Subjects,
                then try again.
              </p>
            ) : (
              <>
                <Select value={subjectId || undefined} onValueChange={handleSubjectChange}>
                  <SelectTrigger id="timetable-subject">
                    <SelectValue placeholder="Select subject" />
                  </SelectTrigger>
                  <SelectContent>
                    {subjectOptions.map((s) => (
                      <SelectItem key={s.subjectId} value={s.subjectId} textValue={s.subjectName}>
                        {s.subjectName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedSubject?.teacherName ? (
                  <p className="text-xs text-muted-foreground">
                    Assigned teacher: {selectedSubject.teacherName}
                  </p>
                ) : null}
              </>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="timetable-teacher">Teacher</Label>
            {teachers.length === 0 ? (
              <p className="text-sm text-muted-foreground rounded-md border border-dashed p-3">
                No teachers found for this school.
              </p>
            ) : (
              <Select value={teacherId || undefined} onValueChange={(v) => { setTeacherId(v); setFormError(null); }}>
                <SelectTrigger id="timetable-teacher">
                  <SelectValue placeholder="Select teacher" />
                </SelectTrigger>
                <SelectContent>
                  {teachers.map((t) => (
                    <SelectItem
                      key={t.id}
                      value={t.id}
                      textValue={t.profiles?.full_name ?? "Teacher"}
                    >
                      {t.profiles?.full_name ?? "Teacher"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="timetable-room">Room (optional)</Label>
            <Input
              id="timetable-room"
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
