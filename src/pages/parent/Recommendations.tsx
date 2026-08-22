// @ts-nocheck
import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, MessageCircle } from "lucide-react";
import { ExportMenu } from "@/modules/lib/ExportMenu";

type Rec = {
  id: string;
  student_id: string;
  recommendation_type: string;
  suggestions: string;
  strengths: string | null;
  weaknesses: string | null;
  threshold_alert: boolean;
  created_at: string;
};

const ParentRecommendations = () => {
  const [recs, setRecs] = useState<Rec[]>([]);
  const [students, setStudents] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("academic_recommendations")
        .select("id, student_id, recommendation_type, suggestions, strengths, weaknesses, threshold_alert, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      setRecs((data ?? []) as Rec[]);

      const ids = Array.from(new Set((data ?? []).map((r: Rec) => r.student_id)));
      if (ids.length) {
        const { data: s } = await supabase
          .from("students")
          .select("id, full_name, admission_no, profiles:profile_id(full_name)")
          .in("id", ids);
        const map: Record<string, string> = {};
        (s ?? []).forEach((row: any) => {
          map[row.id] = row.full_name || row.profiles?.full_name || row.admission_no || "Student";
        });
        setStudents(map);
      }
      setLoading(false);
    })();
  }, []);

  return (
    <DashboardLayout role="parent">
      <div className="mingo-content space-y-6">
        <div>
          <h2 className="font-display text-[21px] font-semibold tracking-tight text-foreground">Recommendations</h2>
          <p className="text-[12.5px] text-muted-foreground mt-1">Academic suggestions and alerts from your child's class teacher.</p>
        </div>
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2"><MessageCircle className="h-5 w-5" /> Latest recommendations</CardTitle>
              <CardDescription>Sorted by most recent first.</CardDescription>
            </div>
            <ExportMenu
              filename="parent-recommendations"
              title="Recommendations"
              headers={["Date", "Child", "Type", "Strengths", "Areas to improve", "Suggestion", "Alert"]}
              rows={recs.map((r) => [
                new Date(r.created_at).toLocaleDateString(),
                students[r.student_id] ?? "—",
                r.recommendation_type,
                r.strengths ?? "—",
                r.weaknesses ?? "—",
                r.suggestions,
                r.threshold_alert ? "Priority" : "Info",
              ])}
              disabled={recs.length === 0}
            />
          </CardHeader>
          <CardContent>
            {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Child</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Strengths</TableHead>
                    <TableHead>Areas to improve</TableHead>
                    <TableHead>Suggestion</TableHead>
                    <TableHead>Alert</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recs.map((r) => (
                    <TableRow key={r.id} className={r.threshold_alert ? "bg-destructive/5" : ""}>
                      <TableCell>{new Date(r.created_at).toLocaleDateString()}</TableCell>
                      <TableCell className="font-medium">{students[r.student_id] ?? "—"}</TableCell>
                      <TableCell><Badge variant="outline">{r.recommendation_type}</Badge></TableCell>
                      <TableCell className="max-w-xs whitespace-pre-wrap text-sm">{r.strengths ?? "—"}</TableCell>
                      <TableCell className="max-w-xs whitespace-pre-wrap text-sm">{r.weaknesses ?? "—"}</TableCell>
                      <TableCell className="max-w-md whitespace-pre-wrap text-sm">{r.suggestions}</TableCell>
                      <TableCell>{r.threshold_alert ? <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />Priority</Badge> : <Badge variant="secondary">Info</Badge>}</TableCell>
                    </TableRow>
                  ))}
                  {!recs.length && (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No recommendations yet.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default ParentRecommendations;
