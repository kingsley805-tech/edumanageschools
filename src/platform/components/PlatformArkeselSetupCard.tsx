import { useEffect, useState } from "react";
import { KeyRound, Loader2, MessageSquare } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const SMS_SETUP_SQL_URL =
  "https://supabase.com/dashboard/project/xbhhpjtwawfawifhpxbe/sql/new";

type Props = {
  onConfigured?: () => void;
};

export function PlatformArkeselSetupCard({ onConfigured }: Props) {
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);

  const loadStatus = async () => {
    const { data, error } = await supabase.rpc("get_platform_sms_gateway_status");
    if (error) {
      const msg = (error.message ?? "").toLowerCase();
      if (msg.includes("get_platform_sms_gateway_status") || msg.includes("could not find")) {
        setConfigured(false);
        return;
      }
      return;
    }
    const res = data as { configured?: boolean };
    setConfigured(res?.configured === true);
  };

  useEffect(() => {
    void loadStatus();
  }, []);

  const save = async () => {
    const key = apiKey.trim();
    if (!key) {
      toast.error("Enter your Arkesel API key.");
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase.rpc("upsert_platform_arkesel_key", {
        p_api_key: key,
      });

      if (error) throw error;

      const result = data as { ok?: boolean; error?: string } | null;
      if (result?.ok === false) {
        throw new Error(result.error ?? "Could not save API key");
      }

      setApiKey("");
      setConfigured(true);
      toast.success("Arkesel API key saved. Attendance SMS can now be sent.");
      onConfigured?.();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to save API key";
      if (msg.includes("upsert_platform_arkesel_key") || msg.includes("Could not find the function")) {
        toast.error("SMS database setup required", {
          description: "Run public/sql/apply-platform-arkesel-key.sql in Supabase SQL Editor first.",
          action: {
            label: "Open SQL",
            onClick: () => window.open(SMS_SETUP_SQL_URL, "_blank"),
          },
        });
      } else if (msg.toLowerCase().includes("super admin")) {
        toast.error("Only the Super Admin can configure the Arkesel API key.");
      } else {
        toast.error(msg);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-4 w-4 text-amber-700" />
            Platform Arkesel API key
          </CardTitle>
          {configured === true ? (
            <Badge className="bg-emerald-500/10 text-emerald-700">Configured</Badge>
          ) : configured === false ? (
            <Badge variant="destructive">Not configured</Badge>
          ) : null}
        </div>
        <CardDescription className="space-y-2">
          <span className="flex items-center gap-1.5">
            <MessageSquare className="h-3.5 w-3.5" />
            <strong>Super Admin only.</strong> One shared Arkesel key sends parent attendance SMS for all schools.
          </span>
          <span>
            Get your key from{" "}
            <a
              href="https://sms.arkesel.com"
              target="_blank"
              rel="noreferrer"
              className="text-primary underline"
            >
              Arkesel SMS
            </a>{" "}
            and save it here. School admins configure sender ID and templates in Register Settings only.
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-2">
          <Label htmlFor="arkesel-api-key">Arkesel API key</Label>
          <Input
            id="arkesel-api-key"
            type="password"
            placeholder="Paste your Arkesel API key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            autoComplete="off"
          />
        </div>
        <Button onClick={() => void save()} disabled={saving} className="shrink-0">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Arkesel key"}
        </Button>
      </CardContent>
    </Card>
  );
}
