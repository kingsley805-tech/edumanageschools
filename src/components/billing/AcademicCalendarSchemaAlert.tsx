import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  ACADEMIC_CALENDAR_SQL_PATH,
  resetBillingAvailabilityProbe,
} from "@/lib/billing/availability";

type Props = {
  onRecheck?: () => void;
};

export function AcademicCalendarSchemaAlert({ onRecheck }: Props) {
  return (
    <Alert className="mb-6 border-amber-500/40 bg-amber-500/10">
      <AlertTitle>Academic calendar not installed</AlertTitle>
      <AlertDescription className="text-sm text-muted-foreground">
        The <code className="rounded bg-muted px-1 py-0.5 text-xs">academic_years</code> table is
        missing in Supabase. In the SQL Editor, run{" "}
        <code className="rounded bg-muted px-1 py-0.5 text-xs">{ACADEMIC_CALENDAR_SQL_PATH}</code>{" "}
        (or run <code className="rounded bg-muted px-1 py-0.5 text-xs">supabase db push</code>), then
        open <strong>Settings → API → Reload schema</strong> and click Recheck below.
      </AlertDescription>
      <div className="mt-3">
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            resetBillingAvailabilityProbe();
            onRecheck?.();
          }}
        >
          Recheck tables
        </Button>
      </div>
    </Alert>
  );
}
