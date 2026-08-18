import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { EntityProfilePageLayout } from "@/components/entities/EntityProfilePageLayout";
import DashboardLayout from "@/components/DashboardLayout";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Users, GraduationCap, Calendar, BookOpen } from "lucide-react";

export default function ClassProfile() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();

  const [classData, setClassData] = useState<any | null>(null);
  const [enrolledStudents, setEnrolledStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchClass(id);
      fetchEnrolledStudents(id);
    }
  }, [id]);

  const fetchClass = async (classId: string) => {
    try {
      setLoading(true);
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(classId);

      // Strategy 1: Joined query
      let query = supabase.from("classes").select(`
        *,
        class_teacher:teachers(
          id,
          employee_no,
          profiles(full_name, email)
        )
      `);

      if (isUuid) {
        query = query.eq("id", classId);
      } else {
        query = query.eq("name", classId);
      }

      const { data, error } = await query.maybeSingle();

      let classRecord: any = data;

      // Strategy 2: Bare query fallback
      if (error || !classRecord) {
        let bareQuery = supabase.from("classes").select("*");
        if (isUuid) {
          bareQuery = bareQuery.eq("id", classId);
        } else {
          bareQuery = bareQuery.eq("name", classId);
        }
        const { data: fbData, error: fbError } = await bareQuery.maybeSingle();

        if (fbData) {
          classRecord = { ...fbData };
          if (fbData.class_teacher_id) {
            const { data: teacherData } = await supabase
              .from("teachers")
              .select("id, employee_no, profiles(full_name, email)")
              .eq("id", fbData.class_teacher_id)
              .maybeSingle();
            if (teacherData) classRecord.class_teacher = teacherData;
          }
        } else if (fbError && !error) {
          throw fbError;
        }
      }

      setClassData(classRecord || null);
    } catch (err: any) {
      console.error("fetchClass error:", err);
      toast({
        title: "Error",
        description: err.message || "Failed to load class",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchEnrolledStudents = async (classId: string) => {
    try {
      const { data, error } = await supabase
        .from("students")
        .select(`
          id,
          admission_number,
          admission_no,
          full_name,
          gender,
          profiles:profiles!students_user_id_fkey(full_name, email)
        `)
        .eq("class_id", classId)
        .order("admission_number");

      if (error) {
        const { data: fbData } = await supabase
          .from("students")
          .select("id, admission_number, admission_no, full_name, gender, profiles(full_name, email)")
          .eq("class_id", classId);

        if (fbData) setEnrolledStudents(fbData);
      } else if (data) {
        setEnrolledStudents(data);
      }
    } catch {
      // ignore
    }
  };

  if (loading) {
    return (
      <DashboardLayout role="admin">
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <i className="ki-filled ki-arrows-circle animate-spin text-3xl text-primary mb-3" />
          <p className="text-sm font-medium text-muted-foreground">Loading class details...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!classData) {
    return (
      <DashboardLayout role="admin">
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center max-w-md mx-auto">
          <div className="size-16 rounded-2xl bg-muted flex items-center justify-center mb-4 text-muted-foreground">
            <GraduationCap className="size-8 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Class Not Found</h2>
          <p className="text-sm text-muted-foreground mt-2">
            The requested class record could not be found or may have been removed.
          </p>
          <div className="flex items-center gap-3 mt-6">
            <Link to="/admin/classes" className="kt-btn kt-btn-primary kt-btn-sm">
              Return to Classes List
            </Link>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const className = classData.name || "Class";
  const level = classData.level || "—";
  const teacherName =
    classData.class_teacher?.profiles?.full_name || "Unassigned";

  return (
    <EntityProfilePageLayout
      role="admin"
      backLink={{ to: "/admin/classes", label: "Back to Classes" }}
      entityType="Class"
      entityCode={level !== "—" ? level : undefined}
      name={className}
      statusText="Active Class"
      statusVariant="success"
      metaItems={[
        {
          icon: "ki-book-open",
          text: `Level: ${level}`,
        },
        {
          icon: "ki-user",
          text: `Form Master: ${teacherName}`,
        },
        {
          icon: "ki-people",
          text: `${enrolledStudents.length} Students Enrolled`,
        },
      ]}
      rightMetric={{
        label: "Enrollment Count",
        value: `${enrolledStudents.length} Students`,
      }}
      generalInfo={[
        {
          label: "Class Name",
          value: className,
        },
        {
          label: "Grade / Level",
          value: level,
        },
        {
          label: "Class Teacher",
          value: classData.class_teacher ? (
            <Link
              to={`/admin/teachers/${classData.class_teacher.id}`}
              className="text-primary hover:underline font-medium"
            >
              {teacherName}
            </Link>
          ) : (
            "Unassigned"
          ),
        },
        {
          label: "Capacity",
          value: classData.capacity ? `${classData.capacity} seats` : "Standard (45)",
        },
        {
          label: "Status",
          value: "Active",
        },
      ]}
      stats={[
        {
          label: "Enrolled",
          value: enrolledStudents.length,
        },
        {
          label: "Attendance Rate",
          value: "96%",
        },
        {
          label: "Subjects",
          value: "8 Core",
        },
        {
          label: "Status",
          value: "Active",
        },
      ]}
      onRefreshStats={() => {
        fetchClass(classData.id);
        fetchEnrolledStudents(classData.id);
      }}
      customTabs={[
        {
          id: "students",
          label: `Enrolled Students (${enrolledStudents.length})`,
          content: (
            <div className="kt-card border border-border rounded-xl bg-card overflow-hidden">
              <div className="p-4 border-b border-border flex justify-between items-center">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  Class Student Roster
                </h3>
                <span className="text-xs text-muted-foreground">
                  {enrolledStudents.length} Students
                </span>
              </div>
              <div className="overflow-x-auto">
                <Table className="kt-table">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Admission No.</TableHead>
                      <TableHead>Student Name</TableHead>
                      <TableHead>Gender</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {enrolledStudents.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                          No students enrolled in this class yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      enrolledStudents.map((st) => {
                        const adm = st.admission_number || st.admission_no || "—";
                        const stName = st.profiles?.full_name || st.full_name || "Student";
                        return (
                          <TableRow key={st.id}>
                            <TableCell className="font-mono text-xs">
                              <Link
                                to={`/admin/students/${st.id}`}
                                className="text-foreground font-semibold hover:text-primary hover:underline"
                              >
                                {adm}
                              </Link>
                            </TableCell>
                            <TableCell className="font-medium">
                              <Link
                                to={`/admin/students/${st.id}`}
                                className="text-foreground hover:text-primary hover:underline"
                              >
                                {stName}
                              </Link>
                            </TableCell>
                            <TableCell className="capitalize">{st.gender || "—"}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {st.profiles?.email || "—"}
                            </TableCell>
                            <TableCell className="text-right">
                              <Link
                                to={`/admin/students/${st.id}`}
                                className="kt-btn kt-btn-outline kt-btn-sm h-7 px-2.5 text-xs text-primary"
                              >
                                View Profile
                              </Link>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          ),
        },
      ]}
    />
  );
}
