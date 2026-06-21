import { useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AI_SETUP_SQL_URL } from "../lib/api";

type Props = {
  onConfigured?: () => void;
};

export function AiGeminiSetupCard({ onConfigured }: Props) {
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const key = apiKey.trim();
    if (!key) {
      toast.error("Enter your Google AI Studio API key.");
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase.rpc("upsert_platform_gemini_key", {
        p_api_key: key,
        p_monthly_limit: 1000,
      });

      if (error) throw error;

      const result = data as { ok?: boolean; error?: string } | null;
      if (result?.ok === false) {
        throw new Error(result.error ?? "Could not save API key");
      }

      setApiKey("");
      toast.success("Gemini API key saved. You can start chatting.");
      onConfigured?.();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to save API key";
      if (msg.includes("upsert_platform_gemini_key") || msg.includes("Could not find the function")) {
        toast.error("AI database setup required", {
          description: "Run public/sql/apply-ai-assistant.sql in Supabase SQL Editor first.",
          action: {
            label: "Open SQL",
            onClick: () => window.open(AI_SETUP_SQL_URL, "_blank"),
          },
        });
      } else {
        toast.error(msg);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="mx-auto mb-4 max-w-3xl border-amber-500/30 bg-amber-500/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="h-4 w-4 text-amber-600" />
          Configure Gemini API key
        </CardTitle>
        <CardDescription>
          One-time setup for school admins. Get a free key from{" "}
          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noreferrer"
            className="text-primary underline"
          >
            Google AI Studio
          </a>
          .
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-2">
          <Label htmlFor="gemini-api-key">API key</Label>
          <Input
            id="gemini-api-key"
            type="password"
            placeholder="Paste your Gemini API key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            autoComplete="off"
          />
        </div>
        <Button onClick={() => void save()} disabled={saving} className="shrink-0">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save key"}
        </Button>
      </CardContent>
    </Card>
  );
}
