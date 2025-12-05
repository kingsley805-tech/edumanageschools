import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Search, Filter } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";

const studentSchema = z.object({
  admission_no: z.string().min(1, "Admission number is required"),
  email: z.string().email("Invalid email address"),
  full_name: z.string().min(1, "Full name is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  date_of_birth: z.string().min(1, "Date of birth is required"),
  gender: z.enum(["male", "female", "other"]),
  guardian_email: z.string().email("Invalid guardian email").optional(),
});

type StudentFormData = z.infer<typeof studentSchema>;

const Students = () => {
  const [open, setOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const { toast } = useToast();
  const { register, handleSubmit, formState: { errors }, reset, setValue } = useForm<StudentFormData>({
    resolver: zodResolver(studentSchema),
  });

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    // Get current user's school_id for explicit filtering
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profileData } = await supabase
      .from("profiles")
      .select("school_id")
      .eq("id", user.id)
      .single();

    if (!profileData?.school_id) {
      console.error("School not found for user");
      return;
    }

    // Filter students by school_id explicitly (defensive programming)
    const { data, error } = await supabase
      .from("students")
      .select(`
        *,
        classes(name),
        profiles(full_name, email)
      `)
      .eq("school_id", profileData.school_id);
    
    if (!error && data) {
      setStudents(data);
    } else if (error) {
      console.error("Error fetching students:", error);
    }
  };


  const onSubmit = async (data: StudentFormData) => {
    try {
      // Get current user's school_id and school_code
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profileData } = await supabase
        .from("profiles")
        .select("school_id, schools(school_code)")
        .eq("id", user.id)
        .single();

      if (!profileData?.school_id) throw new Error("School not found");
      const schoolCode = (profileData.schools as any)?.school_code;

      // Call edge function to create user without auto-login
      const { data: result, error } = await supabase.functions.invoke('create-user-account', {
        body: {
          email: data.email,
          password: data.password,
          full_name: data.full_name,
          role: 'student',
          school_code: schoolCode,
          admission_no: data.admission_no,
          date_of_birth: data.date_of_birth,
          gender: data.gender,
          guardian_email: data.guardian_email,
        },
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Student added successfully",
      });

      setOpen(false);
      reset();
      fetchStudents();
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
            <h2 className="text-3xl font-bold tracking-tight">Students</h2>
            <p className="text-muted-foreground">Manage student records and enrollments</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Add Student
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Student</DialogTitle>
                <DialogDescription>Enter student information to create a new account</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="admission_no">Admission Number</Label>
                    <Input id="admission_no" {...register("admission_no")} />
                    {errors.admission_no && <p className="text-sm text-destructive">{errors.admission_no.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="full_name">Full Name</Label>
                    <Input id="full_name" {...register("full_name")} />
                    {errors.full_name && <p className="text-sm text-destructive">{errors.full_name.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" {...register("email")} />
                    {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input id="password" type="password" {...register("password")} />
                    {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="date_of_birth">Date of Birth</Label>
                    <Input id="date_of_birth" type="date" {...register("date_of_birth")} />
                    {errors.date_of_birth && <p className="text-sm text-destructive">{errors.date_of_birth.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gender">Gender</Label>
                    <Select onValueChange={(value) => setValue("gender", value as any)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.gender && <p className="text-sm text-destructive">{errors.gender.message}</p>}
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="guardian_email">Guardian Email (Optional)</Label>
                    <Input id="guardian_email" type="email" {...register("guardian_email")} placeholder="Link to parent account" />
                    {errors.guardian_email && <p className="text-sm text-destructive">{errors.guardian_email.message}</p>}
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button type="submit">Add Student</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>All Students</CardTitle>
                <CardDescription>View and manage student information</CardDescription>
              </div>
              <div className="flex gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search students..." className="pl-10 w-64" />
                </div>
                <Button variant="outline" size="icon">
                  <Filter className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Admission No.</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Gender</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No students found. Add your first student to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  students.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell className="font-medium">{student.admission_no}</TableCell>
                      <TableCell>{student.profiles?.full_name}</TableCell>
                      <TableCell>{student.classes?.name}</TableCell>
                      <TableCell className="capitalize">{student.gender}</TableCell>
                      <TableCell>
                        <Badge className="bg-success">Active</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => {
                            setSelectedStudent(student);
                            setViewDialogOpen(true);
                          }}
                        >
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* View Student Dialog */}
        <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Student Details</DialogTitle>
              <DialogDescription>View complete student information</DialogDescription>
            </DialogHeader>
            {selectedStudent && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Admission Number</Label>
                    <p className="font-medium">{selectedStudent.admission_no}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Full Name</Label>
                    <p className="font-medium">{selectedStudent.profiles?.full_name}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Email</Label>
                    <p className="font-medium">{selectedStudent.profiles?.email}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Class</Label>
                    <p className="font-medium">{selectedStudent.classes?.name || "Not assigned"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Gender</Label>
                    <p className="font-medium capitalize">{selectedStudent.gender}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Date of Birth</Label>
                    <p className="font-medium">
                      {selectedStudent.date_of_birth 
                        ? new Date(selectedStudent.date_of_birth).toLocaleDateString()
                        : "Not provided"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Status</Label>
                    <Badge className="bg-success">Active</Badge>
                  </div>
                  {selectedStudent.guardian_email && (
                    <div>
                      <Label className="text-muted-foreground">Guardian Email</Label>
                      <p className="font-medium">{selectedStudent.guardian_email}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default Students;
