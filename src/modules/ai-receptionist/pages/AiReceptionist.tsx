import { useCallback, useEffect, useState } from "react";
import { BookOpen, LayoutGrid, ListTodo, PhoneCall, PhoneOutgoing, RefreshCw, Settings2, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSchoolInfo } from "@/hooks/useSchoolInfo";
import { useModuleAccess } from "@/modules/lib/useModuleAccess";
import { ModuleAccessDenied } from "@/modules/lib/ModuleAccessDenied";
import { isMissingTableError } from "@/modules/lib/missingSchema";
import { AiReceptionistSchemaSetupCard } from "@/modules/ai-receptionist/components/AiReceptionistSchemaSetupCard";
import { AiReceptionistDashboardPanel } from "@/modules/ai-receptionist/components/AiReceptionistDashboardPanel";
import { AiReceptionistCallsPanel } from "@/modules/ai-receptionist/components/AiReceptionistCallsPanel";
import { AiReceptionistKnowledgePanel } from "@/modules/ai-receptionist/components/AiReceptionistKnowledgePanel";
import { AiReceptionistActionsPanel } from "@/modules/ai-receptionist/components/AiReceptionistActionsPanel";
import { AiReceptionistSettingsPanel } from "@/modules/ai-receptionist/components/AiReceptionistSettingsPanel";
import { AiReceptionistOutboundModal } from "@/modules/ai-receptionist/components/AiReceptionistOutboundModal";
import { AiReceptionistTestModal } from "@/modules/ai-receptionist/components/AiReceptionistTestModal";
import {
  deriveStatsFromCalls,
  fetchActions,
  fetchCalls,
  fetchDashboardStats,
  fetchKnowledgeArticles,
  fetchVoiceAgent,
  fetchVoiceSettings,
} from "@/modules/ai-receptionist/lib/api";
import {
  aiReceptionistSchemaReady,
  checkAiReceptionistSchema,
  type AiReceptionistSchemaStatus,
} from "@/modules/ai-receptionist/lib/schema";
import type {
  AiAction,
  AiCall,
  AiKnowledgeArticle,
  AiReceptionistDashboardStats,
  AiVoiceAgent,
  AiVoiceSettings,
} from "@/modules/ai-receptionist/lib/types";
import { toast } from "sonner";

const EMPTY_STATS: AiReceptionistDashboardStats = {
  calls_today: 0,
  completed_today: 0,
  escalated_today: 0,
  avg_duration_seconds: 0,
  pending_followups: 0,
  knowledge_articles: 0,
  avg_satisfaction: 0,
  total_calls: 0,
};

