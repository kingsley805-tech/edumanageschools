import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Calendar, ClipboardCheck, Award } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

const StudentDashboard = () => {
  const stats = [
    { title: "My Classes", value: "8", icon: BookOpen, color: "text-primary" },
    { title: "Assignments", value: "5", icon: ClipboardCheck, color: "text-accent" },
    { title: "Attendance", value: "96%", icon: Calendar, color: "text-success" },
    { title: "Grade Average", value: "A", icon: Award, color: "text-warning" },
  ];

  const todaySchedule = [
    { subject: "Mathematics", time: "08:00 - 09:00", room: "Room 204", teacher: "Mr. Smith" },
    { subject: "Physics", time: "09:15 - 10:15", room: "Lab 1", teacher: "Dr. Johnson" },
    { subject: "English", time: "10:30 - 11:30", room: "Room 105", teacher: "Ms. Davis" },
    { subject: "Chemistry", time: "12:00 - 01:00", room: "Lab 2", teacher: "Prof. Wilson" },
  ];

  const pendingAssignments = [
    { title: "Quadratic Equations Worksheet", subject: "Mathematics", due: "Tomorrow", status: "pending" },
    { title: "Newton's Laws Lab Report", subject: "Physics", due: "2 days", status: "in-progress" },
    { title: "Shakespeare Essay", subject: "English", due: "5 days", status: "pending" },
  ];

  const recentGrades = [
    { subject: "Mathematics", grade: "A", percentage: 92 },
    { subject: "Physics", grade: "A-", percentage: 88 },
    { subject: "English", grade: "B+", percentage: 85 },
    { subject: "Chemistry", grade: "A", percentage: 90 },
  ];

  return (
    <DashboardLayout role="student">
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat, index) => (
            <Card key={index} className="animate-fade-in" style={{ animationDelay: `${index * 0.1}s` }}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Today's Schedule */}
          <Card className="animate-fade-up">
            <CardHeader>
              <CardTitle>Today's Schedule</CardTitle>
              <CardDescription>Your classes for today</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {todaySchedule.map((cls, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <BookOpen className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{cls.subject}</p>
                      <p className="text-sm text-muted-foreground">{cls.teacher}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-medium text-primary">{cls.time}</p>
                      <p className="text-xs text-muted-foreground">{cls.room}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Pending Assignments */}
          <Card className="animate-fade-up" style={{ animationDelay: "0.1s" }}>
            <CardHeader>
              <CardTitle>Pending Assignments</CardTitle>
              <CardDescription>Work that needs your attention</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {pendingAssignments.map((assignment, index) => (
                  <div key={index} className="space-y-2 pb-4 border-b last:border-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{assignment.title}</p>
                        <p className="text-sm text-muted-foreground">{assignment.subject}</p>
                      </div>
                      <Badge variant={assignment.status === "pending" ? "destructive" : "secondary"}>
                        Due in {assignment.due}
                      </Badge>
                    </div>
                    {assignment.status === "in-progress" && (
                      <Progress value={60} className="h-2" />
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Grades */}
        <Card className="animate-fade-up" style={{ animationDelay: "0.2s" }}>
          <CardHeader>
            <CardTitle>Recent Grades</CardTitle>
            <CardDescription>Your latest performance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {recentGrades.map((grade, index) => (
                <div key={index} className="flex items-center justify-between p-4 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Award className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{grade.subject}</p>
                      <p className="text-sm text-muted-foreground">{grade.percentage}%</p>
                    </div>
                  </div>
                  <Badge variant={grade.grade.startsWith("A") ? "default" : "secondary"} className="text-lg px-3">
                    {grade.grade}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default StudentDashboard;