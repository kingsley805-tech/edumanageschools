import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Users, Calendar, ClipboardCheck, BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface ClassDetails {
  id: string;
  name: string;
  level: string;
  subject: {
    id: string;
    name: string;
  };
}

interface Student {
  id: string;
  admission_no: string;
  user: {
    full_name: string;
    email: string;
  };
}

interface Schedule {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  room: string;
}

interface Assignment {
  id: string;
  title: string;
  due_date: string;
  description: string;
}

const ClassDetails = () => {
  const { classId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [classDetails, setClassDetails] = useState<ClassDetails | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  useEffect(() => {
    fetchClassDetails();
  }, [classId]);

  const fetchClassDetails = async () => {
    try {
      const { data: classData } = await supabase
        .from("classes")
        .select("id, name, level")
        .eq("id", classId)
        .single();

      if (!classData) return;

      const { data: classSubjects } = await supabase
        .from("class_subjects")
        .select("subject:subjects(id, name)")
        .eq("class_id", classId);

      setClassDetails({
        ...classData,
        subject: classSubjects?.[0]?.subject || { id: "", name: "N/A" }
      });

      // Fixed: Get all students with proper join
      const { data: studentsData } = await supabase
        .from("students")
        .select(`
          id,
          admission_no,
          gender,
          profiles!inner(full_name, email)
        `)
        .eq("class_id", classId)
        .order("admission_no");

      setStudents((studentsData || []).map(s => ({
        id: s.id,
        admission_no: s.admission_no,
        user: {
          full_name: (s.profiles as any)?.full_name || "Unknown",
          email: (s.profiles as any)?.email || ""
        }
      })));

      const { data: schedulesData } = await supabase
        .from("schedules")
        .select("id, day_of_week, start_time, end_time, room")
        .eq("class_id", classId)
        .order("day_of_week");

      setSchedules(schedulesData || []);

      const { data: assignmentsData } = await supabase
        .from("assignments")
        .select("id, title, due_date, description")
        .eq("class_id", classId)
        .order("due_date", { ascending: false })
        .limit(5);

      setAssignments(assignmentsData || []);
    } catch (error) {
      console.error("Error fetching class details:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout role="teacher">
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-3/4" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!classDetails) {
    return (
      <DashboardLayout role="teacher">
        <div className="text-center py-12">
          <p className="text-lg text-muted-foreground">Class not found</p>
          <Button onClick={() => navigate("/teacher/classes")} className="mt-4">
            Back to Classes
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="teacher">
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/teacher/classes")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-3xl font-bold tracking-tight">{classDetails.name}</h2>
            <p className="text-muted-foreground">{classDetails.level} • {classDetails.subject.name}</p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Students</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{students.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Class Sessions</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{schedules.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Recent Assignments</CardTitle>
              <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{assignments.length}</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Student Roster
              </CardTitle>
              <CardDescription>Students enrolled in this class</CardDescription>
            </CardHeader>
            <CardContent>
              {students.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No students enrolled yet
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Admission No.</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.map((student) => (
                      <TableRow key={student.id}>
                        <TableCell className="font-medium">{student.admission_no || "N/A"}</TableCell>
                        <TableCell>{student.user.full_name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{student.user.email}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Class Schedule
              </CardTitle>
              <CardDescription>Weekly class timings</CardDescription>
            </CardHeader>
            <CardContent>
              {schedules.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No schedule set yet
                </div>
              ) : (
                <div className="space-y-3">
                  {schedules.map((schedule) => (
                    <div key={schedule.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div>
                        <p className="font-medium">{daysOfWeek[schedule.day_of_week]}</p>
                        <p className="text-sm text-muted-foreground">Room {schedule.room}</p>
                      </div>
                      <Badge variant="outline">
                        {schedule.start_time} - {schedule.end_time}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Recent Assignments
            </CardTitle>
            <CardDescription>Latest assignments for this class</CardDescription>
          </CardHeader>
          <CardContent>
            {assignments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No assignments created yet
              </div>
            ) : (
              <div className="space-y-4">
                {assignments.map((assignment) => (
                  <div key={assignment.id} className="flex items-start justify-between p-4 rounded-lg border">
                    <div className="space-y-1 flex-1">
                      <p className="font-medium">{assignment.title}</p>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {assignment.description || "No description"}
                      </p>
                    </div>
                    <Badge variant="secondary" className="ml-4">
                      Due {new Date(assignment.due_date).toLocaleDateString()}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default ClassDetails;
