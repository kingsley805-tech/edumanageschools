import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Clock,
  ListTodo,
  PhoneCall,
  Smile,
  TrendingUp,
} from "lucide-react";
import {
  formatCallDuration,
  type AiCall,
  type AiReceptionistDashboardStats,
} from "@/modules/ai-receptionist/lib/types";

type Props = {
  stats: AiReceptionistDashboardStats;
  recentCalls: AiCall[];
};

const STAT_CARDS = [
  { key: "calls_today", label: "Calls today", icon: PhoneCall, tone: "text-blue-600" },
  { key: "completed_today", label: "Completed", icon: CheckCircle2, tone: "text-emerald-600" },
  { key: "escalated_today", label: "Escalated", icon: AlertTriangle, tone: "text-amber-600" },
  { key: "pending_followups", label: "Pending follow-ups", icon: ListTodo, tone: "text-violet-600" },
] as const;

export function AiReceptionistDashboardPanel({ stats, recentCalls }: Props) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STAT_CARDS.map(({ key, label, icon: Icon, tone }) => (
          <Card key={key}>
            <CardContent className="flex items-center justify-between pt-6">
              <div>
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="text-2xl font-bold">{stats[key]}</p>
              </div>
              <Icon className={`h-8 w-8 ${tone}`} />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center justify-between pt-6">
            <div>
              <p className="text-sm text-muted-foreground">Avg. call duration</p>
              <p className="text-2xl font-bold">{formatCallDuration(stats.avg_duration_seconds)}</p>
            </div>
            <Clock className="h-8 w-8 text-sky-600" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between pt-6">
            <div>
              <p className="text-sm text-muted-foreground">Satisfaction</p>
              <p className="text-2xl font-bold">
                {stats.avg_satisfaction ? `${stats.avg_satisfaction}/5` : "—"}
              </p>
            </div>
            <Smile className="h-8 w-8 text-emerald-600" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between pt-6">
            <div>
              <p className="text-sm text-muted-foreground">Knowledge articles</p>
              <p className="text-2xl font-bold">{stats.knowledge_articles}</p>
            </div>
            <BookOpen className="h-8 w-8 text-indigo-600" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between pt-6">
            <div>
              <p className="text-sm text-muted-foreground">Total calls</p>
              <p className="text-2xl font-bold">{stats.total_calls}</p>
            </div>
            <TrendingUp className="h-8 w-8 text-rose-600" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent conversations</CardTitle>
        </CardHeader>
        <CardContent>
          {recentCalls.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No calls recorded yet. Once your school phone number is connected, calls will appear here.
            </p>
          ) : (
            <ul className="divide-y">
              {recentCalls.slice(0, 8).map((call) => (
                <li key={call.id} className="flex items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {call.caller_name ?? call.caller_phone ?? "Unknown caller"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {call.summary ?? call.detected_intent ?? "No summary available"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {formatCallDuration(call.duration_seconds)}
                    </span>
                    <Badge variant={call.status === "escalated" ? "destructive" : "secondary"}>
                      {call.status}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
