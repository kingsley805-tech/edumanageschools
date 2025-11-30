import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Users, ClipboardCheck, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

const TeacherDashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState([
    { title: "My Classes", value: "0", icon: BookOpen, color: "text-primary" },
    { title: "Total Students", value: "0", icon: Users, color: "text-accent" },
    { title: "Assignments", value: "0", icon: ClipboardCheck, color: "text-success" },
    { title: "Today's Classes", value: "0", icon: Calendar, color: "text-warning" },
  ]);
  const [upcomingClasses, setUpcomingClasses] = useState<any[]>([]);
  const [recentAssignments, setRecentAssignments] = useState<any[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    const [classesRes, assignmentsRes, schedulesRes] = await Promise.all([
      supabase.from("class_subjects").select("id, class:classes(name, id), subject:subjects(name)", { count: "exact" }),
      supabase.from("assignments").select("id", { count: "exact", head: true }),
      supabase.from("schedules").select("*, class:classes(name), subject:subjects(name)").eq("day_of_week", new Date().getDay())
    ]);

    const classIds = classesRes.data?.map(c => c.class?.id).filter(Boolean) || [];
    const studentsRes = await supabase
      .from("students")
      .select("id", { count: "exact", head: true })
      .in("class_id", classIds);

    setStats([
      { title: "My Classes", value: classesRes.count?.toString() || "0", icon: BookOpen, color: "text-primary" },
      { title: "Total Students", value: studentsRes.count?.toString() || "0", icon: Users, color: "text-accent" },
      { title: "Assignments", value: assignmentsRes.count?.toString() || "0", icon: ClipboardCheck, color: "text-success" },
      { title: "Today's Classes", value: schedulesRes.data?.length.toString() || "0", icon: Calendar, color: "text-warning" },
    ]);

    setUpcomingClasses(schedulesRes.data || []);

    const { data: assignmentsData } = await supabase
      .from("assignments")
      .select("*, class:classes(name)")
      .order("due_date", { ascending: true })
      .limit(3);

    setRecentAssignments(assignmentsData || []);
  };

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
                {upcomingClasses.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">No classes today</div>
                ) : upcomingClasses.map((cls, index) => (
                  <div key={index} className="flex items-center justify-between p-4 rounded-lg border">
                    <div className="space-y-1">
                      <p className="font-medium">{cls.subject?.name}</p>
                      <p className="text-sm text-muted-foreground">{cls.class?.name}</p>
                    </div>
                    <div className="text-right space-y-1">
                      <p className="text-sm font-medium text-primary">{cls.start_time} - {cls.end_time}</p>
                      <p className="text-xs text-muted-foreground">Room {cls.room}</p>
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
                {recentAssignments.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">No assignments yet</div>
                ) : recentAssignments.map((assignment, index) => (
                  <div key={index} className="space-y-2 pb-4 border-b last:border-0">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{assignment.title}</p>
                        <p className="text-sm text-muted-foreground">{assignment.class?.name}</p>
                      </div>
                      <Badge variant="secondary">Due {new Date(assignment.due_date).toLocaleDateString()}</Badge>
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