import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Calendar, ClipboardCheck, Award } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useStudentData } from "@/hooks/useStudentData";
import { supabase } from "@/integrations/supabase/client";

const StudentDashboard = () => {
  const { studentId, classId, loading } = useStudentData();
  const [stats, setStats] = useState([
    { title: "My Classes", value: "0", icon: BookOpen, color: "text-primary" },
    { title: "Assignments", value: "0", icon: ClipboardCheck, color: "text-accent" },
    { title: "Attendance", value: "0%", icon: Calendar, color: "text-success" },
    { title: "Grade Average", value: "-", icon: Award, color: "text-warning" },
  ]);
  const [todaySchedule, setTodaySchedule] = useState<any[]>([]);
  const [pendingAssignments, setPendingAssignments] = useState<any[]>([]);
  const [recentGrades, setRecentGrades] = useState<any[]>([]);

  useEffect(() => {
    if (studentId && classId) {
      fetchDashboardData();
    }
  }, [studentId, classId]);

  const fetchDashboardData = async () => {
    if (!studentId || !classId) return;

    const today = new Date().getDay();

    const [schedulesRes, assignmentsRes, attendanceRes, gradesRes] = await Promise.all([
      supabase.from("schedules").select("*, subject:subjects(name), teacher:teachers(user_id)").eq("class_id", classId).eq("day_of_week", today),
      supabase.from("assignments").select("*, subject:subjects(name)").eq("class_id", classId).order("due_date", { ascending: true }).limit(3),
      supabase.from("attendance").select("status", { count: "exact" }).eq("student_id", studentId),
      supabase.from("grades").select("*, subject:subjects(name)").eq("student_id", studentId).order("created_at", { ascending: false }).limit(4)
    ]);

    const presentCount = await supabase
      .from("attendance")
      .select("id", { count: "exact", head: true })
      .eq("student_id", studentId)
      .eq("status", "present");

    const totalAttendance = attendanceRes.count || 1;
    const attendanceRate = ((presentCount.count || 0) / totalAttendance * 100).toFixed(0);

    const avgGrade = gradesRes.data && gradesRes.data.length > 0
      ? (gradesRes.data.reduce((sum, g) => sum + (Number(g.score) || 0), 0) / gradesRes.data.length).toFixed(0)
      : "-";

    setStats([
      { title: "My Classes", value: schedulesRes.data?.length.toString() || "0", icon: BookOpen, color: "text-primary" },
      { title: "Assignments", value: assignmentsRes.data?.length.toString() || "0", icon: ClipboardCheck, color: "text-accent" },
      { title: "Attendance", value: `${attendanceRate}%`, icon: Calendar, color: "text-success" },
      { title: "Grade Average", value: avgGrade, icon: Award, color: "text-warning" },
    ]);

    setTodaySchedule(schedulesRes.data || []);
    setPendingAssignments(assignmentsRes.data || []);
    setRecentGrades(gradesRes.data || []);
  };

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
                {todaySchedule.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No classes today</p>
                  </div>
                ) : (
                  todaySchedule.map((cls, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                      <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <BookOpen className="h-6 w-6 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{cls.subject?.name}</p>
                        <p className="text-sm text-muted-foreground">Room {cls.room}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-medium text-primary">
                          {cls.start_time} - {cls.end_time}
                        </p>
                      </div>
                    </div>
                  ))
                )}
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
                {pendingAssignments.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <ClipboardCheck className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No pending assignments</p>
                  </div>
                ) : (
                  pendingAssignments.map((assignment, index) => (
                    <div key={index} className="space-y-2 pb-4 border-b last:border-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{assignment.title}</p>
                          <p className="text-sm text-muted-foreground">{assignment.subject?.name}</p>
                        </div>
                        <Badge variant="destructive">
                          Due {new Date(assignment.due_date).toLocaleDateString()}
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
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
              {recentGrades.length === 0 ? (
                <div className="md:col-span-2 text-center py-8 text-muted-foreground">
                  <Award className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No grades available yet</p>
                </div>
              ) : (
                recentGrades.map((grade, index) => (
                  <div key={index} className="flex items-center justify-between p-4 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <Award className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{grade.subject?.name}</p>
                        <p className="text-sm text-muted-foreground">{grade.score}%</p>
                      </div>
                    </div>
                    <Badge variant={Number(grade.score) >= 80 ? "default" : "secondary"} className="text-lg px-3">
                      {Number(grade.score) >= 90 ? "A" : Number(grade.score) >= 80 ? "B" : Number(grade.score) >= 70 ? "C" : "D"}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default StudentDashboard;