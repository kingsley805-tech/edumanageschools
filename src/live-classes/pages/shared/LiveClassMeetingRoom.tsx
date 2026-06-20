import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { format } from "date-fns";
import { ArrowLeft, ExternalLink, Loader2, Maximize2, Video } from "lucide-react";
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
import type { LiveClassSession } from "@/live-classes/lib/types";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

type Props = {
  role: LiveClassPortalRole;
};

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
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [session, setSession] = useState<LiveClassSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [teacherUserId, setTeacherUserId] = useState<string | null>(null);
  const [showEmbedHint, setShowEmbedHint] = useState(false);
  const [meetingLaunched, setMeetingLaunched] = useState(false);
  const joinedRef = useRef(false);

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

  useEffect(() => {
    if (!session?.meet_link) return;
    void handleJoinSideEffects();
    const hintTimer = window.setTimeout(() => setShowEmbedHint(true), 4000);
    return () => window.clearTimeout(hintTimer);
  }, [session, handleJoinSideEffects]);

  useEffect(() => {
    if (role !== "student" || !studentId || !sessionId) return;

    const onLeave = () => {
      void recordLeave(sessionId, studentId).catch(() => {
        void supabase
          .from("live_class_attendance")
          .update({
            leave_time: new Date().toISOString(),
          })
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

  const launchMeetingPopup = () => {
    if (!session?.meet_link) return;
    const width = Math.min(window.screen.width - 80, 1280);
    const height = Math.min(window.screen.height - 80, 800);
    const left = Math.round((window.screen.width - width) / 2);
    const top = Math.round((window.screen.height - height) / 2);
    window.open(
      session.meet_link,
      "eduManageMeet",
      `noopener,noreferrer,width=${width},height=${height},left=${left},top=${top}`,
    );
    setMeetingLaunched(true);
  };

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
          <main className="relative min-h-0 flex-1 bg-zinc-950">
            {canJoin ? (
              <>
                <iframe
                  ref={iframeRef}
                  title={`Google Meet — ${session.title}`}
                  src={session.meet_link!}
                  className="absolute inset-0 h-full w-full border-0 bg-zinc-950"
                  allow="camera; microphone; fullscreen; display-capture; autoplay; clipboard-write; speaker-selection"
                  referrerPolicy="no-referrer-when-downgrade"
                />
                {(showEmbedHint || meetingLaunched) && (
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/80 to-transparent p-4 pt-12">
                    <div className="pointer-events-auto mx-auto flex max-w-xl flex-col gap-2 rounded-lg border border-white/15 bg-black/70 p-3 text-white backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs sm:text-sm">
                        {meetingLaunched
                          ? "Meeting window opened. Keep this page open for class resources."
                          : "If the meeting does not appear above, launch it in a meeting window."}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="secondary" onClick={launchMeetingPopup}>
                          <Video className="h-4 w-4 mr-1" />
                          Launch meeting
                        </Button>
                        <Button size="sm" variant="outline" className="border-white/30 text-white hover:bg-white/10" asChild>
                          <a href={session.meet_link!} target="_blank" rel="noreferrer">
                            <ExternalLink className="h-4 w-4 mr-1" />
                            New tab
                          </a>
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-white">
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
            <div className="flex items-center justify-between border-b px-3 py-2">
              <p className="text-sm font-medium">Class resources</p>
              {canJoin ? (
                <Button variant="ghost" size="icon" className="h-8 w-8 lg:hidden" onClick={launchMeetingPopup}>
                  <Maximize2 className="h-4 w-4" />
                </Button>
              ) : null}
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
