import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Copy, Check, Save, Sparkles, PhoneCall, Shield, Radio, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { saveVoiceAgent, saveVoiceSettings } from "@/modules/ai-receptionist/lib/api";
import {
  AVAILABLE_VOICE_TOOLS,
  OPENAI_REALTIME_MODELS,
  OPENAI_REALTIME_VOICES,
  SUPPORTED_LANGUAGES,
  type AiVoiceAgent,
  type AiVoiceSettings,
  type OpenAiVoice,
} from "@/modules/ai-receptionist/lib/types";

type Props = {
  agent: AiVoiceAgent | null;
  settings: AiVoiceSettings | null;
  schoolId: string | null;
  canManage: boolean;
  onRefresh: () => void;
};

const VERIFICATION_MODES = [
  { value: "registered_phone", label: "Registered phone number" },
  { value: "parent_pin", label: "Parent identification code" },
  { value: "otp", label: "One-time passcode (SMS)" },
  { value: "security_questions", label: "Security questions" },
];

const PROVIDERS = [
  { value: "twilio", label: "Twilio Programmable Voice" },
  { value: "vonage", label: "Vonage (Nexmo)" },
  { value: "plivo", label: "Plivo" },
  { value: "custom", label: "Custom / Self-hosted Gateway" },
  { value: "none", label: "Not connected" },
];

