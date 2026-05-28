import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/report/hooks/use-auth";
import { useCurrentTerm } from "@/report/hooks/use-school-data";
import { PageHeader } from "@/report/portal/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PerformanceAreaChart } from "@/report/portal/performance-chart";
import { gradeColor } from "@/report/lib/grading";
import { formatRankLabel } from "@/report/lib/shepherd-grading";
import { useClientPagination } from "@/report/hooks/use-client-pagination";
import { TablePagination } from "@/report/portal/table-pagination";
import { Badge } from "@/components/ui/badge";
import { withReportLayout } from "@/report/withReportLayout";

async function resolveStudentId(userId: string): Promise<string | null> {
  let { data } = await supabase.from("students").select("id").eq("profile_id", userId).maybeSingle();
  if (!data) {
    ({ data } = await supabase.from("students").select("id").eq("user_id", userId).maybeSingle());
  }
  return data?.id ?? null;
}

function StudentPerformance() {
  const { user } = useAuth();
  const { data: term } = useCurrentTerm();

  const { data, isLoading } = useQuery({
    queryKey: ["student-performance", user?.id, term?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const studentId = await resolveStudentId(user!.id);
      if (!studentId) return null;

      let resultsQuery = supabase
        .from("results")
        .select("id, total, grade, position, term_id, subjects(name)")
        .eq("student_id", studentId)
        .eq("submitted", true);

      if (term?.id) resultsQuery = resultsQuery.eq("term_id", term.id);

      const { data: results } = await resultsQuery;

      let classPosition: string | null = null;
      if (term?.id) {
        const { data: report } = await supabase
          .from("term_report_cards")
          .select("class_position")
          .eq("student_id", studentId)
          .eq("term_id", term.id)
          .maybeSingle();
        classPosition = report?.class_position ?? null;
      }

      const chart = (results ?? []).map((r) => ({
        name: ((r.subjects as { name: string })?.name ?? "").slice(0, 10),
        score: Number(r.total),
      }));

      const totalScore = (results ?? []).reduce((a, r) => a + Number(r.total || 0), 0);
      const average =
        results?.length ? Math.round((totalScore / results.length) * 10) / 10 : 0;

      return {
        results: results ?? [],
        chart,
        classPosition,
        average,
        subjectCount: results?.length ?? 0,
      };
    },
  });

  const results = data?.results ?? [];
  const pag = useClientPagination(results);

  return (
    <>
      <PageHeader
        title="Performance"
        description="Your academic progress, positions, and subject scores."
      />
      <div className="space-y-6 p-6 md:p-8">
        {(data?.classPosition || (data?.average ?? 0) > 0) && (
          <div className="flex flex-wrap gap-3">
            {data?.classPosition && (
              <Badge variant="secondary" className="px-4 py-2 text-base font-semibold">
                Class position: {formatRankLabel(data.classPosition)}
              </Badge>
            )}
            {(data?.average ?? 0) > 0 && (
              <Badge variant="outline" className="px-4 py-2 text-base">
                Term average: {data.average}%
              </Badge>
            )}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="font-display">Subject scores</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground">Loading…</p>
            ) : data?.chart?.length ? (
              <PerformanceAreaChart data={data.chart} />
            ) : (
              <p className="text-muted-foreground">No results yet</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display">All subjects</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="table-scroll">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subject</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                    <TableHead className="text-right">Position</TableHead>
                    <TableHead className="text-right">Grade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pag.total ? (
                    pag.slice.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">
                          {(r.subjects as { name: string })?.name}
                        </TableCell>
                        <TableCell
                          className={`text-right font-display font-semibold ${gradeColor(r.grade ?? "")}`}
                        >
                          {r.total}%
                        </TableCell>
                        <TableCell className="text-right font-semibold text-muted-foreground">
                          {r.position != null ? formatRankLabel(r.position) : "—"}
                        </TableCell>
                        <TableCell className={`text-right ${gradeColor(r.grade ?? "")}`}>
                          {r.grade}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                        No results yet
                      </TableCell>
                    </TableRow>
                  )}
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
          </CardContent>
        </Card>
      </div>
    </>
  );
}

export default withReportLayout("student", StudentPerformance);
