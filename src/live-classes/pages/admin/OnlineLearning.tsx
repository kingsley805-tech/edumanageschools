import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { PortalPageHeader } from "@/components/PortalPageHeader";
import { GoogleConnectCard } from "@/live-classes/components/GoogleConnectCard";
import { LiveClassAnalyticsPanel } from "@/live-classes/components/LiveClassAnalyticsPanel";
import { LiveClassSessionCard } from "@/live-classes/components/LiveClassSessionCard";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchLiveClassSessions,
  fetchSchoolLiveAnalytics,
  fetchSchoolId,
  GOOGLE_MEET_SETUP_HINT,
  isLiveClassesSchemaReady,
  LIVE_CLASSES_SETUP_HINT,
  LIVE_CLASSES_SETUP_SQL_URL,
} from "@/live-classes/lib/api";
import type { LiveClassAnalytics, LiveClassSession } from "@/live-classes/lib/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Video } from "lucide-react";

export default function AdminOnlineLearning() {
  const { user } = useAuth();
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<LiveClassSession[]>([]);
  const [analytics, setAnalytics] = useState<LiveClassAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [schemaReady, setSchemaReady] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      setLoading(true);
      try {
        const ready = await isLiveClassesSchemaReady();
        setSchemaReady(ready);
        const sid = await fetchSchoolId(user.id);
        if (!sid) return;
        setSchoolId(sid);
        if (!ready) return;

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

        {schemaReady === false && (
          <Alert variant="destructive">
            <AlertTitle>Database setup required</AlertTitle>
            <AlertDescription className="space-y-2">
              <p>{LIVE_CLASSES_SETUP_HINT}</p>
              <p>
                <a
                  href={LIVE_CLASSES_SETUP_SQL_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="underline font-medium"
                >
                  Open Supabase SQL Editor
                </a>
              </p>
              <p className="text-sm">{GOOGLE_MEET_SETUP_HINT}</p>
            </AlertDescription>
          </Alert>
        )}

        {schoolId ? <GoogleConnectCard schoolId={schoolId} disabled={schemaReady === false} /> : null}

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
