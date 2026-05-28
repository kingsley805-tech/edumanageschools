import { Link } from "react-router-dom";
import { BookOpen, MonitorPlay, DollarSign, Settings, ChevronRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const sections = [
  {
    id: "academics",
    label: "Academics",
    description: "Classes, work, grades & reports",
    icon: BookOpen,
    accent: "text-primary bg-primary/10",
    links: [
      { label: "Timetable", path: "/student/timetable" },
      { label: "Assignments", path: "/student/assignments" },
      { label: "Grades", path: "/student/grades" },
      { label: "Performance", path: "/student/performance" },
      { label: "Report card", path: "/student/report-card" },
      { label: "Resources", path: "/student/resources" },
    ],
  },
  {
    id: "examinations",
    label: "Examinations",
    description: "Online exams & assessments",
    icon: MonitorPlay,
    accent: "text-violet-600 bg-violet-500/10 dark:text-violet-400",
    links: [{ label: "Online exams", path: "/student/online-exams" }],
  },
  {
    id: "finance",
    label: "Finance",
    description: "Fees, invoices & payments",
    icon: DollarSign,
    accent: "text-emerald-600 bg-emerald-500/10 dark:text-emerald-400",
    links: [{ label: "My fees", path: "/student/billing" }],
  },
  {
    id: "account",
    label: "Account",
    description: "Profile & preferences",
    icon: Settings,
    accent: "text-amber-600 bg-amber-500/10 dark:text-amber-400",
    links: [{ label: "Settings", path: "/settings" }],
  },
] as const;

export function StudentPortalSections({ className }: { className?: string }) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2 xl:grid-cols-4", className)}>
      {sections.map((section) => (
        <Card
          key={section.id}
          className="flex flex-col overflow-hidden border-border/80 shadow-sm transition-shadow hover:shadow-md"
        >
          <CardHeader className="pb-3">
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                  section.accent,
                )}
              >
                <section.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <CardTitle className="text-base">{section.label}</CardTitle>
                <CardDescription className="text-xs">{section.description}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-1 pt-0">
            {section.links.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className="group flex items-center justify-between rounded-lg px-2 py-2 text-sm text-foreground/90 transition-colors hover:bg-muted/80"
              >
                <span>{link.label}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </Link>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
