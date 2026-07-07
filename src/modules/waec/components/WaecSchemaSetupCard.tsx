import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { WaecSchemaStatus } from "@/modules/waec/lib/schema";

type Props = {
  status: WaecSchemaStatus;
  checking?: boolean;
  onRecheck: () => void;
};

export function WaecSchemaSetupCard({ checking, onRecheck }: Props) {
  return (
    <Card className="border-amber-500/40 bg-amber-500/5">
      <CardContent className="space-y-3 pt-6 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">WAEC platform database setup required</p>
        <p>Run the SQL script below in Supabase, then reload the schema cache.</p>
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">public/sql/apply-waec-platform.sql</code>
          </li>
          <li>
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">public/sql/apply-waec-questions-bank.sql</code>
            <span className="text-foreground/80"> — all BECE & WASSCE subjects, years 2010–2025</span>
          </li>
          <li>
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">public/sql/apply-waec-ai-generation.sql</code>
            <span className="text-foreground/80"> — enables the AI question generator & approval queue</span>
          </li>
          <li>
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">NOTIFY pgrst, &apos;reload schema&apos;;</code>
          </li>
        </ol>
        <Button type="button" variant="outline" size="sm" onClick={onRecheck} disabled={checking}>
          {checking ? "Checking…" : "Recheck database"}
        </Button>
      </CardContent>
    </Card>
  );
}
