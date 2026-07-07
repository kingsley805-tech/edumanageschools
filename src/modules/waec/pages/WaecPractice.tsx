import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BrainCircuit, GraduationCap, History, LayoutGrid, RefreshCw } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useSchoolInfo } from "@/hooks/useSchoolInfo";
import { supabase } from "@/integrations/supabase/client";
import { WaecSchemaSetupCard } from "@/modules/waec/components/WaecSchemaSetupCard";
import { WaecPracticeSetup } from "@/modules/waec/components/WaecPracticeSetup";
import { WaecExamSession } from "@/modules/waec/components/WaecExamSession";
import { WaecResultReview } from "@/modules/waec/components/WaecResultReview";
import { WaecStudentDashboardPanel } from "@/modules/waec/components/WaecStudentDashboardPanel";
import {
  fetchWaecCatalog,
  fetchWaecDashboard,
  fetchWaecLeaderboard,
  fetchWaecQuestionCount,
  fetchWaecSession,
  fetchWaecSubjects,
  fetchWaecTopics,
  fetchStudentWaecSessions,
  startWaecSession,
  submitWaecSession,
} from "@/modules/waec/lib/api";
import { checkWaecSchema, waecSchemaReady, type WaecSchemaStatus } from "@/modules/waec/lib/schema";
import type {
  WaecCatalogEntry,
  WaecLeaderboardEntry,
  WaecPracticeConfig,
  WaecPracticeSession,
  WaecQuestion,
  WaecSessionAnswer,
  WaecStudentDashboard,
  WaecSubject,
} from "@/modules/waec/lib/types";
import { toast } from "sonner";

type View = "hub" | "exam" | "result";

