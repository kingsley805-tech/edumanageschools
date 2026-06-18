import { useCallback, useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { PortalPageHeader } from "@/components/PortalPageHeader";
import { CreateLiveClassDialog } from "@/live-classes/components/CreateLiveClassDialog";
import { LiveClassSessionCard } from "@/live-classes/components/LiveClassSessionCard";
import { LiveClassResourcesPanel } from "@/live-classes/components/LiveClassResourcesPanel";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchLiveClassSessions,
  fetchSchoolId,
  finalizeSession,
  getSessionStatus,
  isLiveClassesSchemaReady,
  LIVE_CLASSES_SETUP_HINT,
  LIVE_CLASSES_SETUP_SQL_URL,
  GOOGLE_MEET_SETUP_HINT,
} from "@/live-classes/lib/api";
import type { LiveClassSession } from "@/live-classes/lib/types";
import { fetchTeacherAssignedClasses } from "@/report/lib/teacher-assignments";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";

export default function TeacherLiveClasses() {
  const { user } = useAuth();
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<LiveClassSession[]>([]);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [schemaReady, setSchemaReady] = useState<boolean | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const ready = await isLiveClassesSchemaReady();
      setSchemaReady(ready);
      if (!ready) return;

      const sid = await fetchSchoolId(user.id);
      if (!sid) return;
      setSchoolId(sid);

      const { data: teacher } = await supabase
        .from("teachers")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!teacher) return;
      setTeacherId(teacher.id);

      const assigned = await fetchTeacherAssignedClasses(user.id);
      setClasses(assigned);

      const classIds = assigned.map((c) => c.id);
      if (classIds.length) {
        const { data: subs } = await supabase
          .from("class_subjects")
          .select("subjects(id, name)")
          .in("class_id", classIds);
        const unique = new Map<string, { id: string; name: string }>();
        for (const row of subs ?? []) {
          const s = row.subjects as { id: string; name: string };
          if (s?.id) unique.set(s.id, s);
        }
        setSubjects([...unique.values()]);
      }

      const today = new Date();
      today.setDate(today.getDate() - 7);
      setSessions(
        await fetchLiveClassSessions({
          teacherId: teacher.id,
          fromDate: today.toISOString().slice(0, 10),
        }),
      );
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleJoin = async (session: LiveClassSession) => {
    await supabase
      .from("live_class_sessions")
      .update({ status: "live" })
      .eq("id", session.id);
  };

  const handleEndSession = async (sessionId: string) => {
    try {
      await finalizeSession(sessionId);
      toast.success("Session ended — attendance recorded");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to finalize session");
    }
  };

  return (
    <DashboardLayout role="teacher">
      <div className="space-y-6">
        <PortalPageHeader
          title="Live Classes"
          description="Schedule Google Meet sessions, join classes, and manage attendance."
          actions={
            schoolId && teacherId ? (
              <CreateLiveClassDialog
                schoolId={schoolId}
                teacherId={teacherId}
                classes={classes}
                subjects={subjects}
                disabled={schemaReady === false}
                onCreated={load}
              />
            ) : null
          }
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

        {loading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : sessions.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No live classes yet. Create one to generate a Google Meet link automatically.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {sessions.map((s) => (
              <div key={s.id} className="space-y-2">
                <LiveClassSessionCard session={s} onJoin={handleJoin} />
                <LiveClassResourcesPanel
                  liveClassId={s.live_class_id}
                  sessionId={s.id}
                  schoolId={s.school_id}
                  canManage
                  userId={user?.id}
                />
                {getSessionStatus(s) === "live" || getSessionStatus(s) === "ended" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => handleEndSession(s.id)}
                    disabled={s.status === "ended"}
                  >
                    {s.status === "ended" ? "Attendance finalized" : "End class & record attendance"}
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
