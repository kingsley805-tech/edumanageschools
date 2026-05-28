import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Copy, Check, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import {
  PAYMENT_GATEWAY_SQL_PATH,
  resetPaymentGatewaySchemaProbe,
} from "@/lib/billing/gatewayAvailability";

const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID as string | undefined;
const SQL_EDITOR_URL = PROJECT_ID
  ? `https://supabase.com/dashboard/project/${PROJECT_ID}/sql/new`
  : "https://supabase.com/dashboard";

type Props = { onRecheck?: () => void };

export function PaymentGatewaySchemaAlert({ onRecheck }: Props) {
  const [copied, setCopied] = useState(false);

  const copySql = async () => {
    try {
      const res = await fetch("/sql/apply-payment-gateway.sql");
      if (!res.ok) throw new Error("Could not load SQL");
      await navigator.clipboard.writeText(await res.text());
      setCopied(true);
      toast.success("SQL copied — run in Supabase SQL Editor");
      setTimeout(() => setCopied(false), 3000);
    } catch {
      toast.error(`Run ${PAYMENT_GATEWAY_SQL_PATH} in Supabase`);
    }
  };

  return (
    <Alert className="border-amber-500/50 bg-amber-500/10">
      <AlertTitle>Payment gateway tables not installed</AlertTitle>
      <AlertDescription className="space-y-2 text-sm text-muted-foreground">
        <p>
          Run the payment gateway migration, then deploy the <code className="rounded bg-muted px-1 text-xs">paystack</code>{" "}
          Edge Function with <code className="rounded bg-muted px-1 text-xs">PAYMENT_SECRETS_ENCRYPTION_KEY</code>.
        </p>
        <p>Also ensure <code className="rounded bg-muted px-1 text-xs">billing_invoices</code> exists (apply-billing-system.sql).</p>
      </AlertDescription>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" onClick={() => void copySql()}>
          {copied ? <Check className="mr-1.5 h-4 w-4" /> : <Copy className="mr-1.5 h-4 w-4" />}
          {copied ? "Copied" : "Copy SQL"}
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
            resetPaymentGatewaySchemaProbe();
            onRecheck?.();
          }}
        >
          Recheck
        </Button>
      </div>
    </Alert>
  );
}
