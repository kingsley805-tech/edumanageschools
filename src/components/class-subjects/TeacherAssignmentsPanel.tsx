import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, GraduationCap, Users } from "lucide-react";
import {
  fetchTeacherAssignmentGroups,
  type TeacherClassAssignmentGroup,
} from "@/lib/classSubjectAssignments";
import { supabase } from "@/integrations/supabase/client";

type Props = {
  teacherId: string | null;
  title?: string;
  description?: string;
  showViewAll?: boolean;
};

export function TeacherAssignmentsPanel({
  teacherId,
  title = "My classes & subjects",
  description = "Classes and subjects assigned to you",
  showViewAll = true,
}: Props) {
  const navigate = useNavigate();
  const [groups, setGroups] = useState<TeacherClassAssignmentGroup[]>([]);
  const [studentCounts, setStudentCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!teacherId) {
      setGroups([]);
      setStudentCounts({});
      return;
    }

    let cancelled = false;
    setLoading(true);

    void fetchTeacherAssignmentGroups(teacherId)
      .then(async (data) => {
        if (cancelled) return;
        setGroups(data);

        const counts: Record<string, number> = {};
        await Promise.all(
          data.map(async (group) => {
            const { count } = await supabase
              .from("students")
              .select("id", { count: "exact", head: true })
              .eq("class_id", group.classId);
            counts[group.classId] = count ?? 0;
          }),
        );
        if (!cancelled) setStudentCounts(counts);
      })
      .catch(() => {
        if (!cancelled) setGroups([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [teacherId]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            {title}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        {showViewAll ? (
          <Button variant="outline" size="sm" onClick={() => navigate("/teacher/classes")}>
            View all
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : groups.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No classes assigned yet. Contact your school admin to link you to classes and subjects.
          </p>
        ) : (
          <div className="space-y-4">
            {groups.map((group) => (
              <div
                key={group.classId}
                className="rounded-lg border p-4 space-y-3 hover:bg-muted/30 transition-colors cursor-pointer"
                onClick={() => navigate(`/teacher/classes/${group.classId}`)}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{group.className}</p>
                    <p className="text-sm text-muted-foreground">
                      {group.classLevel ?? "—"}
                      {group.isClassTeacher ? " · Class teacher" : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    {studentCounts[group.classId] ?? 0} students
                  </div>
                </div>

                {group.subjects.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {group.subjects.map((subject) => (
                      <Badge key={subject.assignmentId} variant="secondary">
                        {subject.subjectName}
                        {subject.subjectCode ? ` (${subject.subjectCode})` : ""}
                      </Badge>
                    ))}
                  </div>
                ) : group.isClassTeacher ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <GraduationCap className="h-4 w-4" />
                    Class teacher — no subject assignments yet
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
