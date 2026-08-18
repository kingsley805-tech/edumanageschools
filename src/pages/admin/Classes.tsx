import DashboardLayout from "@/components/DashboardLayout";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Users, UserPlus } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { resolveUserSchoolId } from "@/lib/schoolFetch";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const classSchema = z.object({
  name: z.string().min(1, "Class name is required"),
  level: z.string().min(1, "Level is required"),
});

type ClassFormData = z.infer<typeof classSchema>;

const Classes = () => {
  const [open, setOpen] = useState(false);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [classes, setClasses] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [enrolledStudents, setEnrolledStudents] = useState<any[]>([]);
  const [availableStudents, setAvailableStudents] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<string>("");
  const { toast } = useToast();
  const { register, handleSubmit, formState: { errors }, reset } = useForm<ClassFormData>({
    resolver: zodResolver(classSchema),
  });

  useEffect(() => {
    fetchClasses();
  }, []);

  useEffect(() => {
    if (selectedClass) {
      fetchEnrolledStudents();
      fetchAvailableStudents();
    }
  }, [selectedClass]);

  const fetchTeachers = async (schoolId: string) => {
    const { data, error } = await supabase
      .from("teachers")
      .select("id, employee_no, profiles(full_name)")
      .eq("school_id", schoolId);
    if (!error && data) {
      setTeachers(data);
    }
  };

  const handleAssignClassTeacher = async (
    classId: string,
    teacherId: string,
    currentTeacherId?: string | null,
  ) => {
    const newTeacher = teacherId === "unassigned" ? null : teacherId;
    const current = currentTeacherId ?? null;
    if (newTeacher === current) return;

    try {
      const { error } = await supabase.rpc("assign_class_teacher", {
        p_class_id: classId,
        p_teacher_id: newTeacher,
      });
      if (error) throw error;
      toast({
        title: "Success",
        description: newTeacher ? "Class teacher assigned." : "Class teacher removed.",
      });
      fetchClasses();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const fetchClasses = async () => {
    // Get current user's school_id for filtering
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const schoolId = await resolveUserSchoolId(user.id);
    if (!schoolId) {
      console.error("School not found for user");
      return;
    }

    fetchTeachers(schoolId);

    const { data, error } = await supabase
      .from("classes")
      .select(`
        *,
        students(count),
        class_teacher:teachers!class_teacher_id(
          id,
          profiles(full_name)
        )
      `)
      .eq("school_id", schoolId)
      .order("name");
    
    if (!error && data) {
      setClasses(data);
    }
  };

  const fetchEnrolledStudents = async () => {
    const { data } = await supabase
      .from("enrollments")
      .select(`
        id,
        enrolled_on,
        students(
          id,
          admission_no,
          profiles(full_name, email)
        )
      `)
      .eq("class_id", selectedClass)
      .eq("status", "active");
    
    if (data) setEnrolledStudents(data);
  };

  const fetchAvailableStudents = async () => {
    // Get current user's school_id for filtering
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const schoolId = await resolveUserSchoolId(user.id);
    if (!schoolId) return;

    const { data: allStudents } = await supabase
      .from("students")
      .select(`
        id,
        admission_no,
        profiles(full_name)
      `)
      .eq("school_id", schoolId);

    const { data: enrolledIds } = await supabase
      .from("enrollments")
      .select("student_id")
      .eq("class_id", selectedClass)
      .eq("status", "active");

    const enrolledStudentIds = new Set(enrolledIds?.map(e => e.student_id) || []);
    const available = allStudents?.filter(s => !enrolledStudentIds.has(s.id)) || [];
    
    setAvailableStudents(available);
  };

  const onSubmit = async (data: ClassFormData) => {
    try {
      // Get current user's school_id
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const schoolId = await resolveUserSchoolId(user.id);
      if (!schoolId) throw new Error("School not found");

      const { error } = await supabase
        .from("classes")
        .insert([{
          name: data.name,
          level: data.level,
          school_id: schoolId,
        }]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Class created successfully",
      });

      setOpen(false);
      reset();
      fetchClasses();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleEnrollStudent = async () => {
    if (!selectedStudent || !selectedClass) return;

    try {
      const { error } = await supabase
        .from("enrollments")
        .insert([{
          student_id: selectedStudent,
          class_id: selectedClass,
          enrolled_on: new Date().toISOString().split('T')[0],
          status: "active",
        }]);

      if (error) throw error;

      await supabase
        .from("students")
        .update({ class_id: selectedClass })
        .eq("id", selectedStudent);

      toast({
        title: "Success",
        description: "Student enrolled successfully",
      });

      setSelectedStudent("");
      setEnrollOpen(false);
      fetchEnrolledStudents();
      fetchAvailableStudents();
      fetchClasses();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleRemoveStudent = async (enrollmentId: string, studentId: string) => {
    try {
      await supabase
        .from("enrollments")
        .update({ status: "inactive" })
        .eq("id", enrollmentId);

      await supabase
        .from("students")
        .update({ class_id: null })
        .eq("id", studentId);

      toast({
        title: "Success",
        description: "Student removed from class",
      });

      fetchEnrolledStudents();
      fetchAvailableStudents();
      fetchClasses();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <DashboardLayout role="admin">
      {/* Page Header — Metronic toolbar */}
      <div className="flex flex-wrap items-center lg:items-end justify-between gap-5 pb-7.5">
        <div className="flex min-w-0 flex-col justify-center gap-2">
          <h1 className="text-xl font-medium leading-none text-mono">Classes</h1>
          <div className="flex items-center gap-2 text-sm font-normal text-secondary-foreground">
            Manage school classes, teacher assignments, and student enrollments
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="kt-btn kt-btn-primary gap-2">
                <i className="ki-filled ki-plus text-base" />
                Add Class
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Class</DialogTitle>
                <DialogDescription>Create a new class for students</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Class Name</Label>
                  <Input id="name" placeholder="e.g., Grade 10A" {...register("name")} />
                  {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="level">Level</Label>
                  <Input id="level" placeholder="e.g., Secondary" {...register("level")} />
                  {errors.level && <p className="text-sm text-destructive">{errors.level.message}</p>}
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button type="submit">Create Class</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 mb-7.5">
        {classes.map((cls) => (
          <div className="kt-card" key={cls.id}>
            <div className="kt-card-header flex justify-between items-center py-4 px-5">
              <div>
                <Link
                  to={`/admin/classes/${cls.id}`}
                  className="kt-card-title text-base hover:text-primary hover:underline block"
                >
                  {cls.name}
                </Link>
                <span className="text-xs text-secondary-foreground">{cls.level || "Standard level"}</span>
              </div>
              <span className="kt-badge kt-badge-outline kt-badge-sm">
                {cls.students?.[0]?.count || 0} students
              </span>
            </div>
            <div className="kt-card-content p-5 flex flex-col gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground font-medium">Class Teacher</Label>
                <Select
                  value={cls.class_teacher_id || "unassigned"}
                  onValueChange={(val) =>
                    handleAssignClassTeacher(cls.id, val, cls.class_teacher_id)
                  }
                >
                  <SelectTrigger className="w-full text-xs h-9">
                    <SelectValue placeholder="Assign teacher" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {teachers.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.profiles?.full_name ?? "Teacher"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  className="kt-btn kt-btn-outline flex-1 justify-center"
                  onClick={() => setSelectedClass(cls.id)}
                >
                  Roster
                </Button>
                <Link
                  to={`/admin/classes/${cls.id}`}
                  className="kt-btn kt-btn-primary px-3 text-xs justify-center inline-flex items-center"
                >
                  View Class
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>

      {selectedClass && (
        <div className="kt-card">
          <div className="kt-card-header flex flex-wrap gap-2.5 py-4 px-5 justify-between items-center">
            <div>
              <h3 className="kt-card-title">Class Roster</h3>
              <p className="text-xs text-secondary-foreground">Enrolled students in {classes.find(c => c.id === selectedClass)?.name}</p>
            </div>
            <Dialog open={enrollOpen} onOpenChange={setEnrollOpen}>
              <DialogTrigger asChild>
                <Button className="kt-btn kt-btn-primary gap-2">
                  <i className="ki-filled ki-plus text-base" />
                  Enroll Student
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Enroll Student</DialogTitle>
                  <DialogDescription>Add a student to this class</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Select Student</Label>
                    <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose student" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableStudents.map((student) => (
                          <SelectItem key={student.id} value={student.id}>
                            {student.admission_no} - {student.profiles?.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setEnrollOpen(false)}>Cancel</Button>
                    <Button onClick={handleEnrollStudent} disabled={!selectedStudent}>
                      Enroll
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <div className="kt-card-content p-0 overflow-x-auto">
            {enrolledStudents.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No students enrolled</p>
            ) : (
              <Table className="kt-table min-w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead>Admission No</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Enrolled</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {enrolledStudents.map((enrollment) => (
                    <TableRow key={enrollment.id}>
                      <TableCell className="font-mono text-2sm">
                        {enrollment.students?.id ? (
                          <Link
                            to={`/admin/students/${enrollment.students.id}`}
                            className="text-foreground font-semibold hover:text-primary hover:underline"
                          >
                            {enrollment.students?.admission_no}
                          </Link>
                        ) : (
                          enrollment.students?.admission_no
                        )}
                      </TableCell>
                      <TableCell className="font-medium text-mono">
                        {enrollment.students?.id ? (
                          <Link
                            to={`/admin/students/${enrollment.students.id}`}
                            className="text-foreground hover:text-primary hover:underline"
                          >
                            {enrollment.students?.profiles?.full_name}
                          </Link>
                        ) : (
                          enrollment.students?.profiles?.full_name
                        )}
                      </TableCell>
                      <TableCell className="text-secondary-foreground">{enrollment.students?.profiles?.email || "—"}</TableCell>
                      <TableCell className="font-mono text-2sm">{new Date(enrollment.enrolled_on).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="kt-btn kt-btn-ghost kt-btn-sm text-destructive hover:text-destructive"
                          onClick={() => handleRemoveStudent(enrollment.id, enrollment.students?.id)}
                        >
                          Remove
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default Classes;