export function AiReceptionistSettingsPanel({
  agent,
  settings,
  schoolId,
  canManage,
  onRefresh,
}: Props) {
  const [agentForm, setAgentForm] = useState({
    name: "Emma",
    display_title: "Virtual school assistant",
    greeting: "",
    voice_style: "warm_professional",
    languages: ["en"] as string[],
    is_active: true,
    handover_phone: "",
    escalation_keywords: "",
    openai_model: "gpt-4o-realtime-preview",
    openai_voice: "alloy" as OpenAiVoice,
    system_prompt: "",
    temperature: 0.8,
    enabled_tools: [
      "verify_caller_identity",
      "get_student_info",
      "get_attendance_summary",
      "get_fee_balance",
      "get_academic_grades",
      "report_student_absence",
      "schedule_meeting",
      "search_knowledge_base",
      "transfer_to_human",
    ],
    max_call_duration_seconds: 600,
  });

  const [settingsForm, setSettingsForm] = useState({
    provider: "twilio",
    school_phone_e164: "",
    twilio_account_sid: "",
    twilio_auth_token: "",
    twilio_phone_number: "",
    support_number: "",
    media_stream_url: "",
    recording_enabled: true,
    outbound_enabled: true,
    verification_mode: "registered_phone",
    is_enabled: true,
  });

  const [savingAgent, setSavingAgent] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!agent) return;
    setAgentForm({
      name: agent.name || "Emma",
      display_title: agent.display_title || "Virtual school assistant",
      greeting: agent.greeting || "",
      voice_style: agent.voice_style || "warm_professional",
      languages: agent.languages ?? ["en"],
      is_active: agent.is_active !== false,
      handover_phone: agent.handover_phone ?? "",
      escalation_keywords: (agent.escalation_keywords ?? []).join(", "),
      openai_model: agent.openai_model || "gpt-4o-realtime-preview",
      openai_voice: (agent.openai_voice as OpenAiVoice) || "alloy",
      system_prompt: agent.system_prompt || "",
      temperature: agent.temperature ?? 0.8,
      enabled_tools: agent.enabled_tools || [
        "verify_caller_identity",
        "get_student_info",
        "get_attendance_summary",
        "get_fee_balance",
        "get_academic_grades",
        "report_student_absence",
        "schedule_meeting",
        "search_knowledge_base",
        "transfer_to_human",
      ],
      max_call_duration_seconds: agent.max_call_duration_seconds ?? 600,
    });
  }, [agent]);

  useEffect(() => {
    if (!settings) return;
    setSettingsForm((f) => ({
      ...f,
      provider: settings.provider || "twilio",
      school_phone_e164: settings.school_phone_e164 ?? "",
      twilio_account_sid: settings.twilio_account_sid ?? "",
      twilio_phone_number: settings.twilio_phone_number ?? "",
      support_number: settings.support_number ?? "",
      media_stream_url: settings.media_stream_url ?? "",
      recording_enabled: settings.recording_enabled !== false,
      outbound_enabled: settings.outbound_enabled !== false,
      verification_mode: settings.verification_mode || "registered_phone",
      is_enabled: settings.is_enabled !== false,
    }));
  }, [settings]);

  const toggleLanguage = (code: string) => {
    setAgentForm((f) => ({
      ...f,
      languages: f.languages.includes(code)
        ? f.languages.filter((l) => l !== code)
        : [...f.languages, code],
    }));
  };

  const toggleTool = (toolKey: string) => {
    setAgentForm((f) => ({
      ...f,
      enabled_tools: f.enabled_tools.includes(toolKey)
        ? f.enabled_tools.filter((t) => t !== toolKey)
        : [...f.enabled_tools, toolKey],
    }));
  };

  const handleSaveAgent = async () => {
    if (!schoolId) return;
    setSavingAgent(true);
    try {
      await saveVoiceAgent(schoolId, {
        name: agentForm.name,
        display_title: agentForm.display_title,
        greeting: agentForm.greeting,
        voice_style: agentForm.voice_style,
        languages: agentForm.languages.length ? agentForm.languages : ["en"],
        is_active: agentForm.is_active,
        handover_phone: agentForm.handover_phone || null,
        escalation_keywords: agentForm.escalation_keywords
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean),
        openai_model: agentForm.openai_model,
        openai_voice: agentForm.openai_voice,
        system_prompt: agentForm.system_prompt || null,
        temperature: agentForm.temperature,
        enabled_tools: agentForm.enabled_tools,
        max_call_duration_seconds: agentForm.max_call_duration_seconds,
      });
      toast.success("AI Voice Assistant profile saved");
      onRefresh();
    } catch (e) {
      toast.error((e as Error).message ?? "Save failed");
    } finally {
      setSavingAgent(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!schoolId) return;
    setSavingSettings(true);
    try {
      await saveVoiceSettings(schoolId, settingsForm);
      toast.success("Telephony settings saved");
      setSettingsForm((f) => ({ ...f, twilio_auth_token: "" }));
      onRefresh();
    } catch (e) {
      toast.error((e as Error).message ?? "Save failed");
    } finally {
      setSavingSettings(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedUrl(id);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  const currentOrigin = typeof window !== "undefined" ? window.location.origin : "";
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://your-project.supabase.co";
  const defaultWebhookUrl = `${supabaseUrl}/functions/v1/ai-voice-gateway`;
  const defaultMediaStreamUrl = defaultWebhookUrl.replace(/^http/, "ws");

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        {/* ================================================================= */}
        {/* OpenAI Realtime Assistant Configuration                           */}
        {/* ================================================================= */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold">OpenAI Realtime Voice Assistant</CardTitle>
                  <CardDescription className="text-xs">
                    Natural speech-to-speech conversational AI with real-time barge-in
                  </CardDescription>
                </div>
              </div>
              <Badge variant={agentForm.is_active ? "default" : "secondary"}>
                {agentForm.is_active ? "Active" : "Inactive"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Assistant Name</Label>
                <Input
                  value={agentForm.name}
                  onChange={(e) => setAgentForm((f) => ({ ...f, name: e.target.value }))}
                  disabled={!canManage}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Display Title</Label>
                <Input
                  value={agentForm.display_title}
                  onChange={(e) => setAgentForm((f) => ({ ...f, display_title: e.target.value }))}
                  disabled={!canManage}
                />
              </div>
            </div>

            {/* OpenAI Realtime Model */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">OpenAI Realtime Model</Label>
              <Select
                value={agentForm.openai_model}
                onValueChange={(v) => setAgentForm((f) => ({ ...f, openai_model: v }))}
                disabled={!canManage}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OPENAI_REALTIME_MODELS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      <div className="flex flex-col">
                        <span className="font-medium">{m.label}</span>
                        <span className="text-[11px] text-muted-foreground">{m.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* OpenAI Voice Selection */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium flex items-center justify-between">
                <span>AI Voice Persona</span>
                <span className="text-[11px] text-muted-foreground">Native Realtime Speech</span>
              </Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {OPENAI_REALTIME_VOICES.map((v) => {
                  const isSelected = agentForm.openai_voice === v.value;
                  return (
                    <button
                      key={v.value}
                      type="button"
                      onClick={() => canManage && setAgentForm((f) => ({ ...f, openai_voice: v.value }))}
                      className={`flex flex-col items-start rounded-lg border p-2 text-left transition-all ${
                        isSelected
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-border/60 hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex w-full items-center justify-between">
                        <span className="text-xs font-semibold">{v.label}</span>
                        <Volume2 className={`h-3 w-3 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                      </div>
                      <span className="mt-0.5 text-[10px] text-muted-foreground line-clamp-1">{v.tone}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Opening Greeting */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Inbound Call Greeting</Label>
              <Textarea
                value={agentForm.greeting}
                onChange={(e) => setAgentForm((f) => ({ ...f, greeting: e.target.value }))}
                rows={2}
                placeholder="Good morning, thank you for calling St. Peter's School. How may I assist you today?"
                disabled={!canManage}
                className="text-xs"
              />
            </div>

            {/* Custom System Prompt */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Custom System Prompt / Guidelines</Label>
                <div className="flex gap-1 text-[10px] text-muted-foreground">
                  <code>{`{school_name}`}</code>
                  <code>{`{assistant_name}`}</code>
                </div>
              </div>
              <Textarea
                value={agentForm.system_prompt}
                onChange={(e) => setAgentForm((f) => ({ ...f, system_prompt: e.target.value }))}
                rows={4}
                placeholder="Leave blank to use intelligent default guidelines. You can specify rules like: 'Always be courteous, verify parent ID before giving fee amounts, offer to book a meeting if parent is upset.'"
                disabled={!canManage}
                className="text-xs font-mono"
              />
            </div>

            {/* Max Call Duration & Temperature */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2 rounded-md border p-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">Max Call Duration</span>
                  <span className="text-muted-foreground">{Math.floor(agentForm.max_call_duration_seconds / 60)} mins</span>
                </div>
                <Slider
                  min={60}
                  max={1200}
                  step={60}
                  value={[agentForm.max_call_duration_seconds]}
                  onValueChange={([v]) => setAgentForm((f) => ({ ...f, max_call_duration_seconds: v }))}
                  disabled={!canManage}
                />
              </div>

              <div className="space-y-2 rounded-md border p-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">Creativity (Temp)</span>
                  <span className="text-muted-foreground">{agentForm.temperature.toFixed(2)}</span>
                </div>
                <Slider
                  min={0.2}
                  max={1.0}
                  step={0.05}
                  value={[agentForm.temperature]}
                  onValueChange={([v]) => setAgentForm((f) => ({ ...f, temperature: v }))}
                  disabled={!canManage}
                />
              </div>
            </div>

            {/* Languages */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Languages Spoken</Label>
              <div className="flex flex-wrap gap-1.5">
                {SUPPORTED_LANGUAGES.map((lang) => {
                  const active = agentForm.languages.includes(lang.code);
                  return (
                    <Badge
                      key={lang.code}
                      variant={active ? "default" : "outline"}
                      className={canManage ? "cursor-pointer" : ""}
                      onClick={() => canManage && toggleLanguage(lang.code)}
                    >
                      {lang.label}
                    </Badge>
                  );
                })}
              </div>
            </div>

            {/* Escalation & Handover */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Human Handover Phone</Label>
                <Input
                  value={agentForm.handover_phone}
                  onChange={(e) => setAgentForm((f) => ({ ...f, handover_phone: e.target.value }))}
                  placeholder="+233241234567"
                  disabled={!canManage}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Escalation Triggers</Label>
                <Input
                  value={agentForm.escalation_keywords}
                  onChange={(e) => setAgentForm((f) => ({ ...f, escalation_keywords: e.target.value }))}
                  placeholder="emergency, ambulance, human, manager"
                  disabled={!canManage}
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2">
                <Switch
                  id="agent-active"
                  checked={agentForm.is_active}
                  onCheckedChange={(v) => setAgentForm((f) => ({ ...f, is_active: v }))}
                  disabled={!canManage}
                />
                <Label htmlFor="agent-active" className="text-xs font-medium">
                  Enable Voice Assistant
                </Label>
              </div>

              {canManage ? (
                <Button onClick={() => void handleSaveAgent()} disabled={savingAgent} size="sm" className="gap-1.5">
                  <Save className="h-3.5 w-3.5" />
                  {savingAgent ? "Saving…" : "Save Profile"}
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>

        {/* ================================================================= */}
        {/* Enabled Business Tools & Security                                 */}
        {/* ================================================================= */}
        <div className="space-y-6">
          <Card className="border-border/60 shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
                  <Shield className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold">Authorized Business Tools</CardTitle>
                  <CardDescription className="text-xs">
                    Choose which actions the AI assistant is permitted to perform
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {AVAILABLE_VOICE_TOOLS.map((tool) => {
                const isEnabled = agentForm.enabled_tools.includes(tool.key);
                return (
                  <div
                    key={tool.key}
                    className="flex items-center justify-between rounded-lg border border-border/50 p-2.5 transition-colors hover:bg-muted/30"
                  >
                    <div className="space-y-0.5 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium">{tool.label}</span>
                        <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                          {tool.category}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground">{tool.description}</p>
                    </div>
                    <Switch
                      checked={isEnabled}
                      onCheckedChange={() => canManage && toggleTool(tool.key)}
                      disabled={!canManage}
                    />
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* ================================================================= */}
          {/* Telephony & Twilio Line Settings                                  */}
          {/* ================================================================= */}
          <Card className="border-border/60 shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600">
                  <PhoneCall className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold">Twilio Telephony & Webhooks</CardTitle>
                  <CardDescription className="text-xs">
                    Connect Twilio phone numbers and configure live audio streaming
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Provider</Label>
                  <Select
                    value={settingsForm.provider}
                    onValueChange={(v) => setSettingsForm((f) => ({ ...f, provider: v }))}
                    disabled={!canManage}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROVIDERS.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Caller Verification</Label>
                  <Select
                    value={settingsForm.verification_mode}
                    onValueChange={(v) => setSettingsForm((f) => ({ ...f, verification_mode: v }))}
                    disabled={!canManage}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VERIFICATION_MODES.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Twilio Phone Number</Label>
                  <Input
                    value={settingsForm.twilio_phone_number}
                    onChange={(e) => setSettingsForm((f) => ({ ...f, twilio_phone_number: e.target.value }))}
                    placeholder="+1234567890"
                    disabled={!canManage}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">School Display Phone</Label>
                  <Input
                    value={settingsForm.school_phone_e164}
                    onChange={(e) => setSettingsForm((f) => ({ ...f, school_phone_e164: e.target.value }))}
                    placeholder="+233201234567"
                    disabled={!canManage}
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Twilio Account SID</Label>
                  <Input
                    value={settingsForm.twilio_account_sid}
                    onChange={(e) => setSettingsForm((f) => ({ ...f, twilio_account_sid: e.target.value }))}
                    placeholder="AC..."
                    disabled={!canManage}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Twilio Auth Token</Label>
                  <Input
                    type="password"
                    value={settingsForm.twilio_auth_token}
                    onChange={(e) => setSettingsForm((f) => ({ ...f, twilio_auth_token: e.target.value }))}
                    placeholder={settings?.twilio_account_sid ? "•••••••••••••••• (Leave blank to keep)" : ""}
                    disabled={!canManage}
                  />
                </div>
              </div>

              {/* Toggles */}
              <div className="space-y-2 rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="recording" className="text-xs font-medium cursor-pointer">
                    Dual-channel Call Recording
                  </Label>
                  <Switch
                    id="recording"
                    checked={settingsForm.recording_enabled}
                    onCheckedChange={(v) => setSettingsForm((f) => ({ ...f, recording_enabled: v }))}
                    disabled={!canManage}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="outbound" className="text-xs font-medium cursor-pointer">
                    Allow Outbound Automated Calls
                  </Label>
                  <Switch
                    id="outbound"
                    checked={settingsForm.outbound_enabled}
                    onCheckedChange={(v) => setSettingsForm((f) => ({ ...f, outbound_enabled: v }))}
                    disabled={!canManage}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="enabled" className="text-xs font-medium cursor-pointer">
                    Answer Incoming Phone Calls
                  </Label>
                  <Switch
                    id="enabled"
                    checked={settingsForm.is_enabled}
                    onCheckedChange={(v) => setSettingsForm((f) => ({ ...f, is_enabled: v }))}
                    disabled={!canManage}
                  />
                </div>
              </div>

              {/* Twilio Setup URLs Box */}
              <div className="rounded-lg bg-muted/50 p-3 space-y-2.5 border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold">
                    <Radio className="h-3.5 w-3.5 text-primary" />
                    <span>Twilio Voice Webhook URL</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[11px]"
                    onClick={() => copyToClipboard(settings?.webhook_url || defaultWebhookUrl, "webhook")}
                  >
                    {copiedUrl === "webhook" ? <Check className="h-3 w-3 mr-1 text-emerald-600" /> : <Copy className="h-3 w-3 mr-1" />}
                    Copy
                  </Button>
                </div>
                <code className="block break-all rounded bg-background p-2 text-[11px] font-mono border">
                  {settings?.webhook_url || defaultWebhookUrl}
                </code>
                <p className="text-[11px] text-muted-foreground">
                  Paste this URL into your <strong>Twilio Console → Phone Numbers → Configure → A Call Comes In</strong> (Webhook HTTP POST).
                </p>
              </div>

              {canManage ? (
                <Button onClick={() => void handleSaveSettings()} disabled={savingSettings} size="sm" className="gap-1.5 w-full">
                  <Save className="h-3.5 w-3.5" />
                  {savingSettings ? "Saving…" : "Save Telephony Settings"}
                </Button>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