export default function AiReceptionistPage() {
  const { currentSchool } = useSchoolInfo();
  const schoolId = currentSchool?.id ?? null;
  const access = useModuleAccess("ai_receptionist");

  const [schemaStatus, setSchemaStatus] = useState<AiReceptionistSchemaStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<AiReceptionistDashboardStats>(EMPTY_STATS);
  const [calls, setCalls] = useState<AiCall[]>([]);
  const [articles, setArticles] = useState<AiKnowledgeArticle[]>([]);
  const [actions, setActions] = useState<AiAction[]>([]);
  const [agent, setAgent] = useState<AiVoiceAgent | null>(null);
  const [settings, setSettings] = useState<AiVoiceSettings | null>(null);

  const [outboundModalOpen, setOutboundModalOpen] = useState(false);
  const [testModalOpen, setTestModalOpen] = useState(false);

  const loadAll = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const status = await checkAiReceptionistSchema();
      setSchemaStatus(status);

      const [callRows, articleRows, actionRows, agentRow, settingsRow] = await Promise.all([
        status.calls ? fetchCalls(schoolId) : Promise.resolve([] as AiCall[]),
        status.knowledge
          ? fetchKnowledgeArticles(schoolId)
          : Promise.resolve([] as AiKnowledgeArticle[]),
        status.actions ? fetchActions(schoolId) : Promise.resolve([] as AiAction[]),
        status.agents ? fetchVoiceAgent(schoolId).catch(() => null) : Promise.resolve(null),
        status.settings ? fetchVoiceSettings(schoolId).catch(() => null) : Promise.resolve(null),
      ]);

      setCalls(callRows);
      setArticles(articleRows);
      setActions(actionRows);
      setAgent(agentRow);
      setSettings(settingsRow);

      if (status.calls) {
        try {
          setStats(await fetchDashboardStats(schoolId));
        } catch {
          setStats(deriveStatsFromCalls(callRows, actionRows, articleRows));
        }
      } else {
        setStats(EMPTY_STATS);
      }
    } catch (e) {
      const err = e as { message?: string; code?: string };
      if (!isMissingTableError(err)) {
        toast.error(err.message ?? "Failed to load AI receptionist data");
      }
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  if (!access.loading && !access.canView) {
    return <ModuleAccessDenied label="AI Receptionist" />;
  }

  const schemaReady = schemaStatus ? aiReceptionistSchemaReady(schemaStatus) : true;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <PhoneCall className="h-6 w-6 text-primary" />
            AI Voice Receptionist
          </h1>
          <p className="text-sm text-muted-foreground">
            Production telephony system with OpenAI Realtime voice AI and Twilio media streaming
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setTestModalOpen(true)}
            className="gap-1.5 h-8 text-xs"
          >
            <Volume2 className="h-3.5 w-3.5 text-primary" />
            Test Assistant
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={() => setOutboundModalOpen(true)}
            className="gap-1.5 h-8 text-xs"
          >
            <PhoneOutgoing className="h-3.5 w-3.5" />
            Launch Outbound Call
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadAll()}
            disabled={loading}
            className="gap-1.5 h-8 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Refreshing…" : "Refresh"}
          </Button>
        </div>
      </div>

      {schemaStatus && !schemaReady ? (
        <AiReceptionistSchemaSetupCard
          status={schemaStatus}
          checking={loading}
          onRecheck={() => void loadAll()}
        />
      ) : null}

      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="dashboard" className="gap-1.5">
            <LayoutGrid className="h-3.5 w-3.5" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="calls" className="gap-1.5">
            <PhoneCall className="h-3.5 w-3.5" />
            Calls & Transcripts
          </TabsTrigger>
          <TabsTrigger value="knowledge" className="gap-1.5">
            <BookOpen className="h-3.5 w-3.5" />
            Knowledge Base
          </TabsTrigger>
          <TabsTrigger value="actions" className="gap-1.5">
            <ListTodo className="h-3.5 w-3.5" />
            Follow-ups & Actions
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-1.5">
            <Settings2 className="h-3.5 w-3.5" />
            Telephony & Voice AI
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <AiReceptionistDashboardPanel stats={stats} recentCalls={calls} />
        </TabsContent>

        <TabsContent value="calls">
          <AiReceptionistCallsPanel
            calls={calls}
            canEdit={access.canEdit}
            onRefresh={() => void loadAll()}
            onOpenOutboundModal={() => setOutboundModalOpen(true)}
          />
        </TabsContent>

        <TabsContent value="knowledge">
          <AiReceptionistKnowledgePanel
            articles={articles}
            schoolId={schoolId}
            canCreate={access.canCreate}
            canEdit={access.canEdit}
            canDelete={access.canDelete}
            onRefresh={() => void loadAll()}
          />
        </TabsContent>

        <TabsContent value="actions">
          <AiReceptionistActionsPanel
            actions={actions}
            schoolId={schoolId}
            canCreate={access.canCreate}
            canEdit={access.canEdit}
            canDelete={access.canDelete}
            onRefresh={() => void loadAll()}
          />
        </TabsContent>

        <TabsContent value="settings">
          <AiReceptionistSettingsPanel
            agent={agent}
            settings={settings}
            schoolId={schoolId}
            canManage={access.canManage}
            onRefresh={() => void loadAll()}
          />
        </TabsContent>
      </Tabs>

      {/* Outbound AI Call Launcher Modal */}
      <AiReceptionistOutboundModal
        open={outboundModalOpen}
        onOpenChange={setOutboundModalOpen}
        schoolId={schoolId}
        onSuccess={() => void loadAll()}
      />

      {/* Interactive In-Browser Voice Simulator */}
      <AiReceptionistTestModal
        open={testModalOpen}
        onOpenChange={setTestModalOpen}
        schoolId={schoolId}
        agent={agent}
      />
    </div>
  );
}
