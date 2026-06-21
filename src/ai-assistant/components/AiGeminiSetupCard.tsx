import { useState } from "react";
import { KeyRound, Loader2, Cpu } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AI_SETUP_SQL_URL } from "../lib/api";
import { AI_ASSISTANT_TITLE } from "../lib/branding";

type Props = {
  onConfigured?: () => void;
};

export function AiGeminiSetupCard({ onConfigured }: Props) {
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const key = apiKey.trim();
    if (!key) {
      toast.error("Enter the platform Gemini API key.");
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
      toast.success(`Platform Gemini key saved. All schools can use ${AI_ASSISTANT_TITLE}.`);
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
      } else if (msg.toLowerCase().includes("super admin")) {
        toast.error("Only the Super Admin can configure the platform Gemini key.");
      } else {
        toast.error(msg);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="ai-surface-card mx-auto mb-4 max-w-3xl border">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="ai-accent-text h-4 w-4" />
          Platform Gemini API key
        </CardTitle>
        <CardDescription className="space-y-2">
          <span className="flex items-center gap-1.5">
            <Cpu className="ai-accent-text h-3.5 w-3.5" />
            <strong>Super Admin only.</strong> This key is shared by every school, admin, teacher,
            parent, and student on EduManage.
          </span>
          <span>
            Get a key from{" "}
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noreferrer"
              className="text-primary underline"
            >
              Google AI Studio
            </a>{" "}
            and save it once here. School admins do not add their own keys.
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-2">
          <Label htmlFor="gemini-api-key">Platform API key</Label>
          <Input
            id="gemini-api-key"
            type="password"
            placeholder="Paste the shared Gemini API key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            autoComplete="off"
          />
        </div>
        <Button onClick={() => void save()} disabled={saving} className="shrink-0">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save platform key"}
        </Button>
      </CardContent>
    </Card>
  );
}