export default function WaecPracticePage() {
  const { user } = useAuth();
  const { currentSchool } = useSchoolInfo();
  const navigate = useNavigate();
  const schoolId = currentSchool?.id ?? null;

  const [schemaStatus, setSchemaStatus] = useState<WaecSchemaStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const [subjects, setSubjects] = useState<WaecSubject[]>([]);
  const [topics, setTopics] = useState<string[]>([]);
  const [dashboard, setDashboard] = useState<WaecStudentDashboard | null>(null);
  const [leaderboard, setLeaderboard] = useState<WaecLeaderboardEntry[]>([]);
  const [history, setHistory] = useState<WaecPracticeSession[]>([]);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<WaecCatalogEntry[]>([]);
  const [filterSubjectId, setFilterSubjectId] = useState("");
  const [availableCount, setAvailableCount] = useState<number | null>(null);

  const [view, setView] = useState<View>("hub");
  const [activeSession, setActiveSession] = useState<WaecPracticeSession | null>(null);
  const [questions, setQuestions] = useState<WaecQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [resultAnswers, setResultAnswers] = useState<WaecSessionAnswer[]>([]);
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadHub = useCallback(async () => {
    if (!user?.id) return;
    setChecking(true);
    try {
      const status = await checkWaecSchema();
      setSchemaStatus(status);
      if (!status.subjects) return;

      const [subRows, dash, hist, board, cat] = await Promise.all([
        fetchWaecSubjects(),
        status.rpcDashboard ? fetchWaecDashboard(user.id).catch(() => null) : Promise.resolve(null),
        status.sessions ? fetchStudentWaecSessions(user.id).catch(() => []) : Promise.resolve([]),
        fetchWaecLeaderboard(schoolId).catch(() => []),
        status.questions ? fetchWaecCatalog().catch(() => []) : Promise.resolve([]),
      ]);
      setSubjects(subRows);
      setDashboard(dash);
      setHistory(hist);
      setLeaderboard(board);
      setCatalog(cat);

      const { data: student } = await supabase
        .from("students")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      setStudentId(student?.id ?? null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load WAEC platform");
    } finally {
      setChecking(false);
    }
  }, [user?.id, schoolId]);

  useEffect(() => {
    void loadHub();
  }, [loadHub]);

  const loadTopics = async (subjectId: string) => {
    setFilterSubjectId(subjectId);
    try {
      setTopics(await fetchWaecTopics(subjectId));
    } catch {
      setTopics([]);
    }
  };

  useEffect(() => {
    if (!filterSubjectId) {
      setAvailableCount(null);
      return;
    }
    void fetchWaecQuestionCount({ subjectId: filterSubjectId })
      .then(setAvailableCount)
      .catch(() => setAvailableCount(null));
  }, [filterSubjectId]);

  const totalBankQuestions = useMemo(
    () => catalog.reduce((s, c) => s + (c.total_questions ?? 0), 0),
    [catalog],
  );

  const handleStart = async (config: WaecPracticeConfig) => {
    if (!user?.id) return;
    setStarting(true);
    try {
      const { session, questions: qs } = await startWaecSession(
        user.id,
        schoolId,
        studentId,
        config,
      );
      setActiveSession(session);
      setQuestions(qs);
      setAnswers({});
      setView("exam");
      toast.success(config.mode === "exam" ? "Mock examination started" : "Practice started");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start session");
    } finally {
      setStarting(false);
    }
  };

  const handleSubmit = async () => {
    if (!activeSession) return;
    setSubmitting(true);
    try {
      await submitWaecSession(activeSession.id);
      const { session, answers: ans } = await fetchWaecSession(activeSession.id);
      setActiveSession(session);
      setResultAnswers(ans);
      setView("result");
      toast.success("Examination submitted");
      void loadHub();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Submit failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAiHelp = (questionText: string) => {
    navigate(`/ai-assistant?q=${encodeURIComponent(`Explain this WAEC question: ${questionText}`)}`);
  };

  const schemaReady = schemaStatus ? waecSchemaReady(schemaStatus) : false;
  const subjectName =
    activeSession?.subject_name ??
    subjects.find((s) => s.id === activeSession?.subject_id)?.name ??
    "Subject";

  return (
    <DashboardLayout role="student">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
              <GraduationCap className="h-6 w-6" />
              Solve BECE & WASSCE Questions
            </h1>
            <p className="text-sm text-muted-foreground">
              Original WAEC-style questions for JHS & SHS — practice, mock exams, instant marking & AI tutor
            </p>
          </div>
          {view === "hub" ? (
            <Button variant="outline" size="sm" onClick={() => void loadHub()} disabled={checking} className="gap-1.5">
              <RefreshCw className={`h-4 w-4 ${checking ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          ) : null}
        </div>

        {schemaStatus && !schemaReady ? (
          <WaecSchemaSetupCard status={schemaStatus} checking={checking} onRecheck={() => void loadHub()} />
        ) : totalBankQuestions > 0 ? (
          <p className="text-sm text-muted-foreground">
            Question bank: <span className="font-medium text-foreground">{totalBankQuestions.toLocaleString()}</span> WAEC-style questions
            across BECE (JHS) & WASSCE (SHS)
          </p>
        ) : schemaReady ? (
          <p className="text-sm text-amber-700 dark:text-amber-400">
            No questions yet. Ask your admin to generate the question bank from Admin → WAEC → AI Generator.
          </p>
        ) : null}

        {view === "exam" && activeSession ? (
          <WaecExamSession
            session={activeSession}
            questions={questions}
            subjectName={subjectName}
            answers={answers}
            onAnswer={(qid, ans) => setAnswers((a) => ({ ...a, [qid]: ans }))}
            onSubmit={() => void handleSubmit()}
            submitting={submitting}
          />
        ) : view === "result" && activeSession ? (
          <WaecResultReview
            session={activeSession}
            answers={resultAnswers}
            onDone={() => {
              setView("hub");
              setActiveSession(null);
            }}
            onAiHelp={handleAiHelp}
          />
        ) : (
          <Tabs defaultValue="practice" className="space-y-4">
            <TabsList className="flex h-auto flex-wrap gap-1">
              <TabsTrigger value="practice" className="gap-1.5">
                <GraduationCap className="h-3.5 w-3.5" />
                Practice
              </TabsTrigger>
              <TabsTrigger value="dashboard" className="gap-1.5">
                <LayoutGrid className="h-3.5 w-3.5" />
                My Performance
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-1.5">
                <History className="h-3.5 w-3.5" />
                History
              </TabsTrigger>
              <TabsTrigger value="ai" className="gap-1.5">
                <BrainCircuit className="h-3.5 w-3.5" />
                AI Tutor
              </TabsTrigger>
            </TabsList>

            <TabsContent value="practice">
              <WaecPracticeSetup
                subjects={subjects}
                topics={topics}
                availableCount={availableCount ?? undefined}
                onTopicsNeeded={loadTopics}
                onStart={handleStart}
                loading={starting}
              />
            </TabsContent>

            <TabsContent value="dashboard">
              {dashboard ? (
                <WaecStudentDashboardPanel dashboard={dashboard} leaderboard={leaderboard} />
              ) : (
                <p className="text-sm text-muted-foreground">Complete a practice session to see your analytics.</p>
              )}
            </TabsContent>

            <TabsContent value="history">
              {history.length === 0 ? (
                <p className="text-sm text-muted-foreground">No examination history yet.</p>
              ) : (
                <div className="space-y-2">
                  {history.map((s) => (
                    <div
                      key={s.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm"
                    >
                      <div>
                        <p className="font-medium">{s.subject_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {s.mode === "exam" ? "Mock Exam" : "Practice"} · {new Date(s.started_at).toLocaleDateString()}
                        </p>
                      </div>
                      {s.status === "submitted" ? (
                        <span className="font-semibold text-emerald-600">
                          {s.percentage}% {s.grade ? `(${s.grade})` : ""}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">In progress</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="ai">
              <div className="rounded-xl border bg-card p-6 text-center space-y-3">
                <BrainCircuit className="mx-auto h-10 w-10 text-primary" />
                <p className="font-medium">AI Tutor Assistant</p>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Ask for explanations, step-by-step solutions, and revision tips for any WAEC topic.
                </p>
                <Button onClick={() => navigate("/ai-assistant")}>Open EduManage AI</Button>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </DashboardLayout>
  );
}
