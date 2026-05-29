import { useEffect, useMemo, useState, type ReactNode } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Printer, Calendar } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { TimetableGrid } from "@/timetable/components/TimetableGrid";
import { fetchPeriods, fetchSchedules, fetchSchoolId, seedDefaultPeriods } from "@/timetable/lib/api";
import { exportTimetableExcel, exportTimetablePdf } from "@/timetable/lib/export";
import type { ScheduleEntry, TimetablePeriod } from "@/timetable/lib/types";
import { toast } from "sonner";

type PortalRole = "student" | "teacher" | "parent";

export function TimetablePortalView({
  role,
  childStudentId,
  embedded,
}: {
  role: PortalRole;
  childStudentId?: string;
  embedded?: boolean;
}) {
  const { user } = useAuth();
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [periods, setPeriods] = useState<TimetablePeriod[]>([]);
  const [title, setTitle] = useState("My Timetable");
  const [schoolName, setSchoolName] = useState("School");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      if (!user) return;
      setLoading(true);
      try {
        const schoolId = await fetchSchoolId(user.id);
        if (!schoolId) return;

        const { data: school } = await supabase.from("schools").select("name").eq("id", schoolId).maybeSingle();
        setSchoolName(school?.name ?? "School");

        let per = await fetchPeriods(schoolId);
        if (per.length === 0) per = await seedDefaultPeriods(schoolId);
        setPeriods(per);

        if (role === "student") {
          const { data: st } = await supabase
            .from("students")
            .select("class_id, classes(name)")
            .eq("user_id", user.id)
            .maybeSingle();
          if (!st?.class_id) return;
          setTitle(`${(st.classes as { name?: string })?.name ?? "Class"} Timetable`);
          setEntries(await fetchSchedules({ classId: st.class_id, publishedOnly: true }));
        } else if (role === "parent" && childStudentId) {
          const { data: st } = await supabase
            .from("students")
            .select("class_id, profiles(full_name), classes(name)")
            .eq("id", childStudentId)
            .maybeSingle();
          if (!st?.class_id) return;
          setTitle(`${(st.profiles as { full_name?: string })?.full_name ?? "Child"} — ${(st.classes as { name?: string })?.name}`);
          setEntries(await fetchSchedules({ classId: st.class_id, publishedOnly: true }));
        } else if (role === "teacher") {
          const { data: t } = await supabase.from("teachers").select("id").eq("user_id", user.id).maybeSingle();
          if (!t) return;
          setTitle("My Teaching Schedule");
          setEntries(await fetchSchedules({ teacherId: t.id, publishedOnly: true }));
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to load timetable");
      } finally {
        setLoading(false);
      }
    })();
  }, [user, role, childStudentId]);

  const layoutRole = role === "parent" ? "parent" : role;
  const Wrapper = embedded
    ? ({ children }: { children: ReactNode }) => <div className="space-y-6">{children}</div>
    : ({ children }: { children: ReactNode }) => (
        <DashboardLayout role={layoutRole}>{children}</DashboardLayout>
      );

  const today = new Date().getDay();
  const todayEntries = useMemo(
    () => entries.filter((e) => e.day_of_week === today).sort((a, b) => a.start_time.localeCompare(b.start_time)),
    [entries, today],
  );

  return (
    <Wrapper>
      <div className="space-y-6" id="timetable-print-root">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Calendar className="h-6 w-6 text-primary" />
              {title}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Weekly schedule · {schoolName}</p>
          </div>
          <div className="flex gap-2 print:hidden">
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="h-4 w-4 mr-1" />
              Print
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (!entries.length) return toast.error("No timetable to export");
                exportTimetableExcel(title, entries, periods);
              }}
            >
              <Download className="h-4 w-4 mr-1" />
              Export
            </Button>
          </div>
        </div>

        {todayEntries.length > 0 ? (
          <Card className="border-primary/30 bg-primary/5 print:hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Today&apos;s schedule</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {todayEntries.map((e) => (
                <div key={e.id} className="rounded-lg border border-primary/20 bg-card px-3 py-2 text-sm">
                  <span className="font-medium">{e.subjects?.name}</span>
                  <span className="text-muted-foreground ml-2">
                    {e.start_time.slice(0, 5)} – {e.end_time.slice(0, 5)}
                    {e.room ? ` · ${e.room}` : ""}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}

        {loading ? (
          <p className="text-center py-16 text-muted-foreground">Loading timetable…</p>
        ) : entries.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              No published timetable available yet.
            </CardContent>
          </Card>
        ) : role === "teacher" ? (
          <div className="space-y-3">
            {entries.map((e) => (
              <div
                key={e.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4"
              >
                <div className="rounded-lg bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][e.day_of_week]}
                </div>
                <div>
                  <p className="font-semibold">{e.subjects?.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(e.classes as { name?: string })?.name ?? "Class"} · {e.start_time.slice(0, 5)} –{" "}
                    {e.end_time.slice(0, 5)}
                    {e.room ? ` · ${e.room}` : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <TimetableGrid periods={periods} entries={entries} />
        )}
      </div>
    </Wrapper>
  );
}
