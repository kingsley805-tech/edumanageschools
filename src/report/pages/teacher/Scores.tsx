import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/report/hooks/use-auth";
import { useCurrentTerm, useGradingFormat } from "@/report/hooks/use-school-data";
import { useGeneratePositions } from "@/report/hooks/use-generate-positions";
import { PageHeader } from "@/report/portal/page-header";
import { GeneratePositionsCard } from "@/report/portal/generate-positions-card";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { computeGrade } from "@/report/lib/grading";
import { formatRankLabel } from "@/report/lib/shepherd-grading";
import { clearClassRankingsCache, rankSubjectScores } from "@/report/lib/ranking";
import { useClientPagination } from "@/report/hooks/use-client-pagination";
import { TablePagination } from "@/report/portal/table-pagination";
import { withReportLayout } from "@/report/withReportLayout";
import { fetchTeacherRecordId } from "@/report/lib/teacher-assignments";

function TeacherScores() {
  const { user } = useAuth();
  const { data: term } = useCurrentTerm();
  const gradingFormat = useGradingFormat();
  const qc = useQueryClient();
  const [classSubjectId, setClassSubjectId] = useState("");
  const [scores, setScores] = useState<Record<string, { ca: string; exam: string }>>({});
  const regenTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      const map: Record<string, { ca: string; exam: string }> = {};
      for (const r of data ?? []) {
        map[r.student_id] = { ca: String(r.ca_score), exam: String(r.exam_score) };
      }
      setScores(map);
      return data ?? [];
    },
  });

  const schedulePositionRegeneration = () => {
    if (!activeClassId || !term?.id) return;
    if (regenTimer.current) clearTimeout(regenTimer.current);
    regenTimer.current = setTimeout(() => {
      generatePositions.mutate({ silent: true });
    }, 900);
  };

  const saveScores = useMutation({
    mutationFn: async (submit: boolean) => {
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
            submitted: submit,
            position: null,
          },
          { onConflict: "student_id,subject_id,term_id" },
        );
      }
    },
    onSuccess: (_, submit) => {
      if (activeClassId && term?.id) clearClassRankingsCache(activeClassId, term.id);
      qc.invalidateQueries({ queryKey: ["class-results"] });
      qc.invalidateQueries({ queryKey: ["class-scoring-progress"] });
      toast.success(submit ? "Results submitted" : "Scores saved as draft");
      schedulePositionRegeneration();
    },
    onError: (e: Error) => toast.error(e.message),
  });

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

  const hasSubmitted = existing?.some((r) => r.submitted);
  const studentList = students ?? [];
  const pag = useClientPagination(studentList, { resetKey: classSubjectId });
  const className = selected ? (selected.classes as { name: string })?.name : null;

  return (
    <>
      <PageHeader
        title="Enter scores"
        description="CA (max 40) and Exam (max 60). Submit when ready — edits locked after submission."
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
              <div className="table-scroll">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>CA (40)</TableHead>
                      <TableHead>Exam (60)</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Subject position</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pag.slice.map((st) => {
                      const s = scores[st.id] ?? { ca: "", exam: "" };
                      const total = (Number(s.ca) || 0) + (Number(s.exam) || 0);
                      const position = positionByStudent.get(st.id) ?? null;
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
                              onChange={(e) =>
                                setScores({ ...scores, [st.id]: { ...s, ca: e.target.value } })
                              }
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
                              onChange={(e) =>
                                setScores({ ...scores, [st.id]: { ...s, exam: e.target.value } })
                              }
                            />
                          </TableCell>
                          <TableCell className="font-semibold">{total}</TableCell>
                          <TableCell className="font-semibold text-muted-foreground">
                            {position != null ? formatRankLabel(position) : "—"}
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
                <div className="flex flex-wrap gap-2 border-t p-4">
                  <Button
                    variant="outline"
                    onClick={() => saveScores.mutate(false)}
                    disabled={saveScores.isPending}
                  >
                    Save draft
                  </Button>
                  <Button onClick={() => saveScores.mutate(true)} disabled={saveScores.isPending}>
                    Submit results
                  </Button>
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
