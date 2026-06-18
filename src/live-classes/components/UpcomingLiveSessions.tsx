import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Video } from "lucide-react";
import { fetchLiveClassSessions } from "@/live-classes/lib/api";
import { LiveClassSessionCard } from "@/live-classes/components/LiveClassSessionCard";
import type { LiveClassSession } from "@/live-classes/lib/types";

type Props = {
  classId?: string | null;
  teacherId?: string | null;
  title?: string;
  showJoin?: boolean;
  onJoin?: (session: LiveClassSession) => void;
  daysAhead?: number;
};

export function UpcomingLiveSessions({
  classId,
  teacherId,
  title = "Upcoming live classes",
  showJoin = true,
  onJoin,
  daysAhead = 14,
}: Props) {
  const [sessions, setSessions] = useState<LiveClassSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!classId && !teacherId) return;
    setLoading(true);
    const today = new Date().toISOString().slice(0, 10);
    const end = new Date();
    end.setDate(end.getDate() + daysAhead);
    void fetchLiveClassSessions({
      classId: classId ?? undefined,
      teacherId: teacherId ?? undefined,
      fromDate: today,
      toDate: end.toISOString().slice(0, 10),
      limit: 8,
    })
      .then(setSessions)
      .finally(() => setLoading(false));
  }, [classId, teacherId, daysAhead]);

  if (!classId && !teacherId) return null;
  if (!loading && sessions.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Video className="h-4 w-4 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading live sessions…</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {sessions.map((s) => (
              <LiveClassSessionCard key={s.id} session={s} compact showJoin={showJoin} onJoin={onJoin} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
