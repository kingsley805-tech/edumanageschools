import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Search, Filter, Pencil, Trash2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
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
  guardian_email: z.string().email("Invalid guardian email").optional().or(z.literal("")),
});

const editStudentSchema = z.object({
  admission_no: z.string().min(1, "Admission number is required"),
  full_name: z.string().min(1, "Full name is required"),
  date_of_birth: z.string().optional(),
  gender: z.enum(["male", "female", "other"]).optional(),
  class_id: z.string().optional(),
});

type StudentFormData = z.infer<typeof studentSchema>;
type EditStudentFormData = z.infer<typeof editStudentSchema>;

const Students = () => {
  const [open, setOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();
  
  const { register, handleSubmit, formState: { errors }, reset, setValue } = useForm<StudentFormData>({
    resolver: zodResolver(studentSchema),
  });

  const { 
    register: registerEdit, 
    handleSubmit: handleEditSubmit, 
    formState: { errors: editErrors }, 
    reset: resetEdit, 
    setValue: setEditValue 
  } = useForm<EditStudentFormData>({
    resolver: zodResolver(editStudentSchema),
  });

  useEffect(() => {
    fetchStudents();
    fetchClasses();
  }, []);

  const fetchClasses = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profileData } = await supabase
      .from("profiles")
      .select("school_id")
      .eq("id", user.id)
      .single();

    if (!profileData?.school_id) return;
    setSchoolId(profileData.school_id);

    const { data } = await supabase
      .from("classes")
      .select("id, name, level")
      .eq("school_id", profileData.school_id);
    
    if (data) setClasses(data);
  };

  const fetchStudents = async () => {
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profileData } = await supabase
        .from("profiles")
        .select("school_id, schools(school_code)")
        .eq("id", user.id)
        .single();

      if (!profileData?.school_id) throw new Error("School not found");
      const schoolCode = (profileData.schools as any)?.school_code;

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
          guardian_email: data.guardian_email || undefined,
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

  const openEditDialog = (student: any) => {
    setSelectedStudent(student);
    resetEdit({
      admission_no: student.admission_no || "",
      full_name: student.profiles?.full_name || "",
      date_of_birth: student.date_of_birth || "",
      gender: student.gender || undefined,
      class_id: student.class_id || "",
    });
    setEditDialogOpen(true);
  };

  const onEditSubmit = async (data: EditStudentFormData) => {
    if (!selectedStudent) return;

    try {
      // Update students table
      const { error: studentError } = await supabase
        .from("students")
        .update({
          admission_no: data.admission_no,
          date_of_birth: data.date_of_birth || null,
          gender: data.gender || null,
          class_id: data.class_id || null,
        })
        .eq("id", selectedStudent.id);

      if (studentError) throw studentError;

      // Update profiles table for full_name
      if (selectedStudent.user_id) {
        const { error: profileError } = await supabase
          .from("profiles")
          .update({ full_name: data.full_name })
          .eq("id", selectedStudent.user_id);

        if (profileError) throw profileError;
      }

      toast({
        title: "Success",
        description: "Student updated successfully",
      });

      setEditDialogOpen(false);
      fetchStudents();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteStudent = async (student: any) => {
    if (!student?.user_id) {
      toast({
        title: "Error",
        description: "Cannot delete student: No user account associated",
        variant: "destructive",
      });
      return;
    }

    setDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke('delete-user-account', {
        body: {
          user_id: student.user_id,
          user_role: 'student',
          user_name: student.profiles?.full_name,
        },
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Student deleted successfully. Registration number remains locked.",
      });

      fetchStudents();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete student",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <DashboardLayout role="admin">
      <div className="space-y-4 md:space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Students</h2>
            <p className="text-sm md:text-base text-muted-foreground">Manage student records and enrollments</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 w-full sm:w-auto">
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
          <CardHeader className="p-4 md:p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg md:text-xl">All Students</CardTitle>
                <CardDescription className="text-sm md:text-base">View and manage student information</CardDescription>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:flex-initial">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search students..." className="pl-10 w-full sm:w-64 text-base" />
                </div>
                <Button variant="outline" size="icon" className="flex-shrink-0">
                  <Filter className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0 md:p-6 pt-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[120px]">Admission No.</TableHead>
                    <TableHead className="min-w-[150px]">Name</TableHead>
                    <TableHead className="hidden sm:table-cell">Class</TableHead>
                    <TableHead className="hidden md:table-cell">Gender</TableHead>
                    <TableHead className="min-w-[80px]">Status</TableHead>
                    <TableHead className="text-right min-w-[120px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        No students found. Add your first student to get started.
                      </TableCell>
                    </TableRow>
                  ) : (
                    students.map((student) => (
                      <TableRow key={student.id}>
                        <TableCell className="font-medium">
                          {student.admission_no || <Badge variant="outline" className="text-xs">Not assigned</Badge>}
                        </TableCell>
                        <TableCell className="font-medium">{student.profiles?.full_name}</TableCell>
                        <TableCell className="hidden sm:table-cell">{student.classes?.name || "N/A"}</TableCell>
                        <TableCell className="hidden md:table-cell capitalize">{student.gender || "N/A"}</TableCell>
                        <TableCell>
                          <Badge className="bg-success text-xs">Active</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => openEditDialog(student)}
                              className="h-8 md:h-9"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => {
                                setSelectedStudent(student);
                                setViewDialogOpen(true);
                              }}
                              className="h-8 md:h-9"
                            >
                              View
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  className="h-8 md:h-9 text-destructive hover:text-destructive"
                                  disabled={deleting}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Student</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete {student.profiles?.full_name}? 
                                    This action cannot be undone. The registration number will remain 
                                    locked and cannot be reused.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction 
                                    onClick={() => handleDeleteStudent(student)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Edit Student Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Student</DialogTitle>
              <DialogDescription>Update student information</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleEditSubmit(onEditSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit_admission_no">Admission Number</Label>
                  <Input id="edit_admission_no" {...registerEdit("admission_no")} />
                  {editErrors.admission_no && <p className="text-sm text-destructive">{editErrors.admission_no.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_full_name">Full Name</Label>
                  <Input id="edit_full_name" {...registerEdit("full_name")} />
                  {editErrors.full_name && <p className="text-sm text-destructive">{editErrors.full_name.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_date_of_birth">Date of Birth</Label>
                  <Input id="edit_date_of_birth" type="date" {...registerEdit("date_of_birth")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_gender">Gender</Label>
                  <Select 
                    defaultValue={selectedStudent?.gender}
                    onValueChange={(value) => setEditValue("gender", value as any)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="edit_class">Class</Label>
                  <Select 
                    defaultValue={selectedStudent?.class_id}
                    onValueChange={(value) => setEditValue("class_id", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select class" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes.map((cls) => (
                        <SelectItem key={cls.id} value={cls.id}>
                          {cls.name} {cls.level && `(${cls.level})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
                <Button type="submit">Save Changes</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

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
                    <p className="font-medium">{selectedStudent.admission_no || "Not assigned"}</p>
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
                    <p className="font-medium capitalize">{selectedStudent.gender || "Not specified"}</p>
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
