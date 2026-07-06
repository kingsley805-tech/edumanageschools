import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { TransportSchemaStatus } from "@/modules/transport/lib/schema";
import { transportSchemaMissingLabels } from "@/modules/transport/lib/schema";

type Props = {
  status: TransportSchemaStatus;
  onRecheck: () => void;
  checking?: boolean;
};

export function TransportSchemaSetupCard({ status, onRecheck, checking }: Props) {
  const missing = transportSchemaMissingLabels(status);
  const needsBase = !status.routes;
  const needsManagement =
    status.routes &&
    (!status.buses || !status.stops || !status.assignments || !status.rpcReport || !status.rpcAssign);

  const primaryScript = needsBase
    ? "public/sql/apply-operations-modules.sql"
    : "public/sql/apply-transport-management.sql";

  const secondaryScript = needsBase
    ? "public/sql/apply-transport-tables.sql (transport only)"
    : "public/sql/apply-transport-full.sql (all transport in one file)";

  return (
    <Card className="border-amber-500/40 bg-amber-500/5">
      <CardContent className="space-y-3 pt-6 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Transport database setup required</p>
        <p>
          This page talks to your <strong>Supabase project</strong>. The banner stays until the tables
          below exist in that database and PostgREST reloads its schema cache.
        </p>
        {missing.length > 0 ? (
          <ul className="list-disc space-y-1 pl-5 text-foreground/90">
            {missing.map((item) => (
              <li key={item}>
                <code className="rounded bg-muted px-1 py-0.5 text-xs">{item}</code> — not found
              </li>
            ))}
          </ul>
        ) : null}
        <div className="space-y-2 rounded-lg border bg-background/60 p-3">
          <p className="font-medium text-foreground">Run in Supabase → SQL Editor</p>
          {needsBase ? (
            <ol className="list-decimal space-y-2 pl-5">
              <li>
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{primaryScript}</code>
              </li>
              <li>
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                  public/sql/apply-transport-management.sql
                </code>
              </li>
              <li>
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                  NOTIFY pgrst, &apos;reload schema&apos;;
                </code>
              </li>
            </ol>
          ) : needsManagement ? (
            <ol className="list-decimal space-y-2 pl-5">
              <li>
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{primaryScript}</code>
              </li>
              <li>
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                  NOTIFY pgrst, &apos;reload schema&apos;;
                </code>
              </li>
            </ol>
          ) : null}
          <p className="text-xs">
            Shortcut:{" "}
            <code className="rounded bg-muted px-1 py-0.5">{secondaryScript}</code>
          </p>
        </div>
        <p className="text-xs">
          If you already ran the scripts, you may have applied them to a different Supabase project than
          this app uses, or the schema cache was not reloaded. Click recheck after running{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">NOTIFY pgrst, &apos;reload schema&apos;;</code>
        </p>
        <Button type="button" variant="outline" size="sm" onClick={onRecheck} disabled={checking}>
          {checking ? "Checking…" : "Recheck database"}
        </Button>
      </CardContent>
    </Card>
  );
}
