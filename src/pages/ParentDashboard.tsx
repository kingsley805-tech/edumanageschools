import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UserCircle, BookOpen, Calendar, DollarSign, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

const ParentDashboard = () => {
  const navigate = useNavigate();
  const children = [
    {
      name: "Sarah Johnson",
      grade: "Grade 10-A",
      attendance: 96,
      avgGrade: "A",
      nextFee: "$850",
      feeDue: "Jan 15, 2024"
    }
  ];

  const recentGrades = [
    { subject: "Mathematics", grade: "A", score: 92, trend: "up" },
    { subject: "Physics", grade: "A-", score: 88, trend: "up" },
    { subject: "English", grade: "B+", score: 85, trend: "stable" },
    { subject: "Chemistry", grade: "A", score: 90, trend: "up" },
  ];

  const upcomingEvents = [
    { title: "Parent-Teacher Meeting", date: "Dec 15, 2024", type: "meeting" },
    { title: "Mid-term Exams", date: "Dec 20-27, 2024", type: "exam" },
    { title: "Fee Payment Due", date: "Jan 15, 2024", type: "payment" },
  ];

  return (
    <DashboardLayout role="parent">
      <div className="space-y-6">
        {/* Child Overview */}
        <Card className="animate-fade-in">
          <CardHeader>
            <CardTitle>My Children</CardTitle>
            <CardDescription>Overview of your child's performance</CardDescription>
          </CardHeader>
          <CardContent>
            {children.map((child, index) => (
              <div key={index} className="flex items-start gap-6 p-6 rounded-lg border bg-gradient-to-br from-primary/5 to-accent/5">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <UserCircle className="h-10 w-10 text-primary" />
                </div>
                <div className="flex-1 space-y-4">
                  <div>
                    <h3 className="text-xl font-semibold">{child.name}</h3>
                    <p className="text-muted-foreground">{child.grade}</p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Attendance</p>
                      <div className="flex items-center gap-2">
                        <Progress value={child.attendance} className="h-2 flex-1" />
                        <span className="text-sm font-medium">{child.attendance}%</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Average Grade</p>
                      <p className="text-2xl font-bold text-primary">{child.avgGrade}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Next Fee Due</p>
                      <p className="text-lg font-semibold">{child.nextFee}</p>
                      <p className="text-xs text-muted-foreground">{child.feeDue}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Recent Grades */}
          <Card className="animate-fade-up">
            <CardHeader>
              <CardTitle>Academic Performance</CardTitle>
              <CardDescription>Recent subject grades</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentGrades.map((grade, index) => (
                  <div key={index} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <BookOpen className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{grade.subject}</p>
                        <p className="text-sm text-muted-foreground">Score: {grade.score}%</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={grade.grade.startsWith("A") ? "default" : "secondary"}>
                        {grade.grade}
                      </Badge>
                      {grade.trend === "up" && <TrendingUp className="h-4 w-4 text-success" />}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Upcoming Events */}
          <Card className="animate-fade-up" style={{ animationDelay: "0.1s" }}>
            <CardHeader>
              <CardTitle>Upcoming Events</CardTitle>
              <CardDescription>Important dates and reminders</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {upcomingEvents.map((event, index) => (
                  <div key={index} className="flex items-start gap-3 p-4 rounded-lg border">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                      event.type === "meeting" ? "bg-primary/10" :
                      event.type === "exam" ? "bg-warning/10" :
                      "bg-success/10"
                    }`}>
                      {event.type === "meeting" && <Calendar className="h-5 w-5 text-primary" />}
                      {event.type === "exam" && <BookOpen className="h-5 w-5 text-warning" />}
                      {event.type === "payment" && <DollarSign className="h-5 w-5 text-success" />}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{event.title}</p>
                      <p className="text-sm text-muted-foreground">{event.date}</p>
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
              <Button onClick={() => navigate("/parent/payments")} className="h-auto flex-col gap-2 p-6 bg-gradient-to-br from-primary to-primary/80">
                <DollarSign className="h-6 w-6" />
                <span>Pay Fees</span>
              </Button>
              <Button onClick={() => navigate("/parent/grades")} variant="outline" className="h-auto flex-col gap-2 p-6">
                <BookOpen className="h-6 w-6" />
                <span>View Report Card</span>
              </Button>
              <Button onClick={() => navigate("/parent/attendance")} variant="outline" className="h-auto flex-col gap-2 p-6">
                <Calendar className="h-6 w-6" />
                <span>Check Attendance</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default ParentDashboard;