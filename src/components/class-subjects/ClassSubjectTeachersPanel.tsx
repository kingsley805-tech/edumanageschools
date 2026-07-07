import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BookOpen, GraduationCap } from "lucide-react";
import {
  fetchClassTeachersOverview,
  type ClassTeachersOverview,
} from "@/lib/classSubjectAssignments";

type Props = {
  classId: string | null | undefined;
  title?: string;
  description?: string;
};

export function ClassSubjectTeachersPanel({
  classId,
  title = "Subjects & teachers",
  description = "Teachers assigned to this class",
}: Props) {
  const [overview, setOverview] = useState<ClassTeachersOverview | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!classId) {
      setOverview(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void fetchClassTeachersOverview(classId)
      .then((data) => {
        if (!cancelled) setOverview(data);
      })
      .catch(() => {
        if (!cancelled) setOverview(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [classId]);

  if (!classId) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="h-5 w-5" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : !overview ? (
          <p className="text-sm text-muted-foreground">Class information is not available.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="outline">{overview.className}</Badge>
              {overview.classLevel ? (
                <span className="text-muted-foreground">{overview.classLevel}</span>
              ) : null}
              {overview.classTeacherName ? (
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <GraduationCap className="h-4 w-4" />
                  Class teacher: <span className="font-medium text-foreground">{overview.classTeacherName}</span>
                </span>
              ) : null}
            </div>

            {overview.subjects.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No subject teachers have been assigned to this class yet.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subject</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Teacher</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overview.subjects.map((row) => (
                    <TableRow key={`${row.subjectId}-${row.teacherId}`}>
                      <TableCell className="font-medium">{row.subjectName}</TableCell>
                      <TableCell>{row.subjectCode ?? "—"}</TableCell>
                      <TableCell>{row.teacherName}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
