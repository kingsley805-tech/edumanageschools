import { Card, CardContent } from "@/components/ui/card";

type Props = {
  moduleLabel: string;
  quickScript?: string;
};

export function OperationsSchemaSetupCard({ moduleLabel, quickScript }: Props) {
  return (
    <Card className="border-amber-500/40 bg-amber-500/5">
      <CardContent className="pt-6 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">{moduleLabel} tables not installed</p>
        <p className="mt-2">
          Open the Supabase SQL Editor and run{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">public/sql/apply-operations-modules.sql</code>{" "}
          to create Transport, Hostel, Library, Inventory, and HR tables in one step
          {quickScript ? (
            <>
              {" "}
              (or <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{quickScript}</code> for this module only)
            </>
          ) : null}
          . Then run{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">NOTIFY pgrst, 'reload schema';</code> and refresh
          this page.
        </p>
      </CardContent>
    </Card>
  );
}
