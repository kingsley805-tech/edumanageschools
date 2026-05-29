import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { formatTimeRange } from "@/timetable/lib/timeUtils";

export type BellScheduleForm = {
  school_open_time: string;
  school_close_time: string;
  break_start_time: string;
  break_end_time: string;
  lunch_start_time: string;
  lunch_end_time: string;
  period_duration_minutes: number;
  periods_per_day: number;
  include_saturday: boolean;
};

export function BellScheduleSettings({
  form,
  onChange,
  onSave,
  saving,
}: {
  form: BellScheduleForm;
  onChange: (patch: Partial<BellScheduleForm>) => void;
  onSave: () => void;
  saving?: boolean;
}) {
  return (
    <div className="grid gap-6 max-w-2xl">
      <section className="space-y-3">
        <h3 className="text-sm font-semibold">School hours</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="school-open">Opening time</Label>
            <Input
              id="school-open"
              type="time"
              value={form.school_open_time}
              onChange={(e) => onChange({ school_open_time: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="school-close">Closing time</Label>
            <Input
              id="school-close"
              type="time"
              value={form.school_close_time}
              onChange={(e) => onChange({ school_close_time: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">Shown at the bottom of every timetable grid.</p>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Break</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="break-start">Start</Label>
            <Input
              id="break-start"
              type="time"
              value={form.break_start_time}
              onChange={(e) => onChange({ break_start_time: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="break-end">End</Label>
            <Input
              id="break-end"
              type="time"
              value={form.break_end_time}
              onChange={(e) => onChange({ break_end_time: e.target.value })}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Grid row: Break · {formatTimeRange(form.break_start_time, form.break_end_time)}
        </p>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Lunch</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="lunch-start">Start</Label>
            <Input
              id="lunch-start"
              type="time"
              value={form.lunch_start_time}
              onChange={(e) => onChange({ lunch_start_time: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lunch-end">End</Label>
            <Input
              id="lunch-end"
              type="time"
              value={form.lunch_end_time}
              onChange={(e) => onChange({ lunch_end_time: e.target.value })}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Grid row: Lunch · {formatTimeRange(form.lunch_start_time, form.lunch_end_time)}
        </p>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Teaching periods</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="period-duration">Default period length (min)</Label>
            <Input
              id="period-duration"
              type="number"
              min={20}
              max={120}
              value={form.period_duration_minutes}
              onChange={(e) => onChange({ period_duration_minutes: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="periods-per-day">Periods per day</Label>
            <Input
              id="periods-per-day"
              type="number"
              min={4}
              max={12}
              value={form.periods_per_day}
              onChange={(e) => onChange({ periods_per_day: Number(e.target.value) })}
            />
          </div>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border p-3">
          <div>
            <p className="text-sm font-medium">Include Saturday</p>
            <p className="text-xs text-muted-foreground">Show Saturday column on the grid</p>
          </div>
          <Switch
            checked={form.include_saturday}
            onCheckedChange={(v) => onChange({ include_saturday: v })}
          />
        </div>
      </section>

      <Button onClick={onSave} disabled={saving} className="w-fit">
        {saving ? "Saving…" : "Save bell schedule"}
      </Button>
    </div>
  );
}
