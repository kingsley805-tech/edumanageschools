// @ts-nocheck
import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Activity } from "lucide-react";

type Log = {
  id: string;
  action_type: string;
  entity_type: string | null;
  entity_id: string | null;
  performed_by: string | null;
  details: any;
  module: string | null;
  created_at: string;
  performer_name?: string;
};

const ClassTeacherActivity = () => {
  const [logs, setLogs] = useState<Log[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data: p } = await supabase.from("profiles").select("school_id").eq("id", u.user.id).maybeSingle();
      if (!p?.school_id) { setLoading(false); return; }

      const { data } = await supabase
        .from("audit_logs")
        .select("id, action_type, entity_type, entity_id, performed_by, details, module, created_at")
        .eq("school_id", p.school_id)
        .eq("module", "class_teacher")
        .order("created_at", { ascending: false })
        .limit(500);

      const ids = Array.from(new Set((data ?? []).map((l: Log) => l.performed_by).filter(Boolean)));
      let names: Record<string, string> = {};
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", ids);
        (profs ?? []).forEach((row: any) => { names[row.id] = row.full_name; });
      }
      setLogs(((data ?? []) as Log[]).map((l) => ({ ...l, performer_name: l.performed_by ? names[l.performed_by] : undefined })));
      setLoading(false);
    })();
  }, []);

  const filtered = logs.filter((l) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      l.action_type?.toLowerCase().includes(s) ||
      l.performer_name?.toLowerCase().includes(s) ||
      JSON.stringify(l.details ?? {}).toLowerCase().includes(s)
    );
  });

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Class Teacher Activity</h2>
          <p className="text-muted-foreground">Audit log of class teacher assignments, recommendations sent to parents, and related events.</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5" /> Activity log</CardTitle>
            <CardDescription>Last 500 events.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-3">
              <Input placeholder="Filter by action, person, or details…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
            </div>
            {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Performed by</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="whitespace-nowrap">{new Date(l.created_at).toLocaleString()}</TableCell>
                      <TableCell><Badge variant="outline">{l.action_type}</Badge></TableCell>
                      <TableCell>{l.performer_name ?? "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{l.entity_type} {l.entity_id?.slice(0, 8)}</TableCell>
                      <TableCell className="max-w-md"><pre className="text-xs whitespace-pre-wrap">{JSON.stringify(l.details, null, 1)}</pre></TableCell>
                    </TableRow>
                  ))}
                  {!filtered.length && (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No activity yet.</TableCell></TableRow>
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

export default ClassTeacherActivity;
