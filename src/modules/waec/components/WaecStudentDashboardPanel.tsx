import { Award, BookOpen, Target, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { StatCounter } from "@/components/charts/StatCounter";
import { motion } from "framer-motion";
import type { WaecLeaderboardEntry, WaecStudentDashboard } from "@/modules/waec/lib/types";

type Props = {
  dashboard: WaecStudentDashboard;
  leaderboard: WaecLeaderboardEntry[];
};

function KpiCard({
  title,
  value,
  suffix,
  icon: Icon,
  color,
  delay = 0,
}: {
  title: string;
  value: number;
  suffix?: string;
  icon: typeof Award;
  color: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
    >
      <Card className="card-interactive">
        <CardContent className="flex items-center gap-4 p-4">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${color}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{title}</p>
            <StatCounter
              value={value}
              formatter={suffix ? (v) => `${Math.round(v)}${suffix}` : undefined}
              className="text-xl font-bold tabular-nums"
            />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function WaecStudentDashboardPanel({ dashboard, leaderboard }: Props) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="Exams Attempted" value={dashboard.total_attempts} icon={BookOpen} color="bg-blue-500/10 text-blue-600" />
        <KpiCard title="Average Score" value={dashboard.average_score} suffix="%" icon={TrendingUp} color="bg-emerald-500/10 text-emerald-600" delay={0.05} />
        <KpiCard title="Questions Solved" value={dashboard.questions_solved} icon={Target} color="bg-violet-500/10 text-violet-600" delay={0.1} />
      </div>

      {(dashboard.best_subject || dashboard.weak_subject) ? (
        <div className="grid gap-4 md:grid-cols-2">
          {dashboard.best_subject ? (
            <Card className="border-emerald-500/20">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Strongest subject</p>
                <p className="text-lg font-semibold text-emerald-700 dark:text-emerald-400">{dashboard.best_subject}</p>
              </CardContent>
            </Card>
          ) : null}
          {dashboard.weak_subject ? (
            <Card className="border-amber-500/20">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Needs improvement</p>
                <p className="text-lg font-semibold text-amber-700 dark:text-amber-400">{dashboard.weak_subject}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Practice more {dashboard.weak_subject} questions before your next mock test.
                </p>
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : null}

      {leaderboard.length > 0 ? (
        <Card>
          <CardContent className="p-4">
            <p className="mb-3 font-medium">School Leaderboard</p>
            <div className="space-y-2">
              {leaderboard.map((entry, i) => (
                <div key={entry.user_id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-bold">
                      {i + 1}
                    </span>
                    <span className="font-medium">{entry.student_name}</span>
                  </div>
                  <span className="font-semibold tabular-nums text-emerald-600">{entry.avg_percentage}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
