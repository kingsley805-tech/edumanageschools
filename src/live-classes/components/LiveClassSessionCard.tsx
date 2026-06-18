import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ExternalLink, Video } from "lucide-react";
import { format } from "date-fns";
import type { LiveClassSession } from "@/live-classes/lib/types";
import { getSessionStatus } from "@/live-classes/lib/api";

type Props = {
  session: LiveClassSession;
  onJoin?: (session: LiveClassSession) => void;
  showJoin?: boolean;
  compact?: boolean;
};

const statusColors: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-800",
  live: "bg-green-100 text-green-800",
  ended: "bg-muted text-muted-foreground",
  cancelled: "bg-red-100 text-red-800",
};

export function LiveClassSessionCard({ session, onJoin, showJoin = true, compact }: Props) {
  const status = getSessionStatus(session);
  const teacherName =
    (session.teachers as { profiles?: { full_name?: string } })?.profiles?.full_name ?? "Teacher";

  return (
    <Card className={compact ? "border-border/80" : undefined}>
      <CardHeader className={compact ? "pb-2" : undefined}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className={compact ? "text-base" : "text-lg"}>{session.title}</CardTitle>
            <CardDescription>
              {(session.subjects as { name?: string })?.name ?? "Subject"} · {teacherName}
            </CardDescription>
          </div>
          <Badge className={statusColors[status] ?? ""}>{status}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-sm text-muted-foreground">
          <p>{(session.classes as { name?: string })?.name ?? "Class"}</p>
          <p>
            {format(new Date(session.start_at), "EEE, MMM d · h:mm a")} –{" "}
            {format(new Date(session.end_at), "h:mm a")}
          </p>
        </div>
        {showJoin && session.meet_link && status !== "ended" && status !== "cancelled" ? (
          <Button
            className="w-full sm:w-auto"
            onClick={() => {
              onJoin?.(session);
              window.open(session.meet_link!, "_blank", "noopener,noreferrer");
            }}
          >
            <Video className="h-4 w-4 mr-2" />
            Join Meeting
            <ExternalLink className="h-3 w-3 ml-2 opacity-70" />
          </Button>
        ) : null}
        {status === "ended" && session.meet_link ? (
          <p className="text-xs text-muted-foreground">This session has ended.</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
