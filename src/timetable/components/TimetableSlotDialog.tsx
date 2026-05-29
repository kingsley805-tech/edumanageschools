import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import type { ScheduleEntry, TimetablePeriod } from "@/timetable/lib/types";
import { WEEKDAYS } from "@/timetable/lib/types";

const schema = z.object({
  subject_id: z.string().min(1),
  teacher_id: z.string().min(1),
  room: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export function TimetableSlotDialog({
  open,
  onOpenChange,
  entry,
  dayOfWeek,
  period,
  subjects,
  teachers,
  onSave,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  entry?: ScheduleEntry | null;
  dayOfWeek: number;
  period?: TimetablePeriod | null;
  subjects: { id: string; name: string }[];
  teachers: { id: string; profiles?: { full_name: string } | null }[];
  onSave: (data: FormData) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const { register, handleSubmit, setValue, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (open) {
      reset({
        subject_id: entry?.subject_id ?? "",
        teacher_id: entry?.teacher_id ?? "",
        room: entry?.room ?? "",
      });
    }
  }, [open, entry, reset]);

  const dayLabel = WEEKDAYS.find((d) => d.value === dayOfWeek)?.label ?? "Day";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{entry ? "Edit" : "Add"} period</DialogTitle>
          <DialogDescription>
            {dayLabel}
            {period ? ` · ${period.name} (${period.start_time.slice(0, 5)} – ${period.end_time.slice(0, 5)})` : ""}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={handleSubmit(async (data) => {
            await onSave(data);
            onOpenChange(false);
          })}
        >
          <div className="space-y-2">
            <Label>Subject</Label>
            <Select value={undefined} onValueChange={(v) => setValue("subject_id", v)} defaultValue={entry?.subject_id}>
              <SelectTrigger>
                <SelectValue placeholder="Select subject" />
              </SelectTrigger>
              <SelectContent>
                {subjects.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.subject_id ? <p className="text-xs text-destructive">{errors.subject_id.message}</p> : null}
          </div>
          <div className="space-y-2">
            <Label>Teacher</Label>
            <Select onValueChange={(v) => setValue("teacher_id", v)} defaultValue={entry?.teacher_id ?? undefined}>
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
          </div>
          <div className="space-y-2">
            <Label>Room</Label>
            <Input placeholder="e.g. Room 4B" {...register("room")} />
          </div>
          <div className="flex justify-between gap-2 pt-2">
            {entry && onDelete ? (
              <Button type="button" variant="destructive" onClick={() => void onDelete()}>
                Remove
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                Save
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
