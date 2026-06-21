import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { format } from "date-fns";
import {
  ArrowLeft,
  ExternalLink,
  Loader2,
  MonitorPlay,
  RefreshCw,
  Video,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LiveClassResourcesPanel } from "@/live-classes/components/LiveClassResourcesPanel";
import {
  fetchSessionById,
  finalizeSession,
  getSessionStatus,
  recordJoin,
  recordLeave,
} from "@/live-classes/lib/api";
import {
  getLiveClassListPath,
  type LiveClassPortalRole,
} from "@/live-classes/lib/meetingPaths";
import { focusMeetWindow, openMeetWindow } from "@/live-classes/lib/meetWindow";
import type { LiveClassSession } from "@/live-classes/lib/types";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

type Props = {
  role: LiveClassPortalRole;
};

type MeetWindowState = "idle" | "open" | "closed" | "blocked";

const statusColors: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-800",
  live: "bg-green-100 text-green-800",
  ended: "bg-muted text-muted-foreground",
  cancelled: "bg-red-100 text-red-800",
};

export default function LiveClassMeetingRoom({ role }: Props) {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [session, setSession] = useState<LiveClassSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [teacherUserId, setTeacherUserId] = useState<string | null>(null);
  const [meetState, setMeetState] = useState<MeetWindowState>("idle");
  const joinedRef = useRef(false);
  const autoLaunchRef = useRef(false);

  const backPath = getLiveClassListPath(role);
  const layoutRole =
    role === "admin" ? "admin" : role === "parent" ? "parent" : role;

  const loadSession = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    try {
      const data = await fetchSessionById(sessionId);
      setSession(data);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  useEffect(() => {
    if (!user || role !== "student") return;
    void supabase
      .from("students")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => setStudentId(data?.id ?? null));
  }, [user, role]);

  useEffect(() => {
    if (!user || role !== "teacher") return;
    setTeacherUserId(user.id);
  }, [user, role]);

  const markTeacherLive = useCallback(async () => {
    if (!sessionId || role !== "teacher") return;
    await supabase.from("live_class_sessions").update({ status: "live" }).eq("id", sessionId);
  }, [role, sessionId]);

  const handleJoinSideEffects = useCallback(async () => {
    if (!session || joinedRef.current) return;
    joinedRef.current = true;

    if (role === "teacher") {
      await markTeacherLive();
    }
    if (role === "student" && studentId) {
      try {
        await recordJoin(session.id, studentId);
      } catch {
        const now = new Date().toISOString();
        await supabase.from("live_class_attendance").upsert(
          {
            session_id: session.id,
            student_id: studentId,
            join_time: now,
            status: "present",
          },
          { onConflict: "session_id,student_id" },
        );
        await supabase
          .from("live_class_sessions")
          .update({ status: "live" })
          .eq("id", session.id)
          .in("status", ["scheduled", "live"]);
      }
    }
  }, [markTeacherLive, role, session, studentId]);

  const launchMeeting = useCallback(() => {
    if (!session?.meet_link) return false;
    const win = openMeetWindow(session.meet_link);
    if (!win) {
      setMeetState("blocked");
      toast.error("Allow pop-ups for this site, then click Join Google Meet again.");
      return false;
    }
    setMeetState("open");
    return true;
  }, [session?.meet_link]);

  useEffect(() => {
    if (!session?.meet_link || autoLaunchRef.current) return;
    autoLaunchRef.current = true;
    void handleJoinSideEffects();
    const opened = launchMeeting();
    if (!opened) setMeetState("blocked");
  }, [session, handleJoinSideEffects, launchMeeting]);

  useEffect(() => {
    if (meetState !== "open") return;
    const interval = window.setInterval(() => {
      if (focusMeetWindow()) return;
      setMeetState("closed");
    }, 1500);
    return () => window.clearInterval(interval);
  }, [meetState]);

  useEffect(() => {
    if (role !== "student" || !studentId || !sessionId) return;

    const onLeave = () => {
      void recordLeave(sessionId, studentId).catch(() => {
        void supabase
          .from("live_class_attendance")
          .update({ leave_time: new Date().toISOString() })
          .eq("session_id", sessionId)
          .eq("student_id", studentId);
      });
    };

    window.addEventListener("beforeunload", onLeave);
    return () => {
      window.removeEventListener("beforeunload", onLeave);
      onLeave();
    };
  }, [role, sessionId, studentId]);

  const handleEndSession = async () => {
    if (!sessionId) return;
    try {
      await finalizeSession(sessionId);
      toast.success("Session ended");
      navigate(backPath);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to end session");
    }
  };

  if (loading) {
    return (
      <DashboardLayout role={layoutRole} hideSidebar>
        <div className="flex h-[70vh] items-center justify-center text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Loading meeting room…
        </div>
      </DashboardLayout>
    );
  }

  if (!session) {
    return (
      <DashboardLayout role={layoutRole} hideSidebar>
        <div className="mx-auto max-w-lg py-16 text-center space-y-4">
          <p className="text-muted-foreground">This live class session was not found.</p>
          <Button asChild variant="outline">
            <Link to={backPath}>Back to live classes</Link>
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const status = getSessionStatus(session);
  const teacherName =
    (session.teachers as { profiles?: { full_name?: string } })?.profiles?.full_name ?? "Teacher";
  const canJoin = !!session.meet_link && status !== "ended" && status !== "cancelled";

  return (
    <DashboardLayout role={layoutRole} hideSidebar>
      <div className="flex h-[calc(100dvh-4rem)] min-h-0 flex-col">
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b bg-background px-3 py-2 md:px-4">
          <div className="flex min-w-0 items-center gap-2">
            <Button variant="ghost" size="sm" asChild className="shrink-0">
              <Link to={backPath}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Link>
            </Button>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold md:text-base">{session.title}</h1>
              <p className="truncate text-xs text-muted-foreground">
                {(session.subjects as { name?: string })?.name ?? "Subject"} · {teacherName} ·{" "}
                {format(new Date(session.start_at), "EEE, MMM d · h:mm a")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={statusColors[status] ?? ""}>{status}</Badge>
            {role === "teacher" && status !== "ended" ? (
              <Button variant="outline" size="sm" onClick={() => void handleEndSession()}>
                End class
              </Button>
            ) : null}
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <main className="relative flex min-h-0 flex-1 flex-col items-center justify-center bg-gradient-to-br from-zinc-950 via-zinc-900 to-emerald-950 p-6 text-center text-white">
            {canJoin ? (
              <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-5">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/15 ring-1 ring-emerald-400/30">
                  <MonitorPlay className="h-10 w-10 text-emerald-300" />
                </div>

                <div className="space-y-2">
                  <h2 className="text-xl font-semibold">EduManage Live Class</h2>
                  <p className="text-sm text-white/70 leading-relaxed">
                    Google Meet cannot run inside this page (Google blocks embedding). Your meeting
                    opens in a separate window while this portal stays open for resources and
                    attendance.
                  </p>
                </div>

                {meetState === "open" && (
                  <div className="w-full rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                    Meeting window is open. Use the buttons below if you do not see it.
                  </div>
                )}

                {meetState === "closed" && (
                  <div className="w-full rounded-lg border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                    The meeting window was closed. Click below to rejoin.
                  </div>
                )}

                {meetState === "blocked" && (
                  <div className="w-full rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                    Your browser blocked the meeting pop-up. Allow pop-ups for this site, then click
                    Join Google Meet.
                  </div>
                )}

                <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
                  <Button size="lg" className="w-full sm:w-auto" onClick={launchMeeting}>
                    <Video className="h-5 w-5 mr-2" />
                    {meetState === "open" ? "Focus meeting window" : "Join Google Meet"}
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    className="w-full border-white/25 bg-white/5 text-white hover:bg-white/10 sm:w-auto"
                    onClick={() => {
                      if (session.meet_link) openMeetWindow(session.meet_link);
                    }}
                  >
                    <RefreshCw className="h-5 w-5 mr-2" />
                    Reopen
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    className="w-full border-white/25 bg-white/5 text-white hover:bg-white/10 sm:w-auto"
                    asChild
                  >
                    <a href={session.meet_link!} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-5 w-5 mr-2" />
                      New tab
                    </a>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <Video className="h-10 w-10 opacity-60" />
                <p className="text-sm opacity-80">
                  {status === "ended" || status === "cancelled"
                    ? "This session has ended."
                    : "No meeting link is available for this session."}
                </p>
                <Button variant="secondary" asChild>
                  <Link to={backPath}>Return to live classes</Link>
                </Button>
              </div>
            )}
          </main>

          <aside className="flex w-full shrink-0 flex-col border-t bg-background lg:w-80 lg:border-l lg:border-t-0">
            <div className="border-b px-3 py-2">
              <p className="text-sm font-medium">Class resources</p>
              <p className="text-xs text-muted-foreground">Stay on this page during the lesson</p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              <LiveClassResourcesPanel
                liveClassId={session.live_class_id}
                sessionId={session.id}
                schoolId={session.school_id}
                canManage={role === "teacher"}
                userId={teacherUserId ?? undefined}
              />
            </div>
          </aside>
        </div>
      </div>
    </DashboardLayout>
  );
}
