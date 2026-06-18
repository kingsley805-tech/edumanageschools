import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { PortalPageHeader } from "@/components/PortalPageHeader";
import { GoogleConnectCard } from "@/live-classes/components/GoogleConnectCard";
import { LiveClassAnalyticsPanel } from "@/live-classes/components/LiveClassAnalyticsPanel";
import { LiveClassSessionCard } from "@/live-classes/components/LiveClassSessionCard";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchLiveClassSessions,
  fetchSchoolLiveAnalytics,
  fetchSchoolId,
} from "@/live-classes/lib/api";
import type { LiveClassAnalytics, LiveClassSession } from "@/live-classes/lib/types";
import { Video } from "lucide-react";

export default function AdminOnlineLearning() {
  const { user } = useAuth();
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<LiveClassSession[]>([]);
  const [analytics, setAnalytics] = useState<LiveClassAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      setLoading(true);
      try {
        const sid = await fetchSchoolId(user.id);
        if (!sid) return;
        setSchoolId(sid);
        const today = new Date().toISOString().slice(0, 10);
        const [sess, stats] = await Promise.all([
          fetchLiveClassSessions({ schoolId: sid, fromDate: today, limit: 20 }),
          fetchSchoolLiveAnalytics(sid),
        ]);
        setSessions(sess);
        setAnalytics(stats);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <PortalPageHeader
          title="Online Learning"
          description="Connect Google Meet, monitor live classes, and view participation analytics."
        />

        {schoolId ? <GoogleConnectCard schoolId={schoolId} /> : null}

        <div>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Video className="h-5 w-5" />
            Analytics
          </h2>
          <LiveClassAnalyticsPanel analytics={analytics} loading={loading} />
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-4">Upcoming live sessions</h2>
          {loading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : sessions.length === 0 ? (
            <p className="text-muted-foreground text-sm">No upcoming sessions scheduled.</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {sessions.map((s) => (
                <LiveClassSessionCard key={s.id} session={s} showJoin={false} />
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
