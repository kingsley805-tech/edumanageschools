// @ts-nocheck
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Eye } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { computeLessonNoteStats, listLessonNotes } from "@/lesson-notes/lib/api";
import { LessonNoteStatsCards } from "@/lesson-notes/components/LessonNoteStatsCards";
import { LessonNoteStatusBadge } from "@/lesson-notes/components/LessonNoteStatusBadge";
import { DAYS_OF_WEEK, LESSON_NOTE_STATUSES } from "@/lesson-notes/lib/types";

export default function AdminLessonNotes() {
  const { user } = useAuth();
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [weekFilter, setWeekFilter] = useState("all");

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: profile } = await supabase.from("profiles").select("school_id").eq("id", user.id).maybeSingle();
      const sid = profile?.school_id ?? null;
      setSchoolId(sid);
      if (!sid) {
        setNotes([]);
        return;
      }
      const rows = await listLessonNotes({
        schoolId: sid,
        search,
        status: statusFilter,
        week: weekFilter !== "all" ? Number(weekFilter) : undefined,
      });
      setNotes(rows);
    } finally {
      setLoading(false);
    }
  }, [user, search, statusFilter, weekFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!schoolId) return;
    const channel = supabase
      .channel(`admin-lesson-notes-${schoolId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "lesson_notes", filter: `school_id=eq.${schoolId}` },
        () => void load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [schoolId, load]);

  const stats = useMemo(() => computeLessonNoteStats(notes), [notes]);
  const pendingTeachers = useMemo(() => {
    const set = new Set(
      notes.filter((n) => n.status === "pending_review").map((n) => n.teacher_name ?? n.teacher_id),
    );
    return set.size;
  }, [notes]);

  return (
    <DashboardLayout role="admin">
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Lesson notes</h1>
        <p className="text-sm text-muted-foreground">
          Review and approve weekly lesson plans · {pendingTeachers} teacher(s) with pending submissions
        </p>
      </div>

      <LessonNoteStatsCards stats={stats} />

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search topic, teacher…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {LESSON_NOTE_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s.replace(/_/g, " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={weekFilter} onValueChange={setWeekFilter}>
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="Week" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All weeks</SelectItem>
            {Array.from({ length: 16 }, (_, i) => i + 1).map((w) => (
              <SelectItem key={w} value={String(w)}>
                Week {w}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border bg-card overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="px-4 py-3 text-left">Teacher</th>
              <th className="px-4 py-3 text-left">Topic</th>
              <th className="px-4 py-3 text-left">Class</th>
              <th className="px-4 py-3 text-left">Subject</th>
              <th className="px-4 py-3 text-left">Week</th>
              <th className="px-4 py-3 text-left">Day</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Submitted</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            ) : notes.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">
                  No lesson notes found.
                </td>
              </tr>
            ) : (
              notes.map((n) => (
                <tr key={n.id} className="border-b hover:bg-muted/20">
                  <td className="px-4 py-3">{n.teacher_name ?? "—"}</td>
                  <td className="px-4 py-3 font-medium">{n.topic}</td>
                  <td className="px-4 py-3">{n.classes?.name ?? "—"}</td>
                  <td className="px-4 py-3">{n.subjects?.name ?? "—"}</td>
                  <td className="px-4 py-3">W{n.week_number}</td>
                  <td className="px-4 py-3 capitalize">
                    {DAYS_OF_WEEK.find((d) => d.value === n.day_of_week)?.label ?? n.day_of_week}
                  </td>
                  <td className="px-4 py-3">
                    <LessonNoteStatusBadge status={n.status} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {n.submitted_at ? new Date(n.submitted_at).toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <Link to={`/admin/lesson-notes/${n.id}`}>
                        <Eye className="h-4 w-4 mr-1" />
                        Review
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
    </DashboardLayout>
  );
}
