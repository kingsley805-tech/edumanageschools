import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { UserCircle, BookOpen, Calendar, Award } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

interface Child {
  id: string;
  user_id: string;
  admission_no: string;
  profiles: {
    full_name: string;
    email: string;
  };
  classes: {
    name: string;
  };
  attendance?: number;
  avgGrade?: string;
  totalClasses?: number;
}

const Children = () => {
  const { user } = useAuth();
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchChildren = async () => {
      if (!user) return;

      const { data: parentData } = await supabase
        .from("parents")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (parentData) {
        const { data } = await supabase
          .from("students")
          .select(`
            id,
            user_id,
            admission_no,
            class_id,
            profiles:user_id (full_name, email),
            classes (name)
          `)
          .eq("guardian_id", parentData.id);

        if (data) {
          const childrenWithStats = await Promise.all(
            data.map(async (child: any) => {
              const [attendanceRes, gradesRes, classesRes] = await Promise.all([
                supabase.from("attendance").select("status", { count: "exact" }).eq("student_id", child.id),
                supabase.from("grades").select("score").eq("student_id", child.id),
                supabase.from("schedules").select("id", { count: "exact", head: true }).eq("class_id", child.class_id)
              ]);

              const presentCount = await supabase
                .from("attendance")
                .select("id", { count: "exact", head: true })
                .eq("student_id", child.id)
                .eq("status", "present");

              const totalAttendance = attendanceRes.count || 1;
              const attendance = Math.round(((presentCount.count || 0) / totalAttendance) * 100);

              const avgScore = gradesRes.data && gradesRes.data.length > 0
                ? gradesRes.data.reduce((sum, g) => sum + (Number(g.score) || 0), 0) / gradesRes.data.length
                : 0;

              const avgGrade = avgScore >= 90 ? "A" : avgScore >= 80 ? "B" : avgScore >= 70 ? "C" : avgScore >= 60 ? "D" : avgScore > 0 ? "F" : "--";

              return {
                ...child,
                attendance,
                avgGrade,
                totalClasses: classesRes.count || 0
              };
            })
          );
          setChildren(childrenWithStats);
        }
      }
      setLoading(false);
    };

    fetchChildren();
  }, [user]);

  if (loading) {
    return (
      <DashboardLayout role="parent">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="parent">
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">My Children</h2>
          <p className="text-muted-foreground">View and manage your children's profiles</p>
        </div>

        {children.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <UserCircle className="h-16 w-16 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No children found</p>
              <p className="text-sm text-muted-foreground">Contact the school admin to link your children</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {children.map((child) => (
              <Card key={child.id} className="animate-fade-in">
                <CardHeader>
                  <div className="flex items-start gap-4">
                    <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                      <UserCircle className="h-10 w-10 text-primary" />
                    </div>
                    <div className="flex-1">
                      <CardTitle>{child.profiles?.full_name || "Student"}</CardTitle>
                      <p className="text-sm text-muted-foreground">{child.classes?.name || "No class assigned"}</p>
                      <Badge variant="outline" className="mt-2">
                        {child.admission_no}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2 text-center p-3 rounded-lg bg-primary/5">
                      <Calendar className="h-5 w-5 text-primary mx-auto" />
                      <p className="text-sm text-muted-foreground">Attendance</p>
                      <p className="text-xl font-bold">{child.attendance || 0}%</p>
                    </div>
                    <div className="space-y-2 text-center p-3 rounded-lg bg-accent/5">
                      <Award className="h-5 w-5 text-accent mx-auto" />
                      <p className="text-sm text-muted-foreground">Avg Grade</p>
                      <p className="text-xl font-bold">{child.avgGrade || "--"}</p>
                    </div>
                    <div className="space-y-2 text-center p-3 rounded-lg bg-success/5">
                      <BookOpen className="h-5 w-5 text-success mx-auto" />
                      <p className="text-sm text-muted-foreground">Classes</p>
                      <p className="text-xl font-bold">{child.totalClasses || 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Children;
