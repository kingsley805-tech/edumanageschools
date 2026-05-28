import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { BILLING_SETUP_SQL_PATH, resetBillingAvailabilityProbe } from "@/lib/billing/availability";

type Props = {
  onRecheck?: () => void;
};

export function BillingSchemaAlert({ onRecheck }: Props) {
  return (
    <Alert className="mb-6 border-amber-500/40 bg-amber-500/10 text-amber-50">
      <AlertTitle>Billing tables not installed</AlertTitle>
      <AlertDescription>
        The <code className="rounded bg-black/30 px-1 py-0.5 text-xs">fee_categories</code> table is
        missing in Supabase. Run{" "}
        <code className="rounded bg-black/30 px-1 py-0.5 text-xs">{BILLING_SETUP_SQL_PATH}</code> or{" "}
        <code className="rounded bg-black/30 px-1 py-0.5 text-xs">
          supabase/migrations/20260528130000_fee_categories_billing_tables.sql
        </code>{" "}
        in the SQL Editor (or run <code className="rounded bg-black/30 px-1 py-0.5 text-xs">supabase db push</code>),
        then reload the API schema (Settings → API).
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
          Recheck billing tables
        </Button>
      </div>
    </Alert>
  );
}
