import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, BookOpen, GraduationCap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchTeacherAssignmentGroups,
  type TeacherClassAssignmentGroup,
} from "@/lib/classSubjectAssignments";

const Classes = () => {
  const navigate = useNavigate();
  const [groups, setGroups] = useState<TeacherClassAssignmentGroup[]>([]);
  const [studentCounts, setStudentCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetchClasses();
  }, []);

  const fetchClasses = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: teacher } = await supabase
        .from("teachers")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!teacher) return;

      const assignmentGroups = await fetchTeacherAssignmentGroups(teacher.id);
      setGroups(assignmentGroups);

      const counts: Record<string, number> = {};
      await Promise.all(
        assignmentGroups.map(async (group) => {
          const { count } = await supabase
            .from("students")
            .select("id", { count: "exact", head: true })
            .eq("class_id", group.classId);
          counts[group.classId] = count ?? 0;
        }),
      );
      setStudentCounts(counts);
    } catch (error) {
      console.error("Error fetching classes:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout role="teacher">
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">My Classes</h2>
          <p className="text-muted-foreground">View and manage your assigned classes and subjects</p>
        </div>

        {loading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : groups.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Class List</CardTitle>
              <CardDescription>Your assigned classes and subjects</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-center py-12">
              <div className="text-center space-y-4">
                <Users className="h-16 w-16 text-muted-foreground mx-auto" />
                <p className="text-lg font-medium">No classes assigned yet</p>
                <p className="text-sm text-muted-foreground">Contact admin to assign classes and subjects</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {groups.map((group) => (
              <Card
                key={group.classId}
                className="hover:shadow-lg transition-all cursor-pointer hover:scale-[1.02]"
                onClick={() => navigate(`/teacher/classes/${group.classId}`)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-xl">{group.className}</CardTitle>
                      <CardDescription>{group.classLevel ?? "—"}</CardDescription>
                    </div>
                    <BookOpen className="h-5 w-5 text-primary" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {group.isClassTeacher ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <GraduationCap className="h-4 w-4" />
                      Class teacher
                    </div>
                  ) : null}

                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Subjects you teach</p>
                    {group.subjects.length === 0 ? (
                      <p className="text-sm">No subjects assigned</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {group.subjects.map((subject) => (
                          <Badge key={subject.assignmentId} variant="secondary">
                            {subject.subjectName}
                            {subject.subjectCode ? ` (${subject.subjectCode})` : ""}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Students</span>
                    <span className="font-medium flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      {studentCounts[group.classId] ?? 0}
                    </span>
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

export default Classes;
