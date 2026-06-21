import { ShieldAlert } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AI_ASSISTANT_TITLE } from "../lib/branding";

export function AiGeminiPendingNotice() {
  return (
    <Card className="mx-auto mb-4 max-w-3xl border-warning/30 bg-warning/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldAlert className="h-4 w-4 text-warning" />
          {AI_ASSISTANT_TITLE} is not active yet
        </CardTitle>
        <CardDescription>
          EduManage uses one shared Gemini API key for the whole platform, configured by the{" "}
          <strong>Super Admin</strong>. All schools and staff use that same key — you do not need
          your own.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Ask your Super Admin to open <strong>{AI_ASSISTANT_TITLE}</strong>, add the platform Gemini
        key from{" "}
        <a
          href="https://aistudio.google.com/apikey"
          target="_blank"
          rel="noreferrer"
          className="text-primary underline"
        >
          Google AI Studio
        </a>
        , and save it once. After that, everyone can use AI across the portal.
      </CardContent>
    </Card>
  );
}
