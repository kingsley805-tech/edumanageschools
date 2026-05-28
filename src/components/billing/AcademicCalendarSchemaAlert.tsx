import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ExternalLink, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { resetBillingAvailabilityProbe } from "@/lib/billing/availability";

const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID as string | undefined;

const SQL_EDITOR_URL = PROJECT_ID
  ? `https://supabase.com/dashboard/project/${PROJECT_ID}/sql/new`
  : "https://supabase.com/dashboard";

type Props = {
  onRecheck?: () => void;
};

export function AcademicCalendarSchemaAlert({ onRecheck }: Props) {
  const [copied, setCopied] = useState(false);
  const [loadingSql, setLoadingSql] = useState(false);

  const copySql = async () => {
    setLoadingSql(true);
    try {
      const res = await fetch("/sql/apply-academic-calendar.sql");
      if (!res.ok) throw new Error("Could not load SQL file");
      const text = await res.text();
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("SQL copied — paste in Supabase SQL Editor and click Run");
      setTimeout(() => setCopied(false), 3000);
    } catch {
      toast.error("Copy failed. Use the SQL block in the repo: public/sql/apply-academic-calendar.sql");
    } finally {
      setLoadingSql(false);
    }
  };

  const recheck = () => {
    resetBillingAvailabilityProbe();
    onRecheck?.();
  };

  return (
    <Alert className="mb-6 border-amber-500/50 bg-amber-500/10">
      <AlertTitle>Academic calendar not installed</AlertTitle>
      <AlertDescription className="space-y-3 text-sm text-muted-foreground">
        <p>
          The <code className="rounded bg-muted px-1 py-0.5 text-xs">academic_years</code> table is not
          on your Supabase database yet. This is a one-time setup.
        </p>
        <ol className="list-decimal space-y-1 pl-5">
          <li>
            Open{" "}
            <a
              href={SQL_EDITOR_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Supabase SQL Editor
            </a>
          </li>
          <li>Click <strong>Copy SQL</strong> below, paste into the editor, and click <strong>Run</strong></li>
          <li>
            Wait for success, then{" "}
            <a
              href={
                PROJECT_ID
                  ? `https://supabase.com/dashboard/project/${PROJECT_ID}/settings/api`
                  : SQL_EDITOR_URL
              }
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Settings → API → Reload schema
            </a>
          </li>
          <li>Return here and click <strong>Recheck</strong></li>
        </ol>
      </AlertDescription>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" variant="default" onClick={() => void copySql()} disabled={loadingSql}>
          {copied ? <Check className="mr-1.5 h-4 w-4" /> : <Copy className="mr-1.5 h-4 w-4" />}
          {copied ? "Copied" : "Copy SQL"}
        </Button>
        <Button size="sm" variant="outline" asChild>
          <a href={SQL_EDITOR_URL} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-1.5 h-4 w-4" />
            Open SQL Editor
          </a>
        </Button>
        <Button size="sm" variant="outline" onClick={recheck}>
          Recheck
        </Button>
      </div>
    </Alert>
  );
}
