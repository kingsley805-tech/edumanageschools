// @ts-nocheck
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Eye } from "lucide-react";
import { fetchTeacherRecordId } from "@/report/lib/teacher-assignments";
import { computeLessonNoteStats, listLessonNotes } from "@/lesson-notes/lib/api";
import { LessonNoteStatsCards } from "@/lesson-notes/components/LessonNoteStatsCards";
import { LessonNoteStatusBadge } from "@/lesson-notes/components/LessonNoteStatusBadge";
import { DAYS_OF_WEEK, LESSON_NOTE_STATUSES } from "@/lesson-notes/lib/types";
import { supabase } from "@/integrations/supabase/client";

export default function TeacherLessonNotes() {
  const { user } = useAuth();
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const teacherId = await fetchTeacherRecordId(user.id);
      if (!teacherId) {
        setNotes([]);
        return;
      }
      const rows = await listLessonNotes({ teacherId, search, status: statusFilter });
      setNotes(rows);
    } finally {
      setLoading(false);
    }
  }, [user, search, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`teacher-lesson-notes-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "lesson_notes" }, () => void load())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user, load]);

  const stats = useMemo(() => computeLessonNoteStats(notes), [notes]);

  return (
    <DashboardLayout role="teacher">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Lesson notes</h2>
            <p className="text-muted-foreground">Create, submit, and track weekly lesson plans</p>
          </div>
          <Button asChild>
            <Link to="/teacher/lesson-notes/new">
              <Plus className="mr-2 h-4 w-4" />
              New lesson note
            </Link>
          </Button>
        </div>

        <LessonNoteStatsCards stats={stats} />

        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search topic…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
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
        </div>

        <div className="rounded-xl border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Topic</th>
                <th className="px-4 py-3 text-left font-medium">Class</th>
                <th className="px-4 py-3 text-left font-medium">Subject</th>
                <th className="px-4 py-3 text-left font-medium">Week</th>
                <th className="px-4 py-3 text-left font-medium">Day</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              ) : notes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                    No lesson notes yet. Create your first note.
                  </td>
                </tr>
              ) : (
                notes.map((n) => (
                  <tr key={n.id} className="border-b last:border-0 hover:bg-muted/20">
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
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={`/teacher/lesson-notes/${n.id}`}>
                          <Eye className="h-4 w-4 mr-1" />
                          Open
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
