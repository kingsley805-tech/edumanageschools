import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/report/hooks/use-auth";
import { useCurrentTerm, useGradingFormat } from "@/report/hooks/use-school-data";
import { useGeneratePositions } from "@/report/hooks/use-generate-positions";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";
import { PageHeader } from "@/report/portal/page-header";
import { GeneratePositionsCard } from "@/report/portal/generate-positions-card";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { computeGrade } from "@/report/lib/grading";
import { formatRankLabel } from "@/report/lib/shepherd-grading";
import { clearClassRankingsCache, rankSubjectScores } from "@/report/lib/ranking";
import { useClientPagination } from "@/report/hooks/use-client-pagination";
import { TablePagination } from "@/report/portal/table-pagination";
import { withReportLayout } from "@/report/withReportLayout";
import { fetchTeacherRecordId } from "@/report/lib/teacher-assignments";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type ScoreCell = { ca: string; exam: string };
type RowSaveState = "idle" | "pending" | "saving" | "saved" | "error";

function TeacherScores() {
  const { user } = useAuth();
  const { data: term } = useCurrentTerm();
  const gradingFormat = useGradingFormat();
  const qc = useQueryClient();
  const [classSubjectId, setClassSubjectId] = useState("");
  const [scores, setScores] = useState<Record<string, ScoreCell>>({});
  const [rowState, setRowState] = useState<Record<string, RowSaveState>>({});
  const regenTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef<Set<string>>(new Set());
  const pendingPayload = useRef<Map<string, ScoreCell>>(new Map());
  const baselineRef = useRef<Record<string, ScoreCell>>({});

  const { data: assignments } = useQuery({
    queryKey: ["teacher-assignments", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const teacherRecordId = await fetchTeacherRecordId(user!.id);
      if (!teacherRecordId) return [];
      const { data, error } = await supabase
        .from("class_subjects")
        .select("id, class_id, subject_id, classes(name), subjects(name)")
        .eq("teacher_id", teacherRecordId);
      if (error) throw error;
      return data ?? [];
    },
  });

  const selected = assignments?.find((a) => a.id === classSubjectId);
  const activeClassId = selected?.class_id;

  const {
    generate: generatePositions,
    progress: scoringProgress,
    progressLoading,
    isGenerating,
    progressPct,
  } = useGeneratePositions({
    classId: activeClassId,
    termId: term?.id,
  });

  const { data: students } = useQuery({
    queryKey: ["class-students", selected?.class_id],
    enabled: !!selected?.class_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("students")
        .select("id, full_name")
        .eq("class_id", selected!.class_id);
      return data ?? [];
    },
  });

  const { data: existing } = useQuery({
    queryKey: ["class-results", selected?.class_id, selected?.subject_id, term?.id],
    enabled: !!selected && !!term?.id,
    queryFn: async () => {
      const ids = students?.map((s) => s.id) ?? [];
      if (!ids.length) return [];
      const { data } = await supabase
        .from("results")
        .select("*")
        .in("student_id", ids)
        .eq("subject_id", selected!.subject_id)
        .eq("term_id", term!.id);
      const map: Record<string, ScoreCell> = {};
      for (const r of data ?? []) {
        map[r.student_id] = { ca: String(r.ca_score), exam: String(r.exam_score) };
      }
      setScores(map);
      baselineRef.current = { ...map };
      setRowState({});
      return data ?? [];
    },
  });

  const schedulePositionRegeneration = useCallback(() => {
    if (!activeClassId || !term?.id) return;
    if (regenTimer.current) clearTimeout(regenTimer.current);
    regenTimer.current = setTimeout(() => {
      generatePositions.mutate({ silent: true });
    }, 1200);
  }, [activeClassId, term?.id, generatePositions]);

  const upsertOne = useMutation({
    mutationFn: async ({
      studentId,
      ca,
      exam,
    }: {
      studentId: string;
      ca: number;
      exam: number;
    }) => {
      if (!selected || !term || !user) throw new Error("Missing context");
      const total = ca + exam;
      const { grade, remark } = computeGrade(total, gradingFormat);
      const { error } = await supabase.from("results").upsert(
        {
          student_id: studentId,
          subject_id: selected.subject_id,
          term_id: term.id,
          ca_score: ca,
          exam_score: exam,
          grade,
          remark,
          teacher_id: user.id,
          submitted: false,
          position: null,
        },
        { onConflict: "student_id,subject_id,term_id" },
      );
      if (error) throw error;
    },
  });

  const hasSubmitted = existing?.some((r) => r.submitted) ?? false;

  const flushStudentSave = useCallback(
    async (studentId: string) => {
      if (!selected || !term || hasSubmitted) return;
      const payload = pendingPayload.current.get(studentId);
      if (!payload) return;
      if (inFlight.current.has(studentId)) return;

      const ca = Math.min(40, Math.max(0, Number(payload.ca) || 0));
      const exam = Math.min(60, Math.max(0, Number(payload.exam) || 0));
      const base = baselineRef.current[studentId];
      if (base && Number(base.ca) === ca && Number(base.exam) === exam) {
        pendingPayload.current.delete(studentId);
        setRowState((s) => ({ ...s, [studentId]: "idle" }));
        return;
      }

      inFlight.current.add(studentId);
      setRowState((s) => ({ ...s, [studentId]: "saving" }));
      try {
        await upsertOne.mutateAsync({ studentId, ca, exam });
        baselineRef.current[studentId] = { ca: String(ca), exam: String(exam) };
        pendingPayload.current.delete(studentId);
        setRowState((s) => ({ ...s, [studentId]: "saved" }));
        if (activeClassId && term.id) clearClassRankingsCache(activeClassId, term.id);
        qc.invalidateQueries({ queryKey: ["class-results"] });
        schedulePositionRegeneration();
        setTimeout(() => {
          setRowState((s) => (s[studentId] === "saved" ? { ...s, [studentId]: "idle" } : s));
        }, 2000);
      } catch (e) {
        setRowState((s) => ({ ...s, [studentId]: "error" }));
        toast.error((e as Error).message || "Failed to save score");
      } finally {
        inFlight.current.delete(studentId);
      }
    },
    [selected, term, hasSubmitted, upsertOne, activeClassId, qc, schedulePositionRegeneration],
  );

  const debouncedFlush = useDebouncedCallback((studentId: string) => {
    void flushStudentSave(studentId);
  }, 650);

  const queueAutosave = (studentId: string, next: ScoreCell) => {
    pendingPayload.current.set(studentId, next);
    setRowState((s) => ({ ...s, [studentId]: "pending" }));
    debouncedFlush(studentId);
  };

  const updateScore = (studentId: string, field: "ca" | "exam", value: string) => {
    setScores((prev) => {
      const row = prev[studentId] ?? { ca: "", exam: "" };
      const next = { ...row, [field]: value };
      queueAutosave(studentId, next);
      return { ...prev, [studentId]: next };
    });
  };

  const submitAll = useMutation({
    mutationFn: async () => {
      if (!selected || !term) return;
      for (const st of students ?? []) {
        const s = scores[st.id] ?? { ca: "0", exam: "0" };
        const ca = Math.min(40, Math.max(0, Number(s.ca) || 0));
        const exam = Math.min(60, Math.max(0, Number(s.exam) || 0));
        const total = ca + exam;
        const { grade, remark } = computeGrade(total, gradingFormat);
        await supabase.from("results").upsert(
          {
            student_id: st.id,
            subject_id: selected.subject_id,
            term_id: term.id,
            ca_score: ca,
            exam_score: exam,
            grade,
            remark,
            teacher_id: user!.id,
            submitted: true,
            position: null,
          },
          { onConflict: "student_id,subject_id,term_id" },
        );
      }
    },
    onSuccess: () => {
      if (activeClassId && term?.id) clearClassRankingsCache(activeClassId, term.id);
      qc.invalidateQueries({ queryKey: ["class-results"] });
      toast.success("Results submitted — editing locked");
      schedulePositionRegeneration();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  useEffect(() => {
    return () => {
      if (regenTimer.current) clearTimeout(regenTimer.current);
    };
  }, []);

  const studentList = students ?? [];
  const pag = useClientPagination(studentList, { resetKey: classSubjectId });
  const className = selected ? (selected.classes as { name: string })?.name : null;

  const positionByStudent = rankSubjectScores(
    (students ?? []).map((st) => {
      const saved = existing?.find((r) => r.student_id === st.id);
      const draft = scores[st.id];
      const ca = draft?.ca !== undefined && draft.ca !== "" ? draft.ca : saved?.ca_score;
      const exam = draft?.exam !== undefined && draft.exam !== "" ? draft.exam : saved?.exam_score;
      const hasMark = !!saved || !!(draft?.ca || draft?.exam);
      return {
        studentId: st.id,
        ca: ca ?? 0,
        exam: exam ?? 0,
        hasMark,
      };
    }),
  );

  const anySaving = Object.values(rowState).some((s) => s === "saving" || s === "pending");

  return (
    <>
      <PageHeader
        title="Enter scores"
        description="CA (max 40) and Exam (max 60). Marks auto-save as you type. Submit when ready to lock edits."
      />
      <div className="space-y-4 p-6 md:p-8">
        <Select value={classSubjectId} onValueChange={setClassSubjectId}>
          <SelectTrigger className="max-w-md">
            <SelectValue placeholder="Select class & subject" />
          </SelectTrigger>
          <SelectContent>
            {assignments?.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {(a.classes as { name: string })?.name} — {(a.subjects as { name: string })?.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selected && !hasSubmitted && (
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {anySaving ? (
              <Badge variant="secondary" className="gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                Saving…
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1 text-green-700 border-green-200">
                <Check className="h-3 w-3" />
                All changes saved
              </Badge>
            )}
          </div>
        )}

        {activeClassId && term && (
          <GeneratePositionsCard
            className={className}
            classId={activeClassId}
            termId={term.id}
            progress={scoringProgress}
            progressPct={progressPct}
            progressLoading={progressLoading}
            isGenerating={isGenerating}
            onGenerate={() => generatePositions.mutate({})}
          />
        )}

        {selected && studentList.length ? (
          <Card>
            <CardContent className="p-0">
              <div className="table-scroll overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>CA (40)</TableHead>
                      <TableHead>Exam (60)</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Grade</TableHead>
                      <TableHead>Subject position</TableHead>
                      <TableHead className="w-16 text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pag.slice.map((st) => {
                      const s = scores[st.id] ?? { ca: "", exam: "" };
                      const total = (Number(s.ca) || 0) + (Number(s.exam) || 0);
                      const { grade } = total > 0 ? computeGrade(total, gradingFormat) : { grade: "—" };
                      const position = positionByStudent.get(st.id) ?? null;
                      const state = rowState[st.id] ?? "idle";
                      return (
                        <TableRow key={st.id}>
                          <TableCell className="font-medium">{st.full_name}</TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={0}
                              max={40}
                              className="w-20"
                              disabled={hasSubmitted}
                              value={s.ca}
                              onChange={(e) => updateScore(st.id, "ca", e.target.value)}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={0}
                              max={60}
                              className="w-20"
                              disabled={hasSubmitted}
                              value={s.exam}
                              onChange={(e) => updateScore(st.id, "exam", e.target.value)}
                            />
                          </TableCell>
                          <TableCell className="font-semibold">{total || "—"}</TableCell>
                          <TableCell className="font-medium">{grade}</TableCell>
                          <TableCell className="font-semibold text-muted-foreground">
                            {position != null ? formatRankLabel(position) : "—"}
                          </TableCell>
                          <TableCell className="text-center">
                            {state === "saving" || state === "pending" ? (
                              <Loader2 className="mx-auto h-4 w-4 animate-spin text-muted-foreground" />
                            ) : state === "saved" ? (
                              <Check className="mx-auto h-4 w-4 text-green-600" />
                            ) : state === "error" ? (
                              <span className="text-xs text-destructive">!</span>
                            ) : null}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <TablePagination
                page={pag.page}
                totalPages={pag.totalPages}
                total={pag.total}
                from={pag.from}
                to={pag.to}
                pageSize={pag.pageSize}
                pageSizes={pag.pageSizes}
                onPageChange={pag.setPage}
                onPageSizeChange={pag.setPageSize}
              />
              {!hasSubmitted && (
                <div className="flex flex-wrap items-center gap-2 border-t p-4">
                  <Button
                    onClick={() => submitAll.mutate()}
                    disabled={submitAll.isPending || anySaving}
                  >
                    {submitAll.isPending ? "Submitting…" : "Submit results (lock editing)"}
                  </Button>
                  <p className={cn("text-xs text-muted-foreground", anySaving && "opacity-70")}>
                    Draft scores are saved automatically. Submit when finished.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        ) : selected ? (
          <p className="text-muted-foreground">No students in this class.</p>
        ) : null}
      </div>
    </>
  );
}

export default withReportLayout("teacher", TeacherScores);
