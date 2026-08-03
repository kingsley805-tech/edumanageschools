import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { AchievementsSchemaStatus } from "@/modules/achievements/lib/schema";
import { achievementsSchemaMissingLabels } from "@/modules/achievements/lib/schema";

type Props = {
  status: AchievementsSchemaStatus;
  checking?: boolean;
  onRecheck: () => void;
};

export function AchievementsSchemaSetupCard({ status, checking, onRecheck }: Props) {
  const missing = achievementsSchemaMissingLabels(status);
  return (
    <Card className="border-amber-500/40 bg-amber-500/5">
      <CardContent className="space-y-3 pt-6 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Achievements database setup required</p>
        <p>Run the SQL script in Supabase, then reload the schema cache.</p>
        {missing.length > 0 ? (
          <ul className="list-disc space-y-1 pl-5 text-foreground/90">
            {missing.map((item) => (
              <li key={item}>
                <code className="rounded bg-muted px-1 py-0.5 text-xs">{item}</code>
              </li>
            ))}
          </ul>
        ) : null}
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
              public/sql/apply-achievements-programs.sql
            </code>
          </li>
          <li>
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
              NOTIFY pgrst, &apos;reload schema&apos;;
            </code>
          </li>
        </ol>
        <Button type="button" variant="outline" size="sm" onClick={onRecheck} disabled={checking}>
          {checking ? "Checking…" : "Recheck database"}
        </Button>
      </CardContent>
    </Card>
  );
}
