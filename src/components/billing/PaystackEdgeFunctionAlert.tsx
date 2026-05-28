import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Copy, Terminal } from "lucide-react";
import { toast } from "sonner";

const PROJECT_REF = "xbhhpjtwawfawifhpxbe";

const DEPLOY_COMMANDS = `cd school-hub
supabase login
supabase link --project-ref ${PROJECT_REF}
supabase functions deploy paystack
supabase secrets set PAYMENT_SECRETS_ENCRYPTION_KEY=YOUR_BASE64_32_BYTE_KEY`;

type Props = {
  detail?: string;
};

export function PaystackEdgeFunctionAlert({ detail }: Props) {
  const copyCommands = async () => {
    try {
      await navigator.clipboard.writeText(DEPLOY_COMMANDS);
      toast.success("Deploy commands copied");
    } catch {
      toast.error("Could not copy");
    }
  };

  return (
    <Alert className="border-amber-500/50 bg-amber-500/10">
      <Terminal className="h-4 w-4" />
      <AlertTitle>Deploy the Paystack Edge Function</AlertTitle>
      <AlertDescription className="space-y-3 text-sm">
        <p>
          Saving keys, testing the connection, and decrypting secrets require the <strong>paystack</strong> Edge
          Function on your Supabase project. Public settings may still display from the database.
        </p>
        {detail ? (
          <p className="rounded-md bg-background/60 px-2 py-1.5 font-mono text-xs text-muted-foreground">{detail}</p>
        ) : null}
        <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
          <li>
            Open{" "}
            <a
              href={`https://supabase.com/dashboard/project/${PROJECT_REF}/functions`}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-primary underline"
            >
              Supabase → Edge Functions
            </a>{" "}
            and confirm <code className="text-xs">paystack</code> is deployed and active.
          </li>
          <li>
            Under <strong>Secrets</strong>, set <code className="text-xs">PAYMENT_SECRETS_ENCRYPTION_KEY</code> (base64,
            32 bytes). Generate one:{" "}
            <code className="text-xs">node -e &quot;console.log(require(&apos;crypto&apos;).randomBytes(32).toString(&apos;base64&apos;))&quot;</code>
          </li>
          <li>Or deploy from your machine with the Supabase CLI (commands below).</li>
        </ol>
        <pre className="max-h-32 overflow-auto rounded-md bg-muted p-2 text-xs">{DEPLOY_COMMANDS}</pre>
        <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => void copyCommands()}>
          <Copy className="h-3.5 w-3.5" />
          Copy deploy commands
        </Button>
      </AlertDescription>
    </Alert>
  );
}
