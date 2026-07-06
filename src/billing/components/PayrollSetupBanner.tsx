import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PAYROLL_SETUP_SQL_PATH, PAYROLL_SETUP_SQL_URL } from "@/billing/lib/payrollTeachers";

export function PayrollSetupBanner() {
  return (
    <Alert variant="destructive">
      <AlertTitle>Payroll database not set up</AlertTitle>
      <AlertDescription className="space-y-2">
        <p>
          The payroll tables and RPC are missing from your Supabase project. Run the setup script once, then reload
          the API schema.
        </p>
        <ol className="list-decimal space-y-1 pl-5">
          <li>
            Open the{" "}
            <a href={PAYROLL_SETUP_SQL_URL} target="_blank" rel="noreferrer" className="underline">
              Supabase SQL Editor
            </a>
          </li>
          <li>
            Paste and run the full contents of <code>{PAYROLL_SETUP_SQL_PATH}</code>
          </li>
          <li>Go to Settings → API → Reload schema (or wait a few seconds)</li>
          <li>Refresh this page</li>
        </ol>
      </AlertDescription>
    </Alert>
  );
}
