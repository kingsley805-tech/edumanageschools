import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import {
  aiReceptionistSchemaMissingLabels,
  type AiReceptionistSchemaStatus,
} from "@/modules/ai-receptionist/lib/schema";

type Props = {
  status: AiReceptionistSchemaStatus;
  checking: boolean;
  onRecheck: () => void;
};

export function AiReceptionistSchemaSetupCard({ status, checking, onRecheck }: Props) {
  const missing = aiReceptionistSchemaMissingLabels(status);

  return (
    <Card className="border-amber-500/40 bg-amber-500/5">
      <CardContent className="space-y-3 pt-6 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">AI Receptionist tables not installed</p>
        <p>
          Open the Supabase SQL Editor and run{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
            public/sql/apply-ai-receptionist.sql
          </code>{" "}
          to create the voice agent, knowledge base, calls, and follow-up tables. Then run{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
            NOTIFY pgrst, &apos;reload schema&apos;;
          </code>{" "}
          and refresh this page.
        </p>
        {missing.length ? (
          <p>
            Missing tables:{" "}
            <span className="font-mono text-xs text-foreground">{missing.join(", ")}</span>
          </p>
        ) : null}
        <Button variant="outline" size="sm" onClick={onRecheck} disabled={checking} className="gap-1.5">
          <RefreshCw className={`h-4 w-4 ${checking ? "animate-spin" : ""}`} />
          {checking ? "Checking…" : "Re-check"}
        </Button>
      </CardContent>
    </Card>
  );
}
