import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ExternalLink, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import {
  BILLING_INVOICES_SQL_PATH,
  resetBillingAvailabilityProbe,
} from "@/lib/billing/availability";

const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID as string | undefined;
const SQL_EDITOR_URL = PROJECT_ID
  ? `https://supabase.com/dashboard/project/${PROJECT_ID}/sql/new`
  : "https://supabase.com/dashboard";

type Props = {
  onRecheck?: () => void;
};

export function BillingInvoicesSchemaAlert({ onRecheck }: Props) {
  const [copied, setCopied] = useState(false);
  const [loadingSql, setLoadingSql] = useState(false);

  const copySql = async () => {
    setLoadingSql(true);
    try {
      const res = await fetch("/sql/apply-billing-invoices.sql");
      if (!res.ok) throw new Error("Could not load SQL file");
      const text = await res.text();
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("SQL copied — paste in Supabase SQL Editor and click Run");
      setTimeout(() => setCopied(false), 3000);
    } catch {
      toast.error(`Copy failed. Run ${BILLING_INVOICES_SQL_PATH} in Supabase SQL Editor.`);
    } finally {
      setLoadingSql(false);
    }
  };

  return (
    <Alert className="mb-4 border-amber-500/50 bg-amber-500/10">
      <AlertTitle>Billing invoices not installed</AlertTitle>
      <AlertDescription className="space-y-2 text-sm text-muted-foreground">
        <p>
          This app uses <code className="rounded bg-muted px-1 text-xs">billing_invoices</code>, not the
          legacy <code className="rounded bg-muted px-1 text-xs">invoices</code> table. Run the setup SQL
          once to create the billing tables.
        </p>
        <ol className="list-decimal space-y-1 pl-5">
          <li>Open Supabase SQL Editor</li>
          <li>Copy SQL → Run → Reload API schema</li>
          <li>Click Recheck below</li>
        </ol>
      </AlertDescription>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" onClick={() => void copySql()} disabled={loadingSql}>
          {copied ? <Check className="mr-1.5 h-4 w-4" /> : <Copy className="mr-1.5 h-4 w-4" />}
          {copied ? "Copied" : "Copy billing SQL"}
        </Button>
        <Button size="sm" variant="outline" asChild>
          <a href={SQL_EDITOR_URL} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-1.5 h-4 w-4" />
            SQL Editor
          </a>
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            resetBillingAvailabilityProbe();
            onRecheck?.();
          }}
        >
          Recheck
        </Button>
      </div>
    </Alert>
  );
}
