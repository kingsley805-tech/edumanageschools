import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Users, ClipboardCheck, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const TeacherDashboard = () => {
  const navigate = useNavigate();
  const stats = [
    { title: "My Classes", value: "6", icon: BookOpen, color: "text-primary" },
    { title: "Total Students", value: "142", icon: Users, color: "text-accent" },
    { title: "Assignments", value: "12", icon: ClipboardCheck, color: "text-success" },
    { title: "Today's Classes", value: "4", icon: Calendar, color: "text-warning" },
  ];

  const upcomingClasses = [
    { subject: "Mathematics", grade: "Grade 10-A", time: "09:00 AM", room: "Room 204" },
    { subject: "Physics", grade: "Grade 10-B", time: "11:00 AM", room: "Lab 1" },
    { subject: "Mathematics", grade: "Grade 9-A", time: "02:00 PM", room: "Room 204" },
  ];

  const recentAssignments = [
    { title: "Quadratic Equations", class: "Grade 10-A", submitted: 28, total: 35, due: "2 days" },
    { title: "Newton's Laws", class: "Grade 10-B", submitted: 32, total: 38, due: "5 days" },
    { title: "Algebra Basics", class: "Grade 9-A", submitted: 25, total: 30, due: "1 week" },
  ];

  return (
    <DashboardLayout role="teacher">
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
              <div className="space-y-4">
                {upcomingClasses.map((cls, index) => (
                  <div key={index} className="flex items-center justify-between p-4 rounded-lg border">
                    <div className="space-y-1">
                      <p className="font-medium">{cls.subject}</p>
                      <p className="text-sm text-muted-foreground">{cls.grade}</p>
                    </div>
                    <div className="text-right space-y-1">
                      <p className="text-sm font-medium text-primary">{cls.time}</p>
                      <p className="text-xs text-muted-foreground">{cls.room}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Assignment Status */}
          <Card className="animate-fade-up" style={{ animationDelay: "0.1s" }}>
            <CardHeader>
              <CardTitle>Assignment Status</CardTitle>
              <CardDescription>Submission tracking</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentAssignments.map((assignment, index) => (
                  <div key={index} className="space-y-2 pb-4 border-b last:border-0">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{assignment.title}</p>
                        <p className="text-sm text-muted-foreground">{assignment.class}</p>
                      </div>
                      <Badge variant="secondary">Due in {assignment.due}</Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {assignment.submitted} / {assignment.total} submitted
                      </span>
                      <span className="font-medium text-primary">
                        {Math.round((assignment.submitted / assignment.total) * 100)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card className="animate-fade-up" style={{ animationDelay: "0.2s" }}>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <button onClick={() => navigate("/teacher/attendance")} className="flex items-center gap-3 p-4 rounded-lg border hover:bg-muted transition-colors">
                <ClipboardCheck className="h-5 w-5 text-primary" />
                <span className="font-medium">Mark Attendance</span>
              </button>
              <button onClick={() => navigate("/teacher/assignments")} className="flex items-center gap-3 p-4 rounded-lg border hover:bg-muted transition-colors">
                <BookOpen className="h-5 w-5 text-accent" />
                <span className="font-medium">Create Assignment</span>
              </button>
              <button onClick={() => navigate("/teacher/classes")} className="flex items-center gap-3 p-4 rounded-lg border hover:bg-muted transition-colors">
                <Users className="h-5 w-5 text-success" />
                <span className="font-medium">View Classes</span>
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default TeacherDashboard;