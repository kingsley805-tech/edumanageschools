import DashboardLayout from "@/components/DashboardLayout";
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

  const fetchClasses = async () => {
    const { data, error } = await supabase
      .from("classes")
      .select(`
        *,
        students(count)
      `)
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
    const { data: allStudents } = await supabase
      .from("students")
      .select(`
        id,
        admission_no,
        profiles(full_name)
      `);

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
      const { error } = await supabase
        .from("classes")
        .insert([{
          name: data.name,
          level: data.level,
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
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Classes</h2>
            <p className="text-muted-foreground">Manage school classes and enrollments</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
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

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {classes.map((cls) => (
            <Card key={cls.id}>
              <CardHeader>
                <CardTitle>{cls.name}</CardTitle>
                <CardDescription>{cls.level}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span>{cls.students?.[0]?.count || 0} Students</span>
                </div>
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => setSelectedClass(cls.id)}
                >
                  Manage Enrollment
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {selectedClass && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Class Roster</CardTitle>
                  <CardDescription>Enrolled students in {classes.find(c => c.id === selectedClass)?.name}</CardDescription>
                </div>
                <Dialog open={enrollOpen} onOpenChange={setEnrollOpen}>
                  <DialogTrigger asChild>
                    <Button className="gap-2">
                      <UserPlus className="h-4 w-4" />
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
                        <Button variant="outline" onClick={() => setEnrollOpen(false)}>Cancel</Button>
                        <Button onClick={handleEnrollStudent} disabled={!selectedStudent}>
                          Enroll
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {enrolledStudents.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No students enrolled</p>
              ) : (
                <Table>
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
                        <TableCell>{enrollment.students?.admission_no}</TableCell>
                        <TableCell>{enrollment.students?.profiles?.full_name}</TableCell>
                        <TableCell>{enrollment.students?.profiles?.email}</TableCell>
                        <TableCell>{new Date(enrollment.enrolled_on).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
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
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Classes;
