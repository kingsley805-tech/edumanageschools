import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UserCircle, BookOpen, Calendar, DollarSign, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { EventsCalendar } from "@/components/EventsCalendar";

const ParentDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [children, setChildren] = useState<any[]>([]);
  const [recentGrades, setRecentGrades] = useState<any[]>([]);

  useEffect(() => {
    if (user) {
      fetchChildrenData();
    }
  }, [user]);

  const fetchChildrenData = async () => {
    if (!user) return;

    const { data: parent } = await supabase
      .from("parents")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!parent) return;

    const { data: studentsData } = await supabase
      .from("students")
      .select("*, class:classes(name), profiles:user_id(full_name)")
      .eq("guardian_id", parent.id);

    if (studentsData && studentsData.length > 0) {
      const childrenWithStats = await Promise.all(
        studentsData.map(async (student) => {
          const [attendanceRes, gradesRes, invoiceRes] = await Promise.all([
            supabase.from("attendance").select("status", { count: "exact" }).eq("student_id", student.id),
            supabase.from("grades").select("score").eq("student_id", student.id),
            supabase.from("invoices").select("amount, due_date, status").eq("student_id", student.id).eq("status", "unpaid").order("due_date").limit(1)
          ]);

          const presentCount = await supabase
            .from("attendance")
            .select("id", { count: "exact", head: true })
            .eq("student_id", student.id)
            .eq("status", "present");

          const totalAttendance = attendanceRes.count || 1;
          const attendance = ((presentCount.count || 0) / totalAttendance * 100).toFixed(0);

          const avgScore = gradesRes.data && gradesRes.data.length > 0
            ? gradesRes.data.reduce((sum, g) => sum + (Number(g.score) || 0), 0) / gradesRes.data.length
            : 0;

          const avgGrade = avgScore >= 90 ? "A" : avgScore >= 80 ? "B" : avgScore >= 70 ? "C" : avgScore >= 60 ? "D" : "F";

          return {
            ...student,
            attendance: Number(attendance),
            avgGrade,
            nextFee: invoiceRes.data?.[0]?.amount ? `$${invoiceRes.data[0].amount}` : "N/A",
            feeDue: invoiceRes.data?.[0]?.due_date
              ? new Date(invoiceRes.data[0].due_date).toLocaleDateString()
              : "N/A"
          };
        })
      );

      setChildren(childrenWithStats);

      if (studentsData[0]) {
        const { data: gradesData } = await supabase
          .from("grades")
          .select("*, subject:subjects(name)")
          .eq("student_id", studentsData[0].id)
          .order("created_at", { ascending: false })
          .limit(4);

        setRecentGrades(gradesData || []);
      }
    }
  };

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
            {children.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <UserCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No children found</p>
              </div>
            ) : (
              children.map((child, index) => (
                <div key={index} className="flex items-start gap-6 p-6 rounded-lg border bg-gradient-to-br from-primary/5 to-accent/5">
                  <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <UserCircle className="h-10 w-10 text-primary" />
                  </div>
                  <div className="flex-1 space-y-4">
                    <div>
                      <h3 className="text-xl font-semibold">{child.profiles?.full_name}</h3>
                      <p className="text-muted-foreground">{child.class?.name}</p>
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
              ))
            )}
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
                {recentGrades.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <BookOpen className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No grades available yet</p>
                  </div>
                ) : (
                  recentGrades.map((grade, index) => (
                    <div key={index} className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <BookOpen className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{grade.subject?.name}</p>
                          <p className="text-sm text-muted-foreground">Score: {grade.score}%</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={Number(grade.score) >= 80 ? "default" : "secondary"}>
                          {Number(grade.score) >= 90 ? "A" : Number(grade.score) >= 80 ? "B" : Number(grade.score) >= 70 ? "C" : "D"}
                        </Badge>
                        {Number(grade.score) >= 80 && <TrendingUp className="h-4 w-4 text-success" />}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Upcoming Events */}
          <EventsCalendar />
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