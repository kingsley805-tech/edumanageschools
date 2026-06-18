import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createLiveClass } from "@/live-classes/lib/api";
import type { RecurrenceType } from "@/live-classes/lib/types";

type Props = {
  schoolId: string;
  teacherId: string;
  classes: { id: string; name: string }[];
  subjects: { id: string; name: string }[];
  onCreated?: () => void;
};

const WEEKDAYS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
];

export function CreateLiveClassDialog({
  schoolId,
  teacherId,
  classes,
  subjects,
  onCreated,
}: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [sessionDate, setSessionDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>("none");
  const [recurrenceEndDate, setRecurrenceEndDate] = useState("");
  const [weekDays, setWeekDays] = useState<number[]>([1, 3, 5]);
  const [recordingEnabled, setRecordingEnabled] = useState(false);

  useEffect(() => {
    if (classes.length && !classId) setClassId(classes[0].id);
    if (subjects.length && !subjectId) setSubjectId(subjects[0].id);
  }, [classes, subjects, classId, subjectId]);

  const handleSubmit = async () => {
    if (!classId || !subjectId || !title || !sessionDate) {
      toast.error("Fill in all required fields");
      return;
    }
    setSaving(true);
    try {
      const result = await createLiveClass({
        schoolId,
        classId,
        subjectId,
        teacherId,
        title,
        description,
        sessionDate,
        startTime: startTime.length === 5 ? `${startTime}:00` : startTime,
        endTime: endTime.length === 5 ? `${endTime}:00` : endTime,
        recurrenceType,
        recurrenceEndDate: recurrenceEndDate || undefined,
        recurrenceRule: recurrenceType === "weekly" ? { daysOfWeek: weekDays } : undefined,
        recordingEnabled,
      });
      toast.success(`Live class created · ${result.sessions.length} session(s)`);
      setOpen(false);
      onCreated?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create live class");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Create Live Class
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Schedule Google Meet Class</DialogTitle>
          <DialogDescription>
            Creates a Google Calendar event with a Meet link. Your school admin must connect Google Workspace first.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Class name *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Mathematics Live Session" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Class / Grade *</Label>
              <Select value={classId} onValueChange={setClassId}>
                <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                <SelectContent>
                  {classes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Subject *</Label>
              <Select value={subjectId} onValueChange={setSubjectId}>
                <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                <SelectContent>
                  {subjects.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Date *</Label>
              <Input type="date" value={sessionDate} onChange={(e) => setSessionDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Start</Label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>End</Label>
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Recurrence</Label>
            <Select value={recurrenceType} onValueChange={(v) => setRecurrenceType(v as RecurrenceType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">One-time</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {recurrenceType !== "none" && (
            <div className="space-y-2">
              <Label>Repeat until</Label>
              <Input type="date" value={recurrenceEndDate} onChange={(e) => setRecurrenceEndDate(e.target.value)} />
            </div>
          )}
          {recurrenceType === "weekly" && (
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map((d) => (
                <label key={d.value} className="flex items-center gap-1 text-sm">
                  <Checkbox
                    checked={weekDays.includes(d.value)}
                    onCheckedChange={(checked) => {
                      setWeekDays((prev) =>
                        checked ? [...prev, d.value] : prev.filter((x) => x !== d.value),
                      );
                    }}
                  />
                  {d.label}
                </label>
              ))}
            </div>
          )}
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={recordingEnabled} onCheckedChange={(c) => setRecordingEnabled(!!c)} />
            Enable recording (when supported by Google Workspace)
          </label>
          <Button className="w-full" onClick={handleSubmit} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Create & Generate Meet Link
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
