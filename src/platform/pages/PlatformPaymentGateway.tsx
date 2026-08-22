// @ts-nocheck
import { useEffect, useState } from "react";
import PlatformLayout from "@/platform/components/PlatformLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Save, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Row = {
  provider: string;
  is_enabled: boolean;
  is_test_mode: boolean;
  public_key: string | null;
  secret_key: string | null;
  webhook_secret: string | null;
  updated_at?: string;
};

export default function PlatformPaymentGateway() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [row, setRow] = useState<Row>({
    provider: "paystack",
    is_enabled: true,
    is_test_mode: true,
    public_key: "",
    secret_key: "",
    webhook_secret: "",
  });

  useEffect(() => {
    void load();
  }, []);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("platform_payment_gateway")
      .select("*")
      .eq("provider", "paystack")
      .maybeSingle();
    if (error) toast.error(error.message);
    if (data) setRow({ ...data, secret_key: data.secret_key ?? "", webhook_secret: data.webhook_secret ?? "", public_key: data.public_key ?? "" });
    setLoading(false);
  };

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("platform_payment_gateway")
      .upsert(
        {
          provider: "paystack",
          is_enabled: row.is_enabled,
          is_test_mode: row.is_test_mode,
          public_key: row.public_key?.trim() || null,
          secret_key: row.secret_key?.trim() || null,
          webhook_secret: row.webhook_secret?.trim() || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "provider" },
      );
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Platform Paystack saved");
    void load();
  };

  return (
    <PlatformLayout
      title="Billing"
      description="Paystack keys for organization subscription payments"
    >
      <div className="mx-auto max-w-3xl space-y-6">
        <Alert>
          <ShieldCheck className="h-4 w-4" />
          <AlertTitle>Platform only</AlertTitle>
          <AlertDescription>
            These keys are used when schools pay for their subscription. Stored securely and used by the backend.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle>Paystack</CardTitle>
            <CardDescription>Find these in your Paystack dashboard → Settings → API Keys & Webhooks.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <Label className="text-sm">Enabled</Label>
                    <p className="text-xs text-muted-foreground">Turn off to block new subscription payments.</p>
                  </div>
                  <Switch checked={row.is_enabled} onCheckedChange={(v) => setRow({ ...row, is_enabled: v })} />
                </div>

                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <Label className="text-sm">Test mode</Label>
                    <p className="text-xs text-muted-foreground">Use Paystack test keys (pk_test / sk_test).</p>
                  </div>
                  <Switch checked={row.is_test_mode} onCheckedChange={(v) => setRow({ ...row, is_test_mode: v })} />
                </div>

                <div className="space-y-2">
                  <Label>Public key</Label>
                  <Input
                    placeholder="pk_test_xxx or pk_live_xxx"
                    value={row.public_key ?? ""}
                    onChange={(e) => setRow({ ...row, public_key: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Secret key</Label>
                  <Input
                    type="password"
                    placeholder="sk_test_xxx or sk_live_xxx"
                    value={row.secret_key ?? ""}
                    onChange={(e) => setRow({ ...row, secret_key: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">Required to initialise and verify payments.</p>
                </div>

                <div className="space-y-2">
                  <Label>Webhook secret (optional)</Label>
                  <Input
                    type="password"
                    placeholder="Leave blank to reuse secret key"
                    value={row.webhook_secret ?? ""}
                    onChange={(e) => setRow({ ...row, webhook_secret: e.target.value })}
                  />
                </div>

                <div className="flex justify-end">
                  <Button onClick={save} disabled={saving}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </PlatformLayout>
  );
}
