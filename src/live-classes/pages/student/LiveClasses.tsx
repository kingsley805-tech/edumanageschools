import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { PortalPageHeader } from "@/components/PortalPageHeader";
import { LiveClassSessionCard } from "@/live-classes/components/LiveClassSessionCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchLiveClassSessions,
  fetchStudentOnlineAttendance,
  recordJoin,
  recordLeave,
} from "@/live-classes/lib/api";
import type { LiveClassSession, StudentOnlineAttendance } from "@/live-classes/lib/types";
import { LiveClassResourcesPanel } from "@/live-classes/components/LiveClassResourcesPanel";

export default function StudentLiveClasses() {
  const { user } = useAuth();
  const [studentId, setStudentId] = useState<string | null>(null);
  const [classId, setClassId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<LiveClassSession[]>([]);
  const [stats, setStats] = useState<StudentOnlineAttendance | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      setLoading(true);
      try {
        let { data: st } = await supabase
          .from("students")
          .select("id, class_id")
          .eq("user_id", user.id)
          .maybeSingle();
        if (!st) {
          ({ data: st } = await supabase
            .from("students")
            .select("id, class_id")
            .eq("profile_id", user.id)
            .maybeSingle());
        }
        if (!st?.class_id) return;
        setStudentId(st.id);
        setClassId(st.class_id);

        const today = new Date();
        today.setDate(today.getDate() - 3);
        const [sess, onlineStats] = await Promise.all([
          fetchLiveClassSessions({
            classId: st.class_id,
            fromDate: today.toISOString().slice(0, 10),
          }),
          fetchStudentOnlineAttendance(st.id),
        ]);
        setSessions(sess);
        setStats(onlineStats);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const handleJoin = async (session: LiveClassSession) => {
    if (!studentId) return;
    await recordJoin(session.id, studentId);
    const onLeave = () => {
      void recordLeave(session.id, studentId);
      window.removeEventListener("beforeunload", onLeave);
    };
    window.addEventListener("beforeunload", onLeave);
  };

  return (
    <DashboardLayout role="student">
      <div className="space-y-6">
        <PortalPageHeader
          title="Live Classes"
          description="Join scheduled Google Meet sessions for your class."
        />

        {stats && stats.totalClasses > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Online class attendance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div><p className="text-muted-foreground text-xs">Total</p><p className="font-bold text-lg">{stats.totalClasses}</p></div>
                <div><p className="text-muted-foreground text-xs">Attended</p><p className="font-bold text-lg text-green-600">{stats.attended}</p></div>
                <div><p className="text-muted-foreground text-xs">Missed</p><p className="font-bold text-lg text-red-600">{stats.missed}</p></div>
                <div><p className="text-muted-foreground text-xs">Rate</p><p className="font-bold text-lg">{stats.rate}%</p></div>
              </div>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : sessions.length === 0 ? (
          <p className="text-muted-foreground text-sm">No live classes scheduled.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {sessions.map((s) => (
              <div key={s.id} className="space-y-2">
                <LiveClassSessionCard session={s} onJoin={handleJoin} />
                <LiveClassResourcesPanel
                  liveClassId={s.live_class_id}
                  sessionId={s.id}
                  schoolId={s.school_id}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
