import { useMemo, useState } from "react";
import { BookOpen, Clock, Play, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import type { WaecLevel, WaecPaperType, WaecPracticeConfig, WaecSubject } from "@/modules/waec/lib/types";
import { WAEC_LEVEL_LABELS, WAEC_PAPER_LABELS } from "@/modules/waec/lib/types";

type Props = {
  subjects: WaecSubject[];
  topics: string[];
  availableCount?: number;
  onTopicsNeeded: (subjectId: string) => void;
  onLevelChange?: (level: WaecLevel) => void;
  onStart: (config: WaecPracticeConfig) => void;
  loading?: boolean;
};

export function WaecPracticeSetup({
  subjects,
  topics,
  availableCount,
  onTopicsNeeded,
  onLevelChange,
  onStart,
  loading,
}: Props) {
  const [level, setLevel] = useState<WaecLevel>("bece");
  const [subjectId, setSubjectId] = useState("");
  const [paperType, setPaperType] = useState<WaecPaperType>("paper_1");
  const [topic, setTopic] = useState<string>("all");
  const [questionCount, setQuestionCount] = useState("10");
  const [duration, setDuration] = useState("120");

  const levelSubjects = useMemo(
    () => subjects.filter((s) => s.level === level),
    [subjects, level],
  );

  const handleSubjectChange = (id: string) => {
    setSubjectId(id);
    onTopicsNeeded(id);
  };

  const buildConfig = (mode: "practice" | "exam"): WaecPracticeConfig => ({
    level,
    subjectId,
    paperType,
    topic: topic !== "all" ? topic : undefined,
    questionCount: Number(questionCount) || 10,
    mode,
    durationMinutes: mode === "exam" ? Number(duration) || 120 : undefined,
  });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="card-interactive">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="h-4 w-4" />
            Practice Mode
          </CardTitle>
          <CardDescription>Select level, subject, and topics — no time limit</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <SetupFields
            level={level}
            setLevel={setLevel}
            subjectId={subjectId}
            setSubjectId={handleSubjectChange}
            levelSubjects={levelSubjects}
            paperType={paperType}
            setPaperType={setPaperType}
            topic={topic}
            setTopic={setTopic}
            topics={topics}
            questionCount={questionCount}
            setQuestionCount={setQuestionCount}
            availableCount={availableCount}
            onLevelChange={onLevelChange}
          />
          <Button
            className="w-full gap-2"
            disabled={!subjectId || loading}
            onClick={() => onStart(buildConfig("practice"))}
          >
            <Play className="h-4 w-4" />
            Start Practice
          </Button>
        </CardContent>
      </Card>

      <Card className="card-interactive border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Timer className="h-4 w-4" />
            Mock Examination Mode
          </CardTitle>
          <CardDescription>Timed BECE/WASSCE simulator with countdown and auto-submit</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <SetupFields
            level={level}
            setLevel={setLevel}
            subjectId={subjectId}
            setSubjectId={handleSubjectChange}
            levelSubjects={levelSubjects}
            paperType={paperType}
            setPaperType={setPaperType}
            topic={topic}
            setTopic={setTopic}
            topics={topics}
            questionCount={questionCount}
            setQuestionCount={setQuestionCount}
            availableCount={availableCount}
            onLevelChange={onLevelChange}
            showDuration
            duration={duration}
            setDuration={setDuration}
          />
          <Button
            className="w-full gap-2"
            variant="default"
            disabled={!subjectId || loading}
            onClick={() => onStart(buildConfig("exam"))}
          >
            <Clock className="h-4 w-4" />
            Start Mock Examination
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function SetupFields({
  level,
  setLevel,
  subjectId,
  setSubjectId,
  levelSubjects,
  paperType,
  setPaperType,
  topic,
  setTopic,
  topics,
  questionCount,
  setQuestionCount,
  availableCount,
  onLevelChange,
  showDuration,
  duration,
  setDuration,
}: {
  level: WaecLevel;
  setLevel: (v: WaecLevel) => void;
  subjectId: string;
  setSubjectId: (v: string) => void;
  levelSubjects: WaecSubject[];
  paperType: WaecPaperType;
  setPaperType: (v: WaecPaperType) => void;
  topic: string;
  setTopic: (v: string) => void;
  topics: string[];
  questionCount: string;
  setQuestionCount: (v: string) => void;
  availableCount?: number;
  onLevelChange?: (level: WaecLevel) => void;
  showDuration?: boolean;
  duration?: string;
  setDuration?: (v: string) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label>Level</Label>
        <Select value={level} onValueChange={(v) => {
          const lv = v as WaecLevel;
          setLevel(lv);
          setSubjectId("");
          onLevelChange?.(lv);
        }}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="bece">{WAEC_LEVEL_LABELS.bece}</SelectItem>
            <SelectItem value="wassce">{WAEC_LEVEL_LABELS.wassce}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Subject</Label>
        <Select value={subjectId || "none"} onValueChange={(v) => setSubjectId(v === "none" ? "" : v)}>
          <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none" disabled>Select subject</SelectItem>
            {levelSubjects.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label>Paper type</Label>
        <Select value={paperType} onValueChange={(v) => setPaperType(v as WaecPaperType)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {(Object.keys(WAEC_PAPER_LABELS) as WaecPaperType[]).map((p) => (
              <SelectItem key={p} value={p}>{WAEC_PAPER_LABELS[p]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {topics.length > 0 ? (
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Topic</Label>
          <Select value={topic} onValueChange={setTopic}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All topics</SelectItem>
              {topics.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
      <div className="space-y-1.5">
        <Label>Number of questions</Label>
        <Input type="number" min={5} max={100} value={questionCount} onChange={(e) => setQuestionCount(e.target.value)} />
      </div>
      {showDuration && setDuration ? (
        <div className="space-y-1.5">
          <Label>Duration (minutes)</Label>
          <Input type="number" min={30} max={180} value={duration} onChange={(e) => setDuration(e.target.value)} />
        </div>
      ) : null}
      {subjectId && availableCount != null ? (
        <p className="text-xs text-muted-foreground sm:col-span-2">
          {availableCount.toLocaleString()} WAEC-style question(s) available for this subject
        </p>
      ) : null}
    </div>
  );
}
