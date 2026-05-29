import { useEffect, useState } from "react";
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
import type { TimetablePeriod } from "@/timetable/lib/types";
import { formatTimeRange, isValidTimeRange, toTimeInputValue } from "@/timetable/lib/timeUtils";

export function TimetableBellSlotDialog({
  open,
  onOpenChange,
  period,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  period: TimetablePeriod | null;
  onSave: (startTime: string, endTime: string) => Promise<void>;
}) {
  const [startTime, setStartTime] = useState("09:20");
  const [endTime, setEndTime] = useState("09:40");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !period) return;
    setStartTime(toTimeInputValue(period.start_time));
    setEndTime(toTimeInputValue(period.end_time));
    setFormError(null);
  }, [open, period]);

  const handleSave = async () => {
    if (!isValidTimeRange(startTime, endTime)) {
      setFormError("End time must be after start time.");
      return;
    }
    setSaving(true);
    try {
      await onSave(startTime, endTime);
      onOpenChange(false);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  if (!period) return null;

  const label = period.period_type === "lunch" ? "Lunch" : period.name;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit {label}</DialogTitle>
          <DialogDescription>Set when {label.toLowerCase()} starts and ends on the timetable.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="bell-start" className="text-xs text-muted-foreground">
                Start
              </Label>
              <Input
                id="bell-start"
                type="time"
                value={startTime}
                onChange={(e) => {
                  setStartTime(e.target.value);
                  setFormError(null);
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bell-end" className="text-xs text-muted-foreground">
                End
              </Label>
              <Input
                id="bell-end"
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
          {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleSave()} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
